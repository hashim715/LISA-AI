import axios from "axios";
import { decodeBase64Url } from "../utils/decodeBase64Url";
import { htmlToText } from "html-to-text";
import { summarizeEmailsWithLLM } from "./chatgptFuncs";
import base64url from "base64url";

export const getGoogleEmails = async (
  access_token: string
): Promise<null | any> => {
  try {
    const oneDayAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    const params = {
      q: `is:unread category:primary after:${oneDayAgo}`,
      maxResults: 10,
    };

    const listResponse = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: params,
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

    const summarizedEmails: Array<any> = [];

    for (const email of unreadEmails) {
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
  } catch (err: any) {
    console.log(
      "get google unread emails error:",
      err.response?.data || err.message || err
    );
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
  } catch (err: any) {
    console.log(
      "get Google Calendar Error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const getGoogleEmailsFromSpecificSender = async (
  access_token: string,
  searchQuery: string
): Promise<null | any> => {
  try {
    const oneDayAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    const params = {
      q: `"${searchQuery}" category:primary after:${oneDayAgo}`,
      maxResults: 10,
    };

    const listResponse = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: params,
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

    const summarizedEmails: Array<any> = [];

    for (const email of unreadEmails) {
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
  } catch (err: any) {
    console.log(
      "get emails using search query Error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const addGoogleCalenderEventFunc = async (
  access_token: string,
  summary: string,
  description: string,
  location: string,
  start: any,
  end: any,
  attendees: any
) => {
  const calendarId = "primary"; // default calendar
  const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

  const event = {
    summary: summary,
    description: description,
    location: location,
    start: start,
    end: end,
    attendees: attendees,
    reminders: {
      useDefault: true,
    },
  };

  try {
    const response = await axios.post(apiUrl, event, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    console.log("Error creating event:", error.response?.data || error.message);
    return null;
  }
};

export const createGmailDraft = async (
  access_token: string,
  sender_email: string,
  reciever_email: string,
  sender_name: string,
  subject: string,
  bodyContent: string
) => {
  // 1. Correct MIME message with CRLF (\r\n)
  const emailLines = [
    `From: ${sender_name} <${sender_email}>`,
    `To: <${reciever_email}>`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    `${bodyContent}`,
  ];

  const rawMessage = emailLines.join("\r\n");

  // 2. Base64url encode the message
  const encodedMessage = base64url.encode(rawMessage);

  const body = {
    message: {
      raw: encodedMessage,
    },
  };

  try {
    const response = await axios.post(
      "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
      body,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (err: any) {
    console.log("Error creating draft:", err.response?.data || err.message);
    return null;
  }
};

export const createGmailReplyDraft = async (
  access_token: string,
  sender_email: string,
  reciever_email: string,
  sender_name: string,
  subject: string,
  bodyContent: string,
  threadId: string,
  messageId: string
) => {
  // Construct MIME message with correct reply headers
  const emailLines = [
    `From: ${sender_name} <${sender_email}>`,
    `To: ${reciever_email}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${messageId}`,
    `References: ${messageId}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    `${bodyContent}`,
  ];

  const rawMessage = emailLines.join("\r\n");

  const encodedMessage = base64url.encode(rawMessage);

  const body = {
    message: {
      raw: encodedMessage,
      threadId: threadId,
    },
  };

  try {
    const response = await axios.post(
      "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
      body,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (err: any) {
    console.log(
      "Error creating reply draft:",
      err.response?.data || err.message
    );
    return null;
  }
};

export const getReplySenderEmailsUsingSearchQuery = async (
  searchQuery: string,
  access_token: string
) => {
  try {
    const oneDayAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    const params = {
      q: `"${searchQuery}" category:primary after:${oneDayAgo}`,
      maxResults: 10,
    };

    const listResponse = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: params,
      }
    );

    const messages = listResponse.data.messages || [];

    const replyEmailMetaData = await Promise.all(
      messages.map(async (message: any) => {
        const msgResponse = await axios.get(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          {
            headers: { Authorization: `Bearer ${access_token}` },
            params: { format: "full" },
          }
        );

        const { payload } = msgResponse.data;
        const headers = payload.headers || [];

        const subjectHeader = headers.find((h: any) => h.name === "Subject");
        const fromHeader = headers.find((h: any) => h.name === "From");

        const subject = subjectHeader ? subjectHeader.value : "No Subject";
        const from = fromHeader ? fromHeader.value : "Unknown Sender";

        return {
          messageId: message.id,
          threadId: message.threadId,
          subject: subject,
          from: from,
        };
      })
    );

    return replyEmailMetaData;
  } catch (err: any) {
    console.log(
      "get emails using search query for reply draft Error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const getSenderEmailsUsingSearchQuery = async (
  searchQuery: string,
  access_token: string
) => {
  try {
    const oneDayAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

    const params = {
      q: `"${searchQuery}" category:primary after:${oneDayAgo}`,
    };

    const listResponse = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: params,
      }
    );

    const messages = listResponse.data.messages || [];

    const replyEmailMetaData = await Promise.all(
      messages.map(async (message: any) => {
        const msgResponse = await axios.get(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          {
            headers: { Authorization: `Bearer ${access_token}` },
            params: { format: "full" },
          }
        );

        const { payload } = msgResponse.data;
        const headers = payload.headers || [];

        const subjectHeader = headers.find((h: any) => h.name === "Subject");
        const fromHeader = headers.find((h: any) => h.name === "From");

        const subject = subjectHeader ? subjectHeader.value : "No Subject";
        const from = fromHeader ? fromHeader.value : "Unknown Sender";

        return {
          from: from,
        };
      })
    );

    return replyEmailMetaData;
  } catch (err: any) {
    console.log(
      "get emails using search query for reply draft Error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};
