import { prisma } from "../config/postgres";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { htmlToText } from "html-to-text";
import axios from "axios";
import jwt_decode from "jwt-decode";
import { decodeBase64Url } from "../utils/decodeBase64Url";
import {
  internalServerError,
  badRequestResponse,
  notFoundResponse,
} from "./errors";
import { Client } from "@notionhq/client";
import {
  extractDatabaseContent,
  getPageTitle,
  retrieveBlockChildren,
  formatPageContent,
  summarizeWithLLM,
  summarizeEmailsWithLLM,
} from "../utils/notionFuncs";

const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IjA3ZmRmMDVlLWVmYTEtNDU4Zi04YWM5LTEyZTc2YzlmNmJiYiIsImlhdCI6MTc0MzQwMjM0MywiZXhwIjoxNzQ0MjY2MzQzfQ.aGEh-c5vXmJqh55Cznz2EdbcntaPjjxnMbeqV7Mw2mw";

const getGoogleEmails = async (access_token: string): Promise<null | any> => {
  try {
    const last24Hours = new Date();
    last24Hours.setDate(last24Hours.getDate() - 1);

    const listResponse = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { q: "is:unread category:primary", maxResults: 10 },
      }
    );

    const messages = listResponse.data.messages || [];

    const unreadEmails = await Promise.all(
      messages.map(async (message: any) => {
        const msgResponse = await axios.get(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          {
            headers: { Authorization: `Bearer ${access_token}` },
            params: { format: "full" },
          }
        );

        const { payload, internalDate } = msgResponse.data;
        const headers = payload.headers || [];

        const subjectHeader = headers.find((h: any) => h.name === "Subject");
        const fromHeader = headers.find((h: any) => h.name === "From");

        const subject = subjectHeader ? subjectHeader.value : "No Subject";
        const from = fromHeader ? fromHeader.value : "Unknown Sender";

        let body = "";
        if (payload.parts) {
          const textPart = payload.parts.find(
            (part: any) => part.mimeType === "text/plain"
          );
          const htmlPart = payload.parts.find(
            (part: any) => part.mimeType === "text/html"
          );
          body =
            textPart && textPart.body.data
              ? decodeBase64Url(textPart.body.data)
              : htmlPart && htmlPart.body.data
              ? decodeBase64Url(htmlPart.body.data)
              : "No readable content";
        } else if (payload.body && payload.body.data) {
          body = decodeBase64Url(payload.body.data);
        }

        let bodytext = htmlToText(body, {
          wordwrap: 130,
          preserveNewlines: true,
          selectors: [
            { selector: "div.preview", format: "skip" },
            { selector: "div.footer", format: "skip" },
            { selector: "img", format: "skip" },
            { selector: "style", format: "skip" },
            { selector: "table.emailSeparator-mtbezJ", format: "skip" },
          ],
        }).trim();

        bodytext = bodytext.replace(/https?:\/\/[^\s]+/g, "").trim();

        return {
          body: bodytext,
          subject: subject,
          timestamp: new Date(Number(internalDate)),
          from: from,
        };
      })
    );

    const filteredUnreadEmails = unreadEmails.filter(
      (email: any) => email.timestamp >= last24Hours
    );

    const summarizedEmails: Array<any> = [];

    for (const email of filteredUnreadEmails) {
      const summary = await summarizeEmailsWithLLM(email.body);
      if (summary) {
        summarizedEmails.push({
          body: summary,
          subject: email.subject,
          timestamp: email.timestamp,
          from: email.from,
        });
      } else {
        summarizedEmails.push({
          body: email.body,
          subject: email.subject,
          timestamp: email.timestamp,
          from: email.from,
        });
      }
    }

    return summarizedEmails;
  } catch (err) {
    console.log(err.response.data);
    return null;
  }
};

const getOutlookEmails = async (access_token: string): Promise<null | any> => {
  try {
    const last24Hours = new Date();
    last24Hours.setDate(last24Hours.getDate() - 1);
    const last24HoursISO = last24Hours.toISOString();

    const inboxResponse = await axios.get(
      "https://graph.microsoft.com/v1.0/me/mailFolders/inbox",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const inboxFolderId = inboxResponse.data.id;

    const apiUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${inboxFolderId}/messages?$filter=inferenceClassification eq 'focused' and isRead eq false and receivedDateTime ge ${last24HoursISO}&$top=10&$select=subject,from,receivedDateTime,body`;

    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    });

    let outlookunReamdEmails: Array<any> = [];

    const outlookemails = response.data.value;
    if (outlookemails.length === 0) {
      outlookunReamdEmails = [];
    } else {
      outlookemails.forEach((email: any, index: number) => {
        let body: string = email.body.content;

        let bodytext = htmlToText(body, {
          wordwrap: 130,
          preserveNewlines: true,
          selectors: [
            { selector: "div.preview", format: "skip" },
            { selector: "div.footer", format: "skip" },
            { selector: "img", format: "skip" },
            { selector: "style", format: "skip" },
            { selector: "table.emailSeparator-mtbezJ", format: "skip" },
          ],
        }).trim();

        bodytext = bodytext.replace(/https?:\/\/[^\s]+/g, "").trim();

        outlookunReamdEmails.push({
          from: email.from.emailAddress.address,
          subject: email.subject,
          timestamp: new Date(email.receivedDateTime),
          body: bodytext,
        });
      });
    }

    const summarizedEmails: Array<any> = [];

    for (const email of outlookunReamdEmails) {
      const summary = await summarizeEmailsWithLLM(email.body);
      if (summary) {
        summarizedEmails.push({
          body: summary,
          subject: email.subject,
          timestamp: email.timestamp,
          from: email.from,
        });
      } else {
        summarizedEmails.push({
          body: email.body,
          subject: email.subject,
          timestamp: email.timestamp,
          from: email.from,
        });
      }
    }

    return summarizedEmails;
  } catch (err) {
    console.log(err.response.data);
    return null;
  }
};

const getGoogleCalenderEvents = async (
  access_token: string
): Promise<null | any> => {
  try {
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    const timeMin = now.toISOString();
    const timeMax = sevenDaysLater.toISOString();

    const response = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        timeMin
      )}&timeMax=${encodeURIComponent(
        timeMax
      )}&orderBy=startTime&singleEvents=true&maxAttendees=100`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const eventsData: Array<any> = response.data.items.map((item: any) => ({
      title: item.summary || "No Title", // Event title
      description: item.description || "No Description", // Event description
      location: item.location || "No Location", // Event location
      start: item.start.dateTime || item.start.date, // Start time
      end: item.end.dateTime || item.end.date, // End time
      attendees: item.attendees
        ? item.attendees.map((attendee: any) => ({
            email: attendee.email,
            responseStatus: attendee.responseStatus || "needsAction",
          }))
        : [],
    }));

    return eventsData;
  } catch (err) {
    console.log(err.response.data);
    return null;
  }
};

const getOutlookCalenderEvents = async (
  access_token: string
): Promise<null | any> => {
  try {
    const now = new Date();
    const startTime = now.toISOString();

    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);
    const endTime = sevenDaysLater.toISOString();

    // Microsoft Graph API URL for fetching events
    const apiUrl = `https://graph.microsoft.com/v1.0/me/calendar/events?$filter=start/dateTime ge '${startTime}' and start/dateTime le '${endTime}'&$orderby=start/dateTime&$select=subject,start,end,location,body,attendees`;

    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    });

    const events = response.data.value;

    let eventsData: Array<any> = [];

    if (events.length === 0) {
      return [];
    }

    events.forEach((event: any) => {
      let bodytext = htmlToText(event.body.content, {
        wordwrap: 130,
        preserveNewlines: true,
        selectors: [
          { selector: "div.preview", format: "skip" },
          { selector: "div.footer", format: "skip" },
          { selector: "img", format: "skip" },
          { selector: "style", format: "skip" },
          { selector: "table.emailSeparator-mtbezJ", format: "skip" },
        ],
      }).trim();

      bodytext = bodytext.replace(/https?:\/\/[^\s]+/g, "").trim();

      const attendees =
        event.attendees?.map((attendee: any) => ({
          email: attendee.emailAddress.address,
          responseStatus: attendee.status.response || "notResponded",
        })) || [];

      eventsData.push({
        title: event.subject || "No Subject",
        Start: `${event.start.dateTime} (${event.start.timeZone})`,
        End: `${event.end.dateTime} (${event.end.timeZone})`,
        Location: event.location?.displayName || "N/A",
        description: bodytext,
        attendees: attendees,
      });
    });

    return eventsData;
  } catch (err) {
    console.log(err.response.data);
    return null;
  }
};

const getGoogleEmailsFromSpecificSender = async (
  access_token: string,
  searchQuery: string
): Promise<null | any> => {
  try {
    const last24Hours = new Date();
    last24Hours.setDate(last24Hours.getDate() - 1);

    const listResponse = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: {
          q: `"${searchQuery}" category:primary`,
          maxResults: 10,
        },
      }
    );

    const messages = listResponse.data.messages || [];

    const unreadEmails = await Promise.all(
      messages.map(async (message: any) => {
        const msgResponse = await axios.get(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          {
            headers: { Authorization: `Bearer ${access_token}` },
            params: { format: "full" },
          }
        );

        const { payload, snippet, internalDate } = msgResponse.data;
        const headers = payload.headers || [];

        const subjectHeader = headers.find((h: any) => h.name === "Subject");
        const fromHeader = headers.find((h: any) => h.name === "From");

        const subject = subjectHeader ? subjectHeader.value : "No Subject";
        const from = fromHeader ? fromHeader.value : "Unknown Sender";

        let body = "";
        if (payload.parts) {
          const textPart = payload.parts.find(
            (part: any) => part.mimeType === "text/plain"
          );
          const htmlPart = payload.parts.find(
            (part: any) => part.mimeType === "text/html"
          );
          body =
            textPart && textPart.body.data
              ? decodeBase64Url(textPart.body.data)
              : htmlPart && htmlPart.body.data
              ? decodeBase64Url(htmlPart.body.data)
              : "No readable content";
        } else if (payload.body && payload.body.data) {
          body = decodeBase64Url(payload.body.data);
        }

        let bodytext = htmlToText(body, {
          wordwrap: 130,
          preserveNewlines: true,
          selectors: [
            { selector: "div.preview", format: "skip" },
            { selector: "div.footer", format: "skip" },
            { selector: "img", format: "skip" },
            { selector: "style", format: "skip" },
            { selector: "table.emailSeparator-mtbezJ", format: "skip" },
          ],
        }).trim();

        bodytext = bodytext.replace(/https?:\/\/[^\s]+/g, "").trim();

        return {
          body: bodytext,
          timestamp: new Date(Number(internalDate)),
          subject: subject,
          from: from,
        };
      })
    );

    const filteredUnreadEmails = unreadEmails.filter(
      (email: any) =>
        email.timestamp >= last24Hours &&
        email.from.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const summarizedEmails: Array<any> = [];

    for (const email of filteredUnreadEmails) {
      const summary = await summarizeEmailsWithLLM(email.body);
      if (summary) {
        summarizedEmails.push({
          body: summary,
          subject: email.subject,
          timestamp: email.timestamp,
          from: email.from,
        });
      } else {
        summarizedEmails.push({
          body: email.body,
          subject: email.subject,
          timestamp: email.timestamp,
          from: email.from,
        });
      }
    }

    return summarizedEmails;
  } catch (err) {
    console.log(err.response.data);
    return null;
  }
};

const getOutlookEmailsFromSpecificSender = async (
  access_token: string,
  searchName: string
): Promise<null | any> => {
  try {
    const last24HoursISO = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    const inboxResponse = await axios.get(
      "https://graph.microsoft.com/v1.0/me/mailFolders/inbox",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const inboxFolderId = inboxResponse.data.id;

    const apiUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${inboxFolderId}/messages?$filter=inferenceClassification eq 'focused' and (contains(from/emailAddress/address, '${encodeURIComponent(
      searchName
    )}') or contains(subject, '${encodeURIComponent(
      searchName
    )}') or contains(body/content, '${encodeURIComponent(
      searchName
    )}')) and receivedDateTime ge ${last24HoursISO}&$top=10&$select=subject,from,receivedDateTime,body`;

    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    });

    let outlookUnreadEmails: Array<any> = [];

    const outlookemails = response.data.value;

    if (outlookemails.length === 0) {
      return [];
    }

    outlookemails.forEach((email: any) => {
      let body: string = email.body.content;

      let bodytext = htmlToText(body, {
        wordwrap: 130,
        preserveNewlines: true,
        selectors: [
          { selector: "div.preview", format: "skip" },
          { selector: "div.footer", format: "skip" },
          { selector: "img", format: "skip" },
          { selector: "style", format: "skip" },
          { selector: "table.emailSeparator-mtbezJ", format: "skip" },
        ],
      }).trim();

      bodytext = bodytext.replace(/https?:\/\/[^\s]+/g, "").trim();

      outlookUnreadEmails.push({
        from: email.from.emailAddress.name,
        subject: email.subject,
        body: bodytext,
        timestamp: new Date(email.receivedDateTime),
      });
    });

    const summarizedEmails: Array<any> = [];

    for (const email of outlookUnreadEmails) {
      const summary = await summarizeEmailsWithLLM(email.body);
      if (summary) {
        summarizedEmails.push({
          body: summary,
          subject: email.subject,
          timestamp: email.timestamp,
          from: email.from,
        });
      } else {
        summarizedEmails.push({
          body: email.body,
          subject: email.subject,
          timestamp: email.timestamp,
          from: email.from,
        });
      }
    }

    return summarizedEmails;
  } catch (err) {
    console.log(err.response.data);
    return null;
  }
};

export const getUnreadEmails: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    let google_emails: Array<any> = [];
    let outlook_emails: Array<any> = [];

    if (user.google_login) {
      google_emails = await getGoogleEmails(user.google_access_token);

      if (!google_emails) {
        return badRequestResponse(res, "No emails found");
      }
    }

    if (user.outlook_login) {
      outlook_emails = await getOutlookEmails(user.outlook_access_token);

      if (!outlook_emails) {
        return badRequestResponse(res, "No emails found");
      }
    }

    return res.status(200).json({
      success: true,
      google_emails: user.google_login
        ? google_emails.length > 0
          ? google_emails
          : "No unread emails in your gmail account"
        : [],
      outlook_emails: user.outlook_login
        ? outlook_emails.length > 0
          ? outlook_emails
          : "No unread emails in your outlook account"
        : [],
    });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const getEmailsUsingSearchQuery: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    const { searchField } = req.params;

    if (!searchField.trim()) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

    let google_emails: Array<any> = [];
    let outlook_emails: Array<any> = [];

    if (user.google_login) {
      google_emails = await getGoogleEmailsFromSpecificSender(
        user.google_access_token,
        searchField.trim()
      );

      if (!google_emails) {
        return badRequestResponse(res, "No emails found");
      }
    }

    if (user.outlook_login) {
      outlook_emails = await getOutlookEmailsFromSpecificSender(
        user.outlook_access_token,
        searchField.trim()
      );

      if (!outlook_emails) {
        return badRequestResponse(res, "No emails found");
      }
    }

    return res.status(200).json({
      success: true,
      google_emails: user.google_login
        ? google_emails.length > 0
          ? google_emails
          : "No emails found for this name"
        : [],
      outlook_emails: user.outlook_login
        ? outlook_emails.length > 0
          ? outlook_emails
          : "No emails found for this name"
        : [],
    });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const getCalenderEvents: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    let google_calender_events: Array<any> = [];
    let outlook_calender_events: Array<any> = [];

    if (user.google_login) {
      google_calender_events = await getGoogleCalenderEvents(
        user.google_access_token
      );

      if (!google_calender_events) {
        return badRequestResponse(res, "No events in google calender");
      }
    }

    if (user.outlook_login) {
      outlook_calender_events = await getOutlookCalenderEvents(
        user.outlook_access_token
      );

      if (!outlook_calender_events) {
        return badRequestResponse(res, "No events in outlook calender");
      }
    }

    return res.status(200).json({
      success: true,
      google_calender_events: user.google_login
        ? google_calender_events.length > 0
          ? google_calender_events
          : "No events in your google calender"
        : [],
      outlook_calender_events: user.outlook_login
        ? outlook_calender_events.length > 0
          ? outlook_calender_events
          : "No events in your outlook calender"
        : [],
    });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const getCurrentDateTime: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const datetime = new Date();
    datetime.setUTCHours(datetime.getUTCHours() - 7);

    return res.status(200).json({ date: datetime.toLocaleString() });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const notionClientApiTesting: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user) {
      return notFoundResponse(res);
    }

    if (!user.notion_login) {
      return badRequestResponse(res, "User is not connected with notion");
    }

    const notion = new Client({ auth: user.notion_access_token });

    const searchResponse = await notion.search({
      filter: {
        value: "page",
        property: "object",
      },
    });

    let allContent = "";

    for (const item of searchResponse.results as any) {
      if (item.object === "database") {
        const databaseContent = await extractDatabaseContent(item.id, notion);
        allContent += databaseContent + "\n\n";
      } else if (item.object === "page") {
        const pageTitle = getPageTitle(item);

        const blocks = await retrieveBlockChildren(item.id, 0, notion);
        const pageContent = formatPageContent(item, blocks);
        allContent += pageContent + "\n\n---\n\n";
      }
    }

    console.log("\nGenerating summary...");
    const summary = await summarizeWithLLM(allContent);
    if (!summary) {
      return badRequestResponse(res, "Try again something went wrong");
    }
    console.log("\nDone generating summary...");

    return res.status(200).json({ success: true, message: summary });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const getProductHuntPosts: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { topic } = req.params;

    const datetime = new Date();
    datetime.setUTCDate(datetime.getUTCDate() - 1);
    datetime.setUTCHours(datetime.getUTCHours() - 7);

    const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PRODUCT_HUNT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query {
          posts(first: 10, order: VOTES, topic: "${topic}", postedAfter: "${datetime}") {
            edges {
              node {
                name
                tagline
                description
                votesCount
              }
            }
          }
        }`,
      }),
    });

    const result = await response.json();

    if (result.errors) {
      return badRequestResponse(res, "Something went wrong");
    }

    const formattedProducts = result.data.posts.edges.map(
      (edge: any, index: any) => {
        const product = edge.node;
        return {
          rank: index + 1,
          name: product.name,
          tagline: product.tagline,
          description: product.description,
          votes: product.votesCount,
        };
      }
    );

    return res.status(200).json({ success: true, message: formattedProducts });
  } catch (err) {
    console.log(err.response.data);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const concatenateallApis: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    let google_emails: Array<any> = [];
    let outlook_emails: Array<any> = [];

    let google_calender_events: Array<any> = [];
    let outlook_calender_events: Array<any> = [];

    if (user.google_login) {
      google_emails = await getGoogleEmails(user.google_access_token);
    }

    if (user.outlook_login) {
      outlook_emails = await getOutlookEmails(user.outlook_access_token);
    }

    if (user.google_login) {
      google_calender_events = await getGoogleCalenderEvents(
        user.google_access_token
      );
    }

    if (user.outlook_login) {
      outlook_calender_events = await getOutlookCalenderEvents(
        user.outlook_access_token
      );
    }

    let notion_summary = null;

    if (user.notion_login) {
      const notion = new Client({ auth: user.notion_access_token });

      const searchResponse = await notion.search({
        filter: {
          value: "page",
          property: "object",
        },
      });

      let allContent = "";

      for (const item of searchResponse.results as any) {
        if (item.object === "database") {
          const databaseContent = await extractDatabaseContent(item.id, notion);
          allContent += databaseContent + "\n\n";
        } else if (item.object === "page") {
          const pageTitle = getPageTitle(item);

          const blocks = await retrieveBlockChildren(item.id, 0, notion);
          const pageContent = formatPageContent(item, blocks);
          allContent += pageContent + "\n\n---\n\n";
        }
      }

      console.log("\nGenerating summary...");
      notion_summary = await summarizeWithLLM(allContent);
      console.log("\nDone generating summary...");
    }

    return res.status(200).json({
      success: true,
      google_emails:
        google_emails && google_emails.length > 0
          ? google_emails
          : "No unread emails in your gmail account",
      outlook_emails:
        outlook_emails && outlook_emails.length > 0
          ? outlook_emails
          : "No unread emails in your outlook account",
      google_calender_events:
        google_calender_events && google_calender_events.length > 0
          ? google_calender_events
          : "No events in your google calender",
      outlook_calender_events:
        outlook_calender_events && outlook_calender_events.length > 0
          ? outlook_calender_events
          : "No events in your outlook calender",
      notion_summary: notion_summary && notion_summary,
    });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const perplexityApi: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiUrl = "https://api.perplexity.ai/chat/completions";
    const token = process.env.PERPLEXITY_API_KEY;

    const requestData = {
      model: "sonar",
      messages: [
        { role: "system", content: "Be precise and concise." },
        { role: "user", content: "how is the weather today in san francisco?" },
      ],
      max_tokens: 123,
      temperature: 0.2,
      top_p: 0.9,
      return_images: false,
      return_related_questions: false,
      search_recency_filter: "day",
      top_k: 0,
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 1,
      response_format: { type: "text" },
      web_search_options: {
        search_context_size: "high",
      },
    };

    const response = await axios.post(apiUrl, requestData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    return res.status(200).json({
      success: true,
      message: response.data.choices[0].message.content,
    });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};
