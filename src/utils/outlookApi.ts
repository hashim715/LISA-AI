import axios from "axios";
import { htmlToText } from "html-to-text";
import { summarizeEmailsWithLLM } from "./chatgptFuncs";

export const getOutlookEmails = async (
  access_token: string
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
  } catch (err: any) {
    console.log(
      "get outlook unread emails error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const getOutlookCalenderEvents = async (
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
  } catch (err: any) {
    console.log(
      "get outlook calender events error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const getOutlookEmailsFromSpecificSender = async (
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
  } catch (err: any) {
    console.log(
      "get outlook emails using search query error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const addOutlookCalendarEvent = async (
  access_token: string,
  subject: string,
  description: string,
  location: string,
  start: any,
  end: any,
  attendees: any
) => {
  try {
    const response = await axios.post(
      "https://graph.microsoft.com/v1.0/me/events",
      {
        subject: subject,
        body: {
          contentType: "Text",
          content: description,
        },
        start: start,
        end: end,
        location: location,
        attendees: attendees,
      },
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
      "get outlook emails using search query error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const createOutlookMailDraft = async (
  access_token: string,
  reciever_email: string,
  subject: string,
  bodyContent: string
) => {
  try {
    const response = await axios.post(
      "https://graph.microsoft.com/v1.0/me/messages",
      {
        subject: subject,
        body: {
          contentType: "Text",
          content: bodyContent,
        },
        toRecipients: [
          {
            emailAddress: {
              address: reciever_email,
            },
          },
        ],
      },
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
      "get outlook emails using search query error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const createOutlookReplyDraft = async (
  messageId: string,
  bodyContent: string,
  access_token: string
) => {
  try {
    const reply = await axios.post(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}/createReply`,
      {},
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const replyDraftId = reply.data.id;

    const response = await axios.patch(
      `https://graph.microsoft.com/v1.0/me/messages/${replyDraftId}`,
      {
        body: {
          contentType: "Text",
          content: bodyContent,
        },
      },
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
      "get outlook emails using search query error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const getReplySenderOutlookEmailsUsingSearchQuery = async (
  access_token: string,
  searchName: string
): Promise<null | any> => {
  try {
    const last24HoursISO = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
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
    )}')) and receivedDateTime ge ${last24HoursISO}&$top=10&$select=id,subject,from,receivedDateTime,body`;

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
      outlookUnreadEmails.push({
        id: email.id,
        from: email.from.emailAddress.name,
      });
    });

    return outlookUnreadEmails;
  } catch (err: any) {
    console.log(
      "get outlook emails using search query error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const getSenderOutlookEmailsUsingSearchQuery = async (
  access_token: string,
  searchName: string
): Promise<null | any> => {
  try {
    const last24HoursISO = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
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
      outlookUnreadEmails.push({
        from: email.from.emailAddress.name,
      });
    });

    return outlookUnreadEmails;
  } catch (err: any) {
    console.log(
      "get outlook emails using search query error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};
