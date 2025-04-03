import axios from "axios";
import { decodeBase64Url } from "../utils/decodeBase64Url";
import { htmlToText } from "html-to-text";
import { summarizeEmailsWithLLM } from "./chatgptFuncs";

export const getGoogleEmails = async (
  access_token: string
): Promise<null | any> => {
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

export const getGoogleCalenderEvents = async (
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

export const getGoogleEmailsFromSpecificSender = async (
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
