import { prisma } from "../config/postgres";
import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt_decode from "jwt-decode";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import queryString from "query-string";
import dotenv from "dotenv";
import axios from "axios";
import { htmlToText } from "html-to-text";
import { Client, iteratePaginatedAPI } from "@notionhq/client";

dotenv.config();

export const linkedlnAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authUrl: string =
      "https://www.linkedin.com/oauth/v2/authorization?" +
      queryString.stringify({
        response_type: "code",
        client_id: process.env.LINKEDIN_CLIENT_ID,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        scope: process.env.LINKEDIN_SCOPE,
      });

    return res.redirect(authUrl);
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const linkedlnredirectauth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res
        .status(400)
        .json({ message: `Try again. Something went wrong` });
    }

    if (!code) {
      return res
        .status(400)
        .json({ message: `Try again. Something went wrong` });
    }

    const tokenResponse = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      queryString.stringify({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Store tokens (in memory here; use a DB in production)
    const userTokens = {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000, // Convert seconds to milliseconds
    };

    console.log(userTokens);

    // Fetch profile as a test
    const profileResponse = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    // const profiledocuments = await axios.get(
    //   "https://api.linkedin.com/v2/rest/documents",
    //   { headers: { Authorization: `Bearer ${access_token}` } }
    // );

    return res.status(200).json({
      profile: profileResponse.data,
      tokens: userTokens,
      //   documents: profiledocuments,
    });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const googleAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      queryString.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: "http://localhost:5001/v1/testing/auth/google/callback",
        response_type: "code",
        scope: process.env.GOOGLE_SCOPES,
        access_type: "offline", // For refresh tokens
        prompt: "consent", // Forces consent screen for testing
      });

    return res.redirect(authUrl);
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

function decodeBase64Url(base64String: any) {
  const base64 = base64String.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

export const googleredirectauth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.status(400).send(`Error: ${error}`);
    }

    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      queryString.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: "http://localhost:5001/v1/testing/auth/google/callback",
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    console.log(`refresh ${refresh_token}`);

    // Fetch user info
    const userInfoResponse = await axios.get(
      "https://people.googleapis.com/v1/people/me",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { personFields: "names,emailAddresses" }, // Required for People API
      }
    );

    console.log(userInfoResponse.data);

    const twentyFourHoursAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;

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
        };
      })
    );

    const filteredUnreadEmails = unreadEmails.filter(
      (email: any) => email.timestamp >= twentyFourHoursAgo
    );

    return res
      .status(200)
      .json({ success: true, message: access_token, expires_in: expires_in });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const testingAppRedirect: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const redirect_url = "exp://192.168.100.58:8081";

    return res.redirect(redirect_url);
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const getUnreadEmails: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const access_token =
      "ya29.a0AeXRPp5Vi1xpRzrK5ptYaPz06d0ec8GKYJfLCIhMpRZd6goG9aiAet5wl6bQnoxqxoTO62TV8HVgoxMSook537KqSAiUyEEWnJNWRHt3-l7BPeMAMSuWPE1fepcF6VjvJpemMxUsCjz-yY2j97egwDmdifvxiWRXrSBU8tZhaCgYKAb8SARESFQHGX2Mi_HGQRc1acOmGpItAIfJVnA0175";

    // Fetch user info
    const userInfoResponse = await axios.get(
      "https://people.googleapis.com/v1/people/me",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { personFields: "names,emailAddresses" }, // Required for People API
      }
    );

    const twentyFourHoursAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;

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
      (email: any) => email.timestamp >= twentyFourHoursAgo
    );

    return res.status(200).json({
      success: true,
      emails: filteredUnreadEmails,
    });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const getCalenderEvents: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const access_token =
      "ya29.a0AeXRPp5xhppabs41LI8qzV-da_mKwCfFPdQRNRkqzWA7HyG4ZKtyZZj442dqAPgeWp3RPhoJt8MyvQVisfxOAkfgvAY3Nerm0yIGdKzeqDpy8ofKyjPUErmPlpgFuoncxA00SZFIN80eeoDIe_EO6WLsZ9yqWJQaMcSgF_RpaCgYKAdwSARESFQHGX2Mi5-o0ZSw-n2GrFic7-lsVEw0175";

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

    return res.status(200).json({ success: true, message: eventsData });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const refreshGoogleAccessToken: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken =
      "1//096qUR-KjrfRBCgYIARAAGAkSNwF-L9IrcpJzPJ25amxx59K6MOSbkaOBMKD0bqq47ptiUxgz94U9dBNjF54v1Tb7vPOFqUoE7Tc";

    const response = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    return res.status(200).json({ success: true, message: response.data });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const outlookAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authUrl =
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      queryString.stringify({
        client_id: process.env.OUTLOOK_CLIENT_ID,
        redirect_uri: "http://localhost:5001/v1/testing/auth/outlook/callback",
        response_type: "code",
        scope: process.env.OUTLOOK_SCOPES,
        access_type: "offline",
        prompt: "consent",
      });

    return res.redirect(authUrl);
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const outlookredirectauth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send(`Authorization code is missing`);
    }

    const tokenResponse = await axios.post(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      queryString.stringify({
        client_id: process.env.OUTLOOK_CLIENT_ID,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET,
        code,
        redirect_uri: process.env.OUTLOOK_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { data } = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
    });

    console.log(data);

    return res.status(200).json({
      success: true,
      message: tokenResponse.data,
    });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const getOutlookUnreadEmails: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const access_token =
      "eyJ0eXAiOiJKV1QiLCJub25jZSI6Ik5hem1ZdVJEQVZZRDM1dEtoZHRjUGlUcV93WV90SExVeXZkdTh0NVRrd3ciLCJhbGciOiJSUzI1NiIsIng1dCI6IkpETmFfNGk0cjdGZ2lnTDNzSElsSTN4Vi1JVSIsImtpZCI6IkpETmFfNGk0cjdGZ2lnTDNzSElsSTN4Vi1JVSJ9.eyJhdWQiOiJodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20iLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC80YjZlYTY0Ni1hYTc2LTQ0YTktYjVkMy1jYWViZjQxNTM1NTYvIiwiaWF0IjoxNzQyNzA5MjI5LCJuYmYiOjE3NDI3MDkyMjksImV4cCI6MTc0MjcxMzk1OSwiYWNjdCI6MCwiYWNyIjoiMSIsImFjcnMiOlsicDEiXSwiYWlvIjoiQVhRQWkvOFpBQUFBYmJ1RDRRSS9VTGtTcm1WSTI4ekUrekdxUVMyL0FLQmY3S0xaanhqSXRqS296T3h1RGdsTGZxU1hoT3FxZEgrTXpUUlh5bG1wRWY1UDVVU2Jjc2xmQnB2QTRKc3BFTGxKYzBERnBJbThHRUt4UW0wWFVhSzhIZzBkbytwS29kQ0w1andvak0zNlZnOTNVSENzbzc5ZmZnPT0iLCJhbXIiOlsicHdkIiwibWZhIl0sImFwcF9kaXNwbGF5bmFtZSI6InZvaWNlLWFzc2lzdGFudCIsImFwcGlkIjoiMjI3MDgzMDItNjQyOS00MTM2LTkzYTEtYjE3ZDA5YTlmMzYyIiwiYXBwaWRhY3IiOiIxIiwiZmFtaWx5X25hbWUiOiJKYW4iLCJnaXZlbl9uYW1lIjoiQWF6YXIiLCJpZHR5cCI6InVzZXIiLCJpcGFkZHIiOiIxMTkuMTU2LjE1My4yMzUiLCJuYW1lIjoiQWF6YXIgSmFuIiwib2lkIjoiZTkyYTZmNTUtZDM3ZC00YWVhLWE4OTctYWVhNWZlNWY1M2NlIiwicGxhdGYiOiI1IiwicHVpZCI6IjEwMDMyMDA0MTNFNDYxQjEiLCJyaCI6IjEuQVdFQlJxWnVTM2FxcVVTMTA4cnI5QlUxVmdNQUFBQUFBQUFBd0FBQUFBQUFBQUJpQVJkaEFRLiIsInNjcCI6IkNhbGVuZGFycy5SZWFkIENhbGVuZGFycy5SZWFkLlNoYXJlZCBDYWxlbmRhcnMuUmVhZEJhc2ljIENhbGVuZGFycy5SZWFkV3JpdGUgQ2FsZW5kYXJzLlJlYWRXcml0ZS5TaGFyZWQgZW1haWwgTWFpbC5SZWFkIE1haWwuUmVhZC5TaGFyZWQgTWFpbC5SZWFkQmFzaWMgTWFpbC5SZWFkQmFzaWMuU2hhcmVkIE1haWwuUmVhZFdyaXRlIE1haWwuUmVhZFdyaXRlLlNoYXJlZCBNYWlsLlNlbmQgTWFpbC5TZW5kLlNoYXJlZCBvcGVuaWQgcHJvZmlsZSBVc2VyLlJlYWQiLCJzaWQiOiIwMDMxMDJmOS0wNjZjLWVkZjYtYjVlZC01NTdmMzc3MjhkMWYiLCJzaWduaW5fc3RhdGUiOlsia21zaSJdLCJzdWIiOiJBNjFwM2tCREJ1c21ROTJ3ZGJxNzdZTzBhVnhNcnVyajU2aU5JeXlHdnE4IiwidGVuYW50X3JlZ2lvbl9zY29wZSI6Ik5BIiwidGlkIjoiNGI2ZWE2NDYtYWE3Ni00NGE5LWI1ZDMtY2FlYmY0MTUzNTU2IiwidW5pcXVlX25hbWUiOiJhYXphckBjb3Vyc2V4LnVzIiwidXBuIjoiYWF6YXJAY291cnNleC51cyIsInV0aSI6ImxZaE5TdUlOZTBlU3B6alMxNzVKQUEiLCJ2ZXIiOiIxLjAiLCJ3aWRzIjpbIjYyZTkwMzk0LTY5ZjUtNDIzNy05MTkwLTAxMjE3NzE0NWUxMCIsImI3OWZiZjRkLTNlZjktNDY4OS04MTQzLTc2YjE5NGU4NTUwOSJdLCJ4bXNfaWRyZWwiOiIxIDI4IiwieG1zX3N0Ijp7InN1YiI6Ik9OLURJdVlIWm9TZDNmNndpVVdRZlRYZVJlMFV4a21VU3JFLW4zZjZ6WkUifSwieG1zX3RjZHQiOjE3MzMzNjY2ODZ9.SNVO1wOVr3CvGs-6u5pHy_XESDLcIXV2MuFLYEPNihpNPeY5thc9FMcgG8ZuyI2XmzQ98w6BSEeMmmN1KviqwTL6al7UVcHBmcHyoVph7Cr1KSMTdoAfhSn33AHXJ5Hdcwdh79-1-SviH6li2JvrKi_xaxFUKJNgEmdJG20iAXxzGCJqY6ftk6eeAlzO3mfm5WbiZkugFZTKRxTfPaoVBNhW6CgcvCdopnDWwdyvgXoNuEo-ZoNFYQxyZU2pE8uBK2QQueTG0FuFkLBeIoGREv-XYVYG8vHfN3r8Km37wLmrWwOsDDTL6ozyGhZ7HOrLZ1vJesWm-VylvJmboIFTWw";

    // Get the timestamp for 24 hours ago in ISO format
    const last24Hours = new Date();
    last24Hours.setDate(last24Hours.getDate() - 1);
    const last24HoursISO = last24Hours.toISOString(); // Format: YYYY-MM-DDTHH:mm:ss.sssZ

    // Get Inbox Folder ID
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

    let unReamdEmails: Array<any> = [];

    const emails = response.data.value;
    if (emails.length === 0) {
      unReamdEmails = [];
    } else {
      emails.forEach((email: any, index: number) => {
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

        unReamdEmails.push({
          From: email.from.emailAddress.address,
          Subject: email.subject,
          Body: bodytext,
        });
      });
    }

    return res.status(200).json({
      success: true,
      message: "Got unread emails",
      unReamdEmails: unReamdEmails,
    });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const getOutlookEvents: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const access_token =
      "eyJ0eXAiOiJKV1QiLCJub25jZSI6Ik5hem1ZdVJEQVZZRDM1dEtoZHRjUGlUcV93WV90SExVeXZkdTh0NVRrd3ciLCJhbGciOiJSUzI1NiIsIng1dCI6IkpETmFfNGk0cjdGZ2lnTDNzSElsSTN4Vi1JVSIsImtpZCI6IkpETmFfNGk0cjdGZ2lnTDNzSElsSTN4Vi1JVSJ9.eyJhdWQiOiJodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20iLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC80YjZlYTY0Ni1hYTc2LTQ0YTktYjVkMy1jYWViZjQxNTM1NTYvIiwiaWF0IjoxNzQyNzA5MjI5LCJuYmYiOjE3NDI3MDkyMjksImV4cCI6MTc0MjcxMzk1OSwiYWNjdCI6MCwiYWNyIjoiMSIsImFjcnMiOlsicDEiXSwiYWlvIjoiQVhRQWkvOFpBQUFBYmJ1RDRRSS9VTGtTcm1WSTI4ekUrekdxUVMyL0FLQmY3S0xaanhqSXRqS296T3h1RGdsTGZxU1hoT3FxZEgrTXpUUlh5bG1wRWY1UDVVU2Jjc2xmQnB2QTRKc3BFTGxKYzBERnBJbThHRUt4UW0wWFVhSzhIZzBkbytwS29kQ0w1andvak0zNlZnOTNVSENzbzc5ZmZnPT0iLCJhbXIiOlsicHdkIiwibWZhIl0sImFwcF9kaXNwbGF5bmFtZSI6InZvaWNlLWFzc2lzdGFudCIsImFwcGlkIjoiMjI3MDgzMDItNjQyOS00MTM2LTkzYTEtYjE3ZDA5YTlmMzYyIiwiYXBwaWRhY3IiOiIxIiwiZmFtaWx5X25hbWUiOiJKYW4iLCJnaXZlbl9uYW1lIjoiQWF6YXIiLCJpZHR5cCI6InVzZXIiLCJpcGFkZHIiOiIxMTkuMTU2LjE1My4yMzUiLCJuYW1lIjoiQWF6YXIgSmFuIiwib2lkIjoiZTkyYTZmNTUtZDM3ZC00YWVhLWE4OTctYWVhNWZlNWY1M2NlIiwicGxhdGYiOiI1IiwicHVpZCI6IjEwMDMyMDA0MTNFNDYxQjEiLCJyaCI6IjEuQVdFQlJxWnVTM2FxcVVTMTA4cnI5QlUxVmdNQUFBQUFBQUFBd0FBQUFBQUFBQUJpQVJkaEFRLiIsInNjcCI6IkNhbGVuZGFycy5SZWFkIENhbGVuZGFycy5SZWFkLlNoYXJlZCBDYWxlbmRhcnMuUmVhZEJhc2ljIENhbGVuZGFycy5SZWFkV3JpdGUgQ2FsZW5kYXJzLlJlYWRXcml0ZS5TaGFyZWQgZW1haWwgTWFpbC5SZWFkIE1haWwuUmVhZC5TaGFyZWQgTWFpbC5SZWFkQmFzaWMgTWFpbC5SZWFkQmFzaWMuU2hhcmVkIE1haWwuUmVhZFdyaXRlIE1haWwuUmVhZFdyaXRlLlNoYXJlZCBNYWlsLlNlbmQgTWFpbC5TZW5kLlNoYXJlZCBvcGVuaWQgcHJvZmlsZSBVc2VyLlJlYWQiLCJzaWQiOiIwMDMxMDJmOS0wNjZjLWVkZjYtYjVlZC01NTdmMzc3MjhkMWYiLCJzaWduaW5fc3RhdGUiOlsia21zaSJdLCJzdWIiOiJBNjFwM2tCREJ1c21ROTJ3ZGJxNzdZTzBhVnhNcnVyajU2aU5JeXlHdnE4IiwidGVuYW50X3JlZ2lvbl9zY29wZSI6Ik5BIiwidGlkIjoiNGI2ZWE2NDYtYWE3Ni00NGE5LWI1ZDMtY2FlYmY0MTUzNTU2IiwidW5pcXVlX25hbWUiOiJhYXphckBjb3Vyc2V4LnVzIiwidXBuIjoiYWF6YXJAY291cnNleC51cyIsInV0aSI6ImxZaE5TdUlOZTBlU3B6alMxNzVKQUEiLCJ2ZXIiOiIxLjAiLCJ3aWRzIjpbIjYyZTkwMzk0LTY5ZjUtNDIzNy05MTkwLTAxMjE3NzE0NWUxMCIsImI3OWZiZjRkLTNlZjktNDY4OS04MTQzLTc2YjE5NGU4NTUwOSJdLCJ4bXNfaWRyZWwiOiIxIDI4IiwieG1zX3N0Ijp7InN1YiI6Ik9OLURJdVlIWm9TZDNmNndpVVdRZlRYZVJlMFV4a21VU3JFLW4zZjZ6WkUifSwieG1zX3RjZHQiOjE3MzMzNjY2ODZ9.SNVO1wOVr3CvGs-6u5pHy_XESDLcIXV2MuFLYEPNihpNPeY5thc9FMcgG8ZuyI2XmzQ98w6BSEeMmmN1KviqwTL6al7UVcHBmcHyoVph7Cr1KSMTdoAfhSn33AHXJ5Hdcwdh79-1-SviH6li2JvrKi_xaxFUKJNgEmdJG20iAXxzGCJqY6ftk6eeAlzO3mfm5WbiZkugFZTKRxTfPaoVBNhW6CgcvCdopnDWwdyvgXoNuEo-ZoNFYQxyZU2pE8uBK2QQueTG0FuFkLBeIoGREv-XYVYG8vHfN3r8Km37wLmrWwOsDDTL6ozyGhZ7HOrLZ1vJesWm-VylvJmboIFTWw";

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

    return res.status(200).json({
      success: true,
      message: "Got next 7 days events",
      eventsData: eventsData,
    });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const getGmailOutlookUnreadEmails: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const gmail_access_token: string =
      "ya29.a0AeXRPp5ikayNQkqAUFABpxTcp9e8ycNIj4JVN9wVOolxk_m_PFBYGPCFqsTT4LtH0GFBAkiIwK2bYDeMDw4CcxcOwi-Ik-rxnKlMiGDHaWqfvLh6POc-V239Elqe5lcsKUnMpsL4hALfHAXnyGeduEXhP74AdXPF2gVS7TdXaCgYKARUSARESFQHGX2MiUCRfKvKj9AAxNTwqt1C23w0175";
    const outlook_access_token: string =
      "eyJ0eXAiOiJKV1QiLCJub25jZSI6ImtpMXdLbjZPSkwwcndLbkIxREE1NlA4ODNBMndoWFJ1dmMxOWNmZVBsM1EiLCJhbGciOiJSUzI1NiIsIng1dCI6IkpETmFfNGk0cjdGZ2lnTDNzSElsSTN4Vi1JVSIsImtpZCI6IkpETmFfNGk0cjdGZ2lnTDNzSElsSTN4Vi1JVSJ9.eyJhdWQiOiJodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20iLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC80YjZlYTY0Ni1hYTc2LTQ0YTktYjVkMy1jYWViZjQxNTM1NTYvIiwiaWF0IjoxNzQyODM2MTAzLCJuYmYiOjE3NDI4MzYxMDMsImV4cCI6MTc0Mjg0MTA5MywiYWNjdCI6MCwiYWNyIjoiMSIsImFjcnMiOlsicDEiXSwiYWlvIjoiQVhRQWkvOFpBQUFBUTVLQWFYajAzN1hKZTBzV05DbysxQmpvUE5VUlpkT2tXQ0k1NEFodXphcGhETzlOSEhMUkcrZ3hyL2xZOXZrcFp3QmpPQ3VPWU9MbnhMczlMMXdFVVQ1L2VCbEtXOWV1c1NNSVhYUkwwTjVqcGtoOE5sbS9oQ1hUWUVYUzdHNjB4RDc0ajEzaVVNUGVBc0haZlFtN2Z3PT0iLCJhbXIiOlsicHdkIiwibWZhIl0sImFwcF9kaXNwbGF5bmFtZSI6InZvaWNlLWFzc2lzdGFudCIsImFwcGlkIjoiMjI3MDgzMDItNjQyOS00MTM2LTkzYTEtYjE3ZDA5YTlmMzYyIiwiYXBwaWRhY3IiOiIxIiwiZmFtaWx5X25hbWUiOiJKYW4iLCJnaXZlbl9uYW1lIjoiQWF6YXIiLCJpZHR5cCI6InVzZXIiLCJpcGFkZHIiOiIxMTkuMTU2LjE1Mi4xNTMiLCJuYW1lIjoiQWF6YXIgSmFuIiwib2lkIjoiZTkyYTZmNTUtZDM3ZC00YWVhLWE4OTctYWVhNWZlNWY1M2NlIiwicGxhdGYiOiI1IiwicHVpZCI6IjEwMDMyMDA0MTNFNDYxQjEiLCJyaCI6IjEuQVdFQlJxWnVTM2FxcVVTMTA4cnI5QlUxVmdNQUFBQUFBQUFBd0FBQUFBQUFBQUJpQVJkaEFRLiIsInNjcCI6IkNhbGVuZGFycy5SZWFkIENhbGVuZGFycy5SZWFkLlNoYXJlZCBDYWxlbmRhcnMuUmVhZEJhc2ljIENhbGVuZGFycy5SZWFkV3JpdGUgQ2FsZW5kYXJzLlJlYWRXcml0ZS5TaGFyZWQgZW1haWwgTWFpbC5SZWFkIE1haWwuUmVhZC5TaGFyZWQgTWFpbC5SZWFkQmFzaWMgTWFpbC5SZWFkQmFzaWMuU2hhcmVkIE1haWwuUmVhZFdyaXRlIE1haWwuUmVhZFdyaXRlLlNoYXJlZCBNYWlsLlNlbmQgTWFpbC5TZW5kLlNoYXJlZCBvcGVuaWQgcHJvZmlsZSBVc2VyLlJlYWQiLCJzaWQiOiIwMDMxMDJmOS0wNjZjLWVkZjYtYjVlZC01NTdmMzc3MjhkMWYiLCJzaWduaW5fc3RhdGUiOlsia21zaSJdLCJzdWIiOiJBNjFwM2tCREJ1c21ROTJ3ZGJxNzdZTzBhVnhNcnVyajU2aU5JeXlHdnE4IiwidGVuYW50X3JlZ2lvbl9zY29wZSI6Ik5BIiwidGlkIjoiNGI2ZWE2NDYtYWE3Ni00NGE5LWI1ZDMtY2FlYmY0MTUzNTU2IiwidW5pcXVlX25hbWUiOiJhYXphckBjb3Vyc2V4LnVzIiwidXBuIjoiYWF6YXJAY291cnNleC51cyIsInV0aSI6IlNWTUhKakdaYWs2YW84TFJNbWEzQUEiLCJ2ZXIiOiIxLjAiLCJ3aWRzIjpbIjYyZTkwMzk0LTY5ZjUtNDIzNy05MTkwLTAxMjE3NzE0NWUxMCIsImI3OWZiZjRkLTNlZjktNDY4OS04MTQzLTc2YjE5NGU4NTUwOSJdLCJ4bXNfaWRyZWwiOiIyMiAxIiwieG1zX3N0Ijp7InN1YiI6Ik9OLURJdVlIWm9TZDNmNndpVVdRZlRYZVJlMFV4a21VU3JFLW4zZjZ6WkUifSwieG1zX3RjZHQiOjE3MzMzNjY2ODZ9.E85FhSTKXXMh_3RBPJIPSeTMVtPz5wnD3bu_5ErYYXpaa6RyYpO-pzGrUs4VeqiYlc_OnpEWUTJl401pI_50cNiieMkDO8acxjSrhrjDmd3LBqspEIhrQXMNUz1balRO7o0_RMyDVu8VlQl08ocqG33mrn3TGNMxCYB-Iovha4G-PIHjHzPLhxtd2rnkoySKianaSuY5ulb3a2rgcSnTyFdFMW08UWrS4nLdNE1en-sx_U6vrHXEP1DOFREKbGeAVaVmQvmeAdsfk401vQtdjOudirZAicwCJsryOCYz7Olv7J4oRPKPytjbFt9poIC67sbSk9A_JK_2RqiWlDxdDA";

    // Get the timestamp for 24 hours ago in ISO format
    const last24Hours = new Date();
    last24Hours.setDate(last24Hours.getDate() - 1);
    const last24HoursISO = last24Hours.toISOString(); // Format: YYYY-MM-DDTHH:mm:ss.sssZ

    // Get Inbox Folder ID
    const inboxResponse = await axios.get(
      "https://graph.microsoft.com/v1.0/me/mailFolders/inbox",
      {
        headers: {
          Authorization: `Bearer ${outlook_access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const inboxFolderId = inboxResponse.data.id; // Inbox folder ID

    // Fetch unread focused emails from inbox (excluding junk)
    const apiUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${inboxFolderId}/messages?$filter=inferenceClassification eq 'focused' and isRead eq false and receivedDateTime ge ${last24HoursISO}&$top=10&$select=subject,from,receivedDateTime,body`;

    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${outlook_access_token}`,
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

    const twentyFourHoursAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;

    // List unread emails
    const listResponse = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages",
      {
        headers: { Authorization: `Bearer ${gmail_access_token}` },
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
            headers: { Authorization: `Bearer ${gmail_access_token}` },
            params: { format: "full" }, // Optimize for headers
          }
        );

        const { payload, snippet, internalDate } = msgResponse.data;
        const headers = payload.headers || [];

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
        };
      })
    );

    const filteredUnreadEmails = unreadEmails.filter(
      (email: any) => email.timestamp >= twentyFourHoursAgo
    );

    return res.status(200).json({
      success: true,
      outlookEmails: outlookunReamdEmails,
      gmailEmails: filteredUnreadEmails,
    });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const getGmailOutlookCalenderEvents: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const gmail_access_token: string =
      "ya29.a0AeXRPp5ikayNQkqAUFABpxTcp9e8ycNIj4JVN9wVOolxk_m_PFBYGPCFqsTT4LtH0GFBAkiIwK2bYDeMDw4CcxcOwi-Ik-rxnKlMiGDHaWqfvLh6POc-V239Elqe5lcsKUnMpsL4hALfHAXnyGeduEXhP74AdXPF2gVS7TdXaCgYKARUSARESFQHGX2MiUCRfKvKj9AAxNTwqt1C23w0175";
    const outlook_access_token: string =
      "eyJ0eXAiOiJKV1QiLCJub25jZSI6ImtpMXdLbjZPSkwwcndLbkIxREE1NlA4ODNBMndoWFJ1dmMxOWNmZVBsM1EiLCJhbGciOiJSUzI1NiIsIng1dCI6IkpETmFfNGk0cjdGZ2lnTDNzSElsSTN4Vi1JVSIsImtpZCI6IkpETmFfNGk0cjdGZ2lnTDNzSElsSTN4Vi1JVSJ9.eyJhdWQiOiJodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20iLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC80YjZlYTY0Ni1hYTc2LTQ0YTktYjVkMy1jYWViZjQxNTM1NTYvIiwiaWF0IjoxNzQyODM2MTAzLCJuYmYiOjE3NDI4MzYxMDMsImV4cCI6MTc0Mjg0MTA5MywiYWNjdCI6MCwiYWNyIjoiMSIsImFjcnMiOlsicDEiXSwiYWlvIjoiQVhRQWkvOFpBQUFBUTVLQWFYajAzN1hKZTBzV05DbysxQmpvUE5VUlpkT2tXQ0k1NEFodXphcGhETzlOSEhMUkcrZ3hyL2xZOXZrcFp3QmpPQ3VPWU9MbnhMczlMMXdFVVQ1L2VCbEtXOWV1c1NNSVhYUkwwTjVqcGtoOE5sbS9oQ1hUWUVYUzdHNjB4RDc0ajEzaVVNUGVBc0haZlFtN2Z3PT0iLCJhbXIiOlsicHdkIiwibWZhIl0sImFwcF9kaXNwbGF5bmFtZSI6InZvaWNlLWFzc2lzdGFudCIsImFwcGlkIjoiMjI3MDgzMDItNjQyOS00MTM2LTkzYTEtYjE3ZDA5YTlmMzYyIiwiYXBwaWRhY3IiOiIxIiwiZmFtaWx5X25hbWUiOiJKYW4iLCJnaXZlbl9uYW1lIjoiQWF6YXIiLCJpZHR5cCI6InVzZXIiLCJpcGFkZHIiOiIxMTkuMTU2LjE1Mi4xNTMiLCJuYW1lIjoiQWF6YXIgSmFuIiwib2lkIjoiZTkyYTZmNTUtZDM3ZC00YWVhLWE4OTctYWVhNWZlNWY1M2NlIiwicGxhdGYiOiI1IiwicHVpZCI6IjEwMDMyMDA0MTNFNDYxQjEiLCJyaCI6IjEuQVdFQlJxWnVTM2FxcVVTMTA4cnI5QlUxVmdNQUFBQUFBQUFBd0FBQUFBQUFBQUJpQVJkaEFRLiIsInNjcCI6IkNhbGVuZGFycy5SZWFkIENhbGVuZGFycy5SZWFkLlNoYXJlZCBDYWxlbmRhcnMuUmVhZEJhc2ljIENhbGVuZGFycy5SZWFkV3JpdGUgQ2FsZW5kYXJzLlJlYWRXcml0ZS5TaGFyZWQgZW1haWwgTWFpbC5SZWFkIE1haWwuUmVhZC5TaGFyZWQgTWFpbC5SZWFkQmFzaWMgTWFpbC5SZWFkQmFzaWMuU2hhcmVkIE1haWwuUmVhZFdyaXRlIE1haWwuUmVhZFdyaXRlLlNoYXJlZCBNYWlsLlNlbmQgTWFpbC5TZW5kLlNoYXJlZCBvcGVuaWQgcHJvZmlsZSBVc2VyLlJlYWQiLCJzaWQiOiIwMDMxMDJmOS0wNjZjLWVkZjYtYjVlZC01NTdmMzc3MjhkMWYiLCJzaWduaW5fc3RhdGUiOlsia21zaSJdLCJzdWIiOiJBNjFwM2tCREJ1c21ROTJ3ZGJxNzdZTzBhVnhNcnVyajU2aU5JeXlHdnE4IiwidGVuYW50X3JlZ2lvbl9zY29wZSI6Ik5BIiwidGlkIjoiNGI2ZWE2NDYtYWE3Ni00NGE5LWI1ZDMtY2FlYmY0MTUzNTU2IiwidW5pcXVlX25hbWUiOiJhYXphckBjb3Vyc2V4LnVzIiwidXBuIjoiYWF6YXJAY291cnNleC51cyIsInV0aSI6IlNWTUhKakdaYWs2YW84TFJNbWEzQUEiLCJ2ZXIiOiIxLjAiLCJ3aWRzIjpbIjYyZTkwMzk0LTY5ZjUtNDIzNy05MTkwLTAxMjE3NzE0NWUxMCIsImI3OWZiZjRkLTNlZjktNDY4OS04MTQzLTc2YjE5NGU4NTUwOSJdLCJ4bXNfaWRyZWwiOiIyMiAxIiwieG1zX3N0Ijp7InN1YiI6Ik9OLURJdVlIWm9TZDNmNndpVVdRZlRYZVJlMFV4a21VU3JFLW4zZjZ6WkUifSwieG1zX3RjZHQiOjE3MzMzNjY2ODZ9.E85FhSTKXXMh_3RBPJIPSeTMVtPz5wnD3bu_5ErYYXpaa6RyYpO-pzGrUs4VeqiYlc_OnpEWUTJl401pI_50cNiieMkDO8acxjSrhrjDmd3LBqspEIhrQXMNUz1balRO7o0_RMyDVu8VlQl08ocqG33mrn3TGNMxCYB-Iovha4G-PIHjHzPLhxtd2rnkoySKianaSuY5ulb3a2rgcSnTyFdFMW08UWrS4nLdNE1en-sx_U6vrHXEP1DOFREKbGeAVaVmQvmeAdsfk401vQtdjOudirZAicwCJsryOCYz7Olv7J4oRPKPytjbFt9poIC67sbSk9A_JK_2RqiWlDxdDA";

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
          Authorization: `Bearer ${gmail_access_token}`,
        },
      }
    );

    const googleEventsData: Array<any> = [];

    response.data.items.forEach((item: any) => {
      // Check if attendees exist and filter only accepted events
      const attendees = item.attendees[1];

      const isAccepted = attendees.responseStatus === "accepted";

      if (isAccepted) {
        googleEventsData.push({
          title: item.summary,
          start: item.start,
          end: item.end,
          status: "Accepted",
          description: item.description,
        });
      } else {
        googleEventsData.push({
          title: item.summary,
          start: item.start,
          end: item.end,
          status: "Not Accepted",
          description: item.description,
        });
      }
    });

    const startTime = now.toISOString(); // Start from current time

    sevenDaysLater.setDate(now.getDate() + 7);
    const endTime = sevenDaysLater.toISOString(); // End after 7 days

    // Microsoft Graph API URL for fetching events
    const apiUrl = `https://graph.microsoft.com/v1.0/me/calendar/events?$filter=start/dateTime ge '${startTime}' and start/dateTime le '${endTime}'&$orderby=start/dateTime&$select=subject,start,end,location,body`;

    // API request
    const Outlookresponse = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${outlook_access_token}`,
        "Content-Type": "application/json",
      },
    });

    const events = Outlookresponse.data.value;

    let outlookEventsData: Array<any> = [];

    if (events.length === 0) {
      outlookEventsData = [];
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

        outlookEventsData.push({
          Subject: event.subject,
          Start: `${event.start.dateTime} (${event.start.timeZone}`,
          End: `${event.end.dateTime} (${event.end.timeZone}`,
          Location: `${event.location.displayName || "N/A"}`,
          body: bodytext,
        });
      });
    }

    return res.status(200).json({
      success: true,
      gmailEvents: googleEventsData,
      outlookEventsData: outlookEventsData,
    });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const notionClientApiTesting: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const notion = new Client({ auth: "" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};
