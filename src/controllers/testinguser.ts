import { prisma } from "../config/postgres";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { htmlToText } from "html-to-text";
import axios from "axios";
import jwt_decode from "jwt-decode";
import { decodeBase64Url } from "../utils/decodeBase64Url";
import {
  internalServerError,
  badRequestResponse,
  unauthorizedErrorResponse,
  notFoundResponse,
} from "./errors";
import { Client } from "@notionhq/client";
import {
  extractDatabaseContent,
  getPageTitle,
  retrieveBlockChildren,
  formatPageContent,
  summarizeWithLLM,
} from "../utils/notionFuncs";

const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IjVjN2FjNzkzLWYxZGYtNGM5Ni1iOGI0LWE2Y2QyNmI5ODFkYiIsImlhdCI6MTc0MzI3NDc2NSwiZXhwIjoxNzQ0MTM4NzY1fQ.iEovW8MWHBMizTOQl8j6klg-0CvrNRbtDgLKPxWccGI";

const getGoogleEmails = async (access_token: string): Promise<null | any> => {
  try {
    const last24Hours = new Date();
    last24Hours.setDate(last24Hours.getDate() - 1);
    const last24HoursISO = last24Hours.toISOString();

    // List unread emails
    const listResponse = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { q: "is:unread category:primary", maxResults: 10 }, // Filter for unread, limit to 10
      }
    );

    const messages = listResponse.data.messages || [];

    // Fetch details for each unread email
    const unreadEmails = await Promise.all(
      messages.map(async (message: any) => {
        const msgResponse = await axios.get(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          {
            headers: { Authorization: `Bearer ${access_token}` },
            params: { format: "full" }, // Optimize for headers
          }
        );

        const { payload, snippet, internalDate } = msgResponse.data;
        const headers = payload.headers || [];

        // Extract subject and from fields
        const subjectHeader = headers.find((h: any) => h.name === "Subject");
        const fromHeader = headers.find((h: any) => h.name === "From");

        const subject = subjectHeader ? subjectHeader.value : "No Subject";
        const from = fromHeader ? fromHeader.value : "Unknown Sender";

        // Extract email body (plain text or HTML)
        let body = "";
        if (payload.parts) {
          // Multipart email (e.g., text/plain and text/html)
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
          // Single-part email (e.g., plain text only)
          body = decodeBase64Url(payload.body.data);
        }

        let bodytext = htmlToText(body, {
          wordwrap: 130,
          preserveNewlines: true,
          selectors: [
            { selector: "div.preview", format: "skip" }, // Skip hidden preview text
            { selector: "div.footer", format: "skip" }, // Skip footer (unsubscribe, etc.)
            { selector: "img", format: "skip" }, // Skip tracking pixels
            { selector: "style", format: "skip" }, // Skip CSS
            { selector: "table.emailSeparator-mtbezJ", format: "skip" },
          ],
        }).trim();

        bodytext = bodytext.replace(/https?:\/\/[^\s]+/g, "").trim();

        return {
          id: msgResponse.data.id,
          body: bodytext,
          timestamp: new Date(Number(internalDate)),
          subject: subject,
          from: from,
        };
      })
    );

    const filteredUnreadEmails = unreadEmails.filter(
      (email: any) => email.timestamp >= last24Hours
    );

    return filteredUnreadEmails;
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

    const inboxFolderId = inboxResponse.data.id; // Inbox folder ID

    // Fetch unread focused emails from inbox (excluding junk)
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
            { selector: "div.preview", format: "skip" }, // Skip hidden preview text
            { selector: "div.footer", format: "skip" }, // Skip footer (unsubscribe, etc.)
            { selector: "img", format: "skip" }, // Skip tracking pixels
            { selector: "style", format: "skip" }, // Skip CSS
            { selector: "table.emailSeparator-mtbezJ", format: "skip" },
          ],
        }).trim();

        bodytext = bodytext.replace(/https?:\/\/[^\s]+/g, "").trim();

        outlookunReamdEmails.push({
          From: email.from.emailAddress.address,
          Subject: email.subject,
          Body: bodytext,
        });
      });
    }

    return outlookunReamdEmails;
  } catch (err) {
    console.log(err);
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

    const timeMin = now.toISOString(); // Start time: Now
    const timeMax = sevenDaysLater.toISOString(); // End time: 7 days from now

    const response = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        timeMin
      )}&timeMax=${encodeURIComponent(
        timeMax
      )}&orderBy=startTime&singleEvents=true`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const eventsData: Array<any> = [];

    response.data.items.forEach((item: any) => {
      eventsData.push({
        description: item.description,
        start: item.start,
        end: item.end,
      });
    });

    return eventsData;
  } catch (err) {
    return null;
  }
};

const getOutlookCalenderEvents = async (
  access_token: string
): Promise<null | any> => {
  try {
    // Get the current date and time in ISO format
    const now = new Date();
    const startTime = now.toISOString(); // Start from current time

    // Get the date 7 days from now
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);
    const endTime = sevenDaysLater.toISOString(); // End after 7 days

    // Microsoft Graph API URL for fetching events
    const apiUrl = `https://graph.microsoft.com/v1.0/me/calendar/events?$filter=start/dateTime ge '${startTime}' and start/dateTime le '${endTime}'&$orderby=start/dateTime&$select=subject,start,end,location,body`;

    // API request
    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    });

    const events = response.data.value;

    let eventsData: Array<any> = [];

    if (events.length === 0) {
      eventsData = [];
    } else {
      events.forEach((event: any, index: any) => {
        let bodytext = htmlToText(event.body.content, {
          wordwrap: 130,
          preserveNewlines: true,
          selectors: [
            { selector: "div.preview", format: "skip" }, // Skip hidden preview text
            { selector: "div.footer", format: "skip" }, // Skip footer (unsubscribe, etc.)
            { selector: "img", format: "skip" }, // Skip tracking pixels
            { selector: "style", format: "skip" }, // Skip CSS
            { selector: "table.emailSeparator-mtbezJ", format: "skip" },
          ],
        }).trim();

        bodytext = bodytext.replace(/https?:\/\/[^\s]+/g, "").trim();

        eventsData.push({
          Subject: event.subject,
          Start: `${event.start.dateTime} (${event.start.timeZone}`,
          End: `${event.end.dateTime} (${event.end.timeZone}`,
          Location: `${event.location.displayName || "N/A"}`,
          body: bodytext,
        });
      });
    }

    return eventsData;
  } catch (err) {
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

    // Search for emails using the name
    const listResponse = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: {
          q: `"${searchQuery}" category:primary`, // Search for the name
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

        // Extract subject and from fields
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
          id: msgResponse.data.id,
          body: bodytext,
          timestamp: new Date(Number(internalDate)),
          subject: subject,
          from: from,
        };
      })
    );

    // Filter emails where the sender's name contains "Aazar"
    const filteredUnreadEmails = unreadEmails.filter(
      (email: any) =>
        email.timestamp >= last24Hours &&
        email.from.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filteredUnreadEmails;
  } catch (err) {
    console.log(err);
    return null;
  }
};

const getOutlookEmailsFromSpecificSender = async (
  access_token: string,
  searchName: string
): Promise<null | any> => {
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

    const inboxFolderId = inboxResponse.data.id; // Inbox folder ID

    // Update the API URL to search by sender's name instead of email
    const apiUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${inboxFolderId}/messages?$filter=inferenceClassification eq 'focused' and contains(from/emailAddress/name, '${searchName}') and receivedDateTime ge ${last24HoursISO}&$top=10&$select=subject,from,receivedDateTime,body`;

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
          { selector: "div.preview", format: "skip" }, // Skip hidden preview text
          { selector: "div.footer", format: "skip" }, // Skip footer (unsubscribe, etc.)
          { selector: "img", format: "skip" }, // Skip tracking pixels
          { selector: "style", format: "skip" }, // Skip CSS
          { selector: "table.emailSeparator-mtbezJ", format: "skip" },
        ],
      }).trim();

      bodytext = bodytext.replace(/https?:\/\/[^\s]+/g, "").trim();

      outlookUnreadEmails.push({
        From: email.from.emailAddress.name, // Use sender's name
        Email: email.from.emailAddress.address, // Include sender's email
        Subject: email.subject,
        Body: bodytext,
        Timestamp: email.receivedDateTime,
      });
    });

    return outlookUnreadEmails;
  } catch (err) {
    console.log(err);
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
    console.log(err);
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
    console.log(err);
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
    const currentDateTime = new Date().toISOString();

    return res.status(200).json({ date: currentDateTime });
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

    // Process each result
    for (const item of searchResponse.results as any) {
      if (item.object === "database") {
        console.log(
          `\nProcessing database: ${
            item.title[0]?.plain_text || "Untitled Database"
          }`
        );
        const databaseContent = await extractDatabaseContent(item.id, notion);
        allContent += databaseContent + "\n\n";
      } else if (item.object === "page") {
        const pageTitle = getPageTitle(item);
        console.log(`\nProcessing page: ${pageTitle}`);
        console.log(`Page URL: ${item.url}`);

        const blocks = await retrieveBlockChildren(item.id, 0, notion);
        const pageContent = formatPageContent(item, blocks);
        allContent += pageContent + "\n\n---\n\n";
      }
    }

    // Generate summary
    console.log("\nGenerating summary...");
    const summary = await summarizeWithLLM(allContent);

    return res.status(200).json({ success: true, message: summary });
  } catch (err) {
    console.log(err);
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
    const { date } = req.params;

    const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PRODUCT_HUNT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query {
          posts(first: 10, order: VOTES, postedAfter: "${date}") {
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

    // Check for errors
    if (result.errors) {
      return badRequestResponse(res, "Something went wrong");
    }

    // Format the output
    let output =
      "🏆 Top 10 Product Hunt Posts (Since ${yesterday_date}) 🏆\n\n";
    result.data.posts.edges.forEach((edge: any, index: any) => {
      const post = edge.node;
      output += `${index + 1}. ${post.name}\n`;
      output += `   ${post.tagline}\n`;
      output += `   Number of Votes: ${post.votesCount}\n`;
      if (post.description) {
        output += `   ${post.description}\n`;
      }
      output += "---\n";
    });

    return res.status(200).json({ success: true, message: output });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};
