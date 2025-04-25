import axios from "axios";
import { decodeBase64Url } from "../utils/decodeBase64Url";
import { htmlToText } from "html-to-text";
import { summarizeEmailsWithLLM } from "./chatgptFuncs";
import base64url from "base64url";
import { DateTime } from "luxon";
import { Email, CalenderEvent } from "./types";
import { logger } from "./logger";

// Shared email summarization function
const summarizeEmailArray = async (
  emails: Array<Email>
): Promise<Array<Email>> => {
  const summarizedEmails: Array<Email> = [];

  const summarizedEmailResults = await Promise.allSettled(
    emails.map(async (email) => {
      const summary = await summarizeEmailsWithLLM(email.body || "");
      return {
        ...email,
        body: summary || email.body,
      };
    })
  );

  summarizedEmailResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      summarizedEmails.push(result.value);
    } else {
      logger.error(
        `LLM summarization error at email from ${emails[index].from}:`,
        result.reason
      );
    }
  });

  return summarizedEmails;
};

export const getGoogleEmails = async (
  access_token: string,
  timezone: string
): Promise<Array<Email>> => {
  if (!DateTime.now().setZone(timezone).isValid) {
    throw new Error("Invalid timezone");
  }

  const now = DateTime.now().setZone(timezone);
  const twentyFourHoursAgo = now.minus({ hours: 24 }).toUTC();
  const nowUtc = now.toUTC();

  const after = Math.floor(twentyFourHoursAgo.toSeconds());
  const before = Math.floor(nowUtc.toSeconds());

  const params = {
    q: `is:unread category:primary after:${after} before:${before}`,
    maxResults: 10,
  };

  const listResponse = await axios
    .get("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
      headers: { Authorization: `Bearer ${access_token}` },
      params: params,
    })
    .catch((err) => {
      logger.error("Gmail API list error:", err.response?.data || err.message);
      throw new Error("Failed to fetch Gmail message list");
    });

  const messages = listResponse.data.messages || [];
  if (messages.length === 0) return [];

  const unreadEmailResults = await Promise.allSettled(
    messages.map(async (message: { id: string }) => {
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

  const unreadEmails: Array<Email> = [];
  const emailsToMark: Array<{ id: string }> = [];
  unreadEmailResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      unreadEmails.push(result.value);
      emailsToMark.push({ id: messages[index].id });
    } else {
      logger.error(
        `Failed to fetch Gmail email ${messages[index].id}:`,
        result.reason
      );
    }
  });

  // Mark emails as read concurrently, without blocking summarization
  if (emailsToMark.length > 0) {
    markGoogleEmailsAsRead(emailsToMark, access_token).catch((err) => {
      logger.error("Unexpected error occurred", err);
    });
  }

  return summarizeEmailArray(unreadEmails);
};

export const getLatestUnreadGoogleEmails = async (
  access_token: string,
  timezone: string
): Promise<Array<Email>> => {
  if (!DateTime.now().setZone(timezone).isValid) {
    throw new Error("Invalid timezone");
  }

  const now = DateTime.now().setZone(timezone);
  const twentyFourHoursAgo = now.minus({ hours: 24 }).toUTC();
  const nowUtc = now.toUTC();

  const after = Math.floor(twentyFourHoursAgo.toSeconds());
  const before = Math.floor(nowUtc.toSeconds());

  const params = {
    q: `category:primary is:unread after:${after} before:${before}`,
    maxResults: 3,
  };

  const listResponse = await axios
    .get("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
      headers: { Authorization: `Bearer ${access_token}` },
      params: params,
    })
    .catch((err) => {
      logger.error("Gmail API list error:", err.response?.data || err.message);
      throw new Error("Failed to fetch Gmail message list");
    });

  const messages = listResponse.data.messages || [];
  if (messages.length === 0) return [];

  const emailResults = await Promise.allSettled(
    messages.map(async (message: { id: string }) => {
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

  const unreadEmails: Array<any> = [];
  const emailsToMark: Array<{ id: string }> = [];
  emailResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      unreadEmails.push(result.value);
      emailsToMark.push({ id: messages[index].id });
    } else {
      logger.error(
        `Failed to fetch Gmail email ${messages[index].id}:`,
        result.reason
      );
    }
  });

  // Mark emails as read concurrently, without blocking summarization
  if (emailsToMark.length > 0) {
    markGoogleEmailsAsRead(emailsToMark, access_token).catch((err) => {
      logger.error("Unexpected error occurred", err);
    });
  }

  return summarizeEmailArray(unreadEmails);
};

export const getLatestReadGoogleEmails = async (
  access_token: string,
  timezone: string
): Promise<Array<Email>> => {
  if (!DateTime.now().setZone(timezone).isValid) {
    throw new Error("Invalid timezone");
  }

  const now = DateTime.now().setZone(timezone);
  const twentyFourHoursAgo = now.minus({ hours: 24 }).toUTC();
  const nowUtc = now.toUTC();

  const after = Math.floor(twentyFourHoursAgo.toSeconds());
  const before = Math.floor(nowUtc.toSeconds());

  const params = {
    q: `category:primary -is:unread after:${after} before:${before}`,
    maxResults: 3,
  };

  const listResponse = await axios
    .get("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
      headers: { Authorization: `Bearer ${access_token}` },
      params: params,
    })
    .catch((err) => {
      logger.error("Gmail API list error:", err.response?.data || err.message);
      throw new Error("Failed to fetch Gmail message list");
    });

  const messages = listResponse.data.messages || [];
  if (messages.length === 0) return [];

  const emailResults = await Promise.allSettled(
    messages.map(async (message: { id: string }) => {
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

  const unreadEmails: Array<any> = [];
  const emailsToMark: Array<{ id: string }> = [];
  emailResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      unreadEmails.push(result.value);
      emailsToMark.push({ id: messages[index].id });
    } else {
      logger.error(
        `Failed to fetch Gmail email ${messages[index].id}:`,
        result.reason
      );
    }
  });

  // Mark emails as read concurrently, without blocking summarization
  if (emailsToMark.length > 0) {
    markGoogleEmailsAsRead(emailsToMark, access_token).catch((err) => {
      logger.error("Unexpected error occurred", err);
    });
  }

  return summarizeEmailArray(unreadEmails);
};

export const markGoogleEmailsAsRead = async (
  messageIds: Array<{ id: string }>,
  access_token: string
) => {
  const results = await Promise.allSettled(
    messageIds.map(async (message: { id: string }) => {
      await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}/modify`,
        {
          removeLabelIds: ["UNREAD"],
        },
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );

      return { success: true };
    })
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error(
        `Failed to make email with id ${messageIds[index].id} as read:`,
        result.reason
      );
    }
  });
};

export const deleteSpecificGmail = async (
  messageId: string,
  access_token: string
): Promise<void> => {
  const response = await axios
    .delete(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    )
    .catch((err) => {
      logger.error("Gmail API list error:", err.response?.data || err.message);
      throw new Error(`Failed to delete email with id ${messageId} try again`);
    });

  // Optional: Check if status code is not 2xx and still throw manually (paranoid check)
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Failed to delete email with id ${messageId} try again`);
  }
};

export const getGoogleCalenderEvents = async (
  access_token: string,
  timezone: string
): Promise<Array<CalenderEvent>> => {
  if (!DateTime.now().setZone(timezone).isValid) {
    throw new Error("Invalid timezone");
  }

  const now = DateTime.now().setZone(timezone);
  const sevenDaysLater = now.plus({ days: 7 });

  // Convert both to UTC ISO format (required by Google Calendar API)
  const timeMin = now.toUTC().toISO();
  const timeMax = sevenDaysLater.toUTC().toISO();

  if (!timeMin || !timeMax) {
    throw new Error("Failed to convert time to ISO format");
  }

  const response = await axios
    .get(
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
    )
    .catch((err) => {
      logger.error(
        "Google Calender API list error:",
        err.response?.data || err.message
      );
      throw new Error(`Failed to fetch google calender events`);
    });

  const eventsData: Array<CalenderEvent> = response.data.items.map(
    (item: any) => ({
      id: item.id,
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
    })
  );

  return eventsData;
};

export const getGoogleEmailsFromSpecificSender = async (
  access_token: string,
  searchQuery: string,
  timezone: string
): Promise<Array<Email>> => {
  if (!DateTime.now().setZone(timezone).isValid) {
    throw new Error("Invalid timezone");
  }

  const now = DateTime.now().setZone(timezone);
  const twentyFourHoursAgo = now.minus({ hours: 72 }).toUTC();
  const nowUtc = now.toUTC();

  const after = Math.floor(twentyFourHoursAgo.toSeconds());
  const before = Math.floor(nowUtc.toSeconds());

  const params = {
    q: `"${searchQuery}" category:primary after:${after} before:${before}`,
    maxResults: 20,
  };

  const listResponse = await axios
    .get("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
      headers: { Authorization: `Bearer ${access_token}` },
      params: params,
    })
    .catch((err) => {
      logger.error("Gmail API list error:", err.response?.data || err.message);
      throw new Error("Failed to fetch Gmail message list");
    });

  const messages = listResponse.data.messages || [];
  if (messages.length === 0) return [];

  const emailResults = await Promise.allSettled(
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

  const emails: Array<any> = [];
  const emailsToMark: Array<{ id: string }> = [];
  emailResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      emails.push(result.value);
      emailsToMark.push({ id: messages[index].id });
    } else {
      logger.error(
        `Failed to fetch Gmail email ${messages[index].id}:`,
        result.reason
      );
    }
  });

  return summarizeEmailArray(emails);
};

export const addGoogleCalenderEventFunc = async (
  access_token: string,
  summary: string,
  description: string,
  location: string,
  start: { dateTime: string; timeZone: string },
  end: { dateTime: string; timeZone: string },
  attendees: Array<{ email: string }>
) => {
  const calendarId = "primary";
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

  const response = await axios
    .post(apiUrl, event, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    })
    .catch((err) => {
      logger.error(
        "Failed to add google calender event:",
        err.response?.data || err.message
      );
      throw new Error("Failed to add google calender event");
    });

  return response.data;
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

  const response = await axios
    .post("https://gmail.googleapis.com/gmail/v1/users/me/drafts", body, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    })
    .catch((err) => {
      logger.error(
        "Failed to create gmail draft:",
        err.response?.data || err.message
      );
      throw new Error("Failed to create gmail draft");
    });

  return response.data;
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

  const response = await axios
    .post("https://gmail.googleapis.com/gmail/v1/users/me/drafts", body, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    })
    .catch((err) => {
      logger.error(
        "Failed to create reply gmail draft:",
        err.response?.data || err.message
      );
      throw new Error("Failed to create reply gmail draft");
    });

  return response.data;
};

export const getReplySenderEmailsUsingSearchQuery = async (
  searchQuery: string,
  access_token: string,
  timezone: string
): Promise<Array<Email>> => {
  if (!DateTime.now().setZone(timezone).isValid) {
    throw new Error("Invalid timezone");
  }

  const now = DateTime.now().setZone(timezone);
  const twentyFourHoursAgo = now.minus({ days: 3 }).toUTC();
  const nowUtc = now.toUTC();

  const after = Math.floor(twentyFourHoursAgo.toSeconds());
  const before = Math.floor(nowUtc.toSeconds());

  const params = {
    q: `"${searchQuery}" category:primary after:${after} before:${before}`,
    maxResults: 100,
  };

  const listResponse = await axios
    .get("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
      headers: { Authorization: `Bearer ${access_token}` },
      params: params,
    })
    .catch((err) => {
      logger.error(
        "get emails using search query for reply draft Error:",
        err.response?.data || err.message
      );
      throw new Error(`could not get reply emails for your search query`);
    });

  const messages = listResponse.data.messages || [];
  if (messages.length === 0) return [];

  const emailResults = await Promise.allSettled(
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

  const replyEmailMetaData: Array<Email> = [];

  emailResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      replyEmailMetaData.push(result.value);
    } else {
      logger.error(
        `Failed to fetch reply Gmail email ${messages[index].id}:`,
        result.reason
      );
    }
  });

  return replyEmailMetaData;
};

export const getSenderEmailsUsingSearchQuery = async (
  searchQuery: string,
  access_token: string,
  timezone: string
): Promise<Array<Email>> => {
  if (!DateTime.now().setZone(timezone).isValid) {
    throw new Error("Invalid timezone");
  }

  const now = DateTime.now().setZone(timezone);
  const twentyFourHoursAgo = now.minus({ days: 7 }).toUTC();
  const nowUtc = now.toUTC();

  const after = Math.floor(twentyFourHoursAgo.toSeconds());
  const before = Math.floor(nowUtc.toSeconds());

  const params = {
    q: `"${searchQuery}" category:primary after:${after} before:${before}`,
  };

  const listResponse = await axios
    .get("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
      headers: { Authorization: `Bearer ${access_token}` },
      params: params,
    })
    .catch((err) => {
      logger.error(
        "sender emails using search query:",
        err.response?.data || err.message
      );
      throw new Error("Failed to fetch sender emails using search query");
    });

  const messages = listResponse.data.messages || [];
  if (messages.length === 0) return [];

  const emailResults = await Promise.allSettled(
    messages.map(async (message: { id: string }) => {
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
        id: message.id,
      };
    })
  );

  const sendersEmailMetadata: Array<Email> = [];
  emailResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      sendersEmailMetadata.push(result.value);
    } else {
      logger.error(
        `Failed to fetch sender email ${messages[index].id}:`,
        result.reason
      );
    }
  });

  return sendersEmailMetadata;
};

export const updateGoogleCalendarEventFunc = async (
  access_token: string,
  previousEvent: any,
  summary: string,
  description: string,
  location: string,
  start: { dateTime: string; timeZone: string },
  end: { dateTime: string; timeZone: string },
  attendees: Array<{ email: string }>
) => {
  const calendarId = "primary";
  const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${previousEvent.id}`;

  const event = {
    summary: summary ? summary : previousEvent.title,
    description: description ? description : previousEvent.description,
    location: location ? location : previousEvent.location,
    start: start ? start : previousEvent.start,
    end: end ? end : previousEvent.end,
    attendees:
      attendees.length > 0 || attendees ? attendees : previousEvent.attendees,
    reminders: {
      useDefault: true,
    },
  };

  console.log(event);

  const response = await axios
    .put(apiUrl, event, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    })
    .catch((err) => {
      logger.error(
        `Error updating event:", ${err.response?.data || err.message}`
      );
      throw new Error("could not update event try again.");
    });

  return response.data;
};

export const deleteGoogleCalendarEventFunc = async (
  access_token: string,
  eventId: string
) => {
  const calendarId = "primary";
  const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`;

  await axios
    .delete(apiUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })
    .catch((err) => {
      logger.error(
        `Error deleting event:", ${err.response?.data || err.message}`
      );
      throw new Error("could not delete event try again.");
    });

  return { success: true };
};

export const searchGoogleCalendarEventsFunc = async (
  access_token: string,
  timezone: string
): Promise<Array<CalenderEvent>> => {
  const now = DateTime.now().setZone(timezone);
  const sevenDaysLater = now.plus({ days: 7 });

  // Convert both to UTC ISO format (required by Google Calendar API)
  const timeMin = now.toUTC().toISO();
  const timeMax = sevenDaysLater.toUTC().toISO();

  if (!timeMin || !timeMax) {
    throw new Error("something went wrong try again.");
  }

  const response = await axios
    .get(
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
    )
    .catch((err) => {
      logger.error(
        `Error searching event:", ${err.response?.data || err.message}`
      );
      throw new Error("could not find event matching your search query.");
    });

  const eventsData: Array<CalenderEvent> = response.data.items.map(
    (item: any) => ({
      id: item.id,
      title: item.summary || "No Title", // Event title
      description: item.description || "No Description", // Event description
      location: item.location || "No Location", // Event location
      start: {
        dateTime: item.start.dateTime || null,
        timeZone: item.start.timeZone || "America/Los_Angeles",
      },
      end: {
        dateTime: item.end.dateTime || null,
        timeZone: item.end.timeZone || "America/Los_Angeles",
      },
      attendees: item.attendees
        ? item.attendees.map((attendee: any) => ({
            email: attendee.email,
            responseStatus: attendee.responseStatus || "needsAction",
          }))
        : [],
    })
  );

  return eventsData;
};
