import { prisma } from "../config/postgres";
import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt_decode from "jwt-decode";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
const queryString = require("query-string");
import dotenv from "dotenv";
import axios from "axios";
import { htmlToText } from "html-to-text";

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
      queryString.default.stringify({
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
      queryString.default.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: process.env.GOOGLE_SCOPES, // Add 'https://mail.google.com/' for email access
        access_type: "offline", // For refresh tokens
        prompt: "consent", // Forces consent screen for testing
      });

    res.redirect(authUrl);
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
      queryString.default.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    console.log(access_token);

    // Fetch user info
    const userInfoResponse = await axios.get(
      "https://people.googleapis.com/v1/people/me",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { personFields: "names,emailAddresses" }, // Required for People API
      }
    );

    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    // List unread emails
    const listResponse = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { q: "is:unread category:primary", maxResults: 10 }, // Filter for unread, limit to 10
      }
    );

    console.log(listResponse.data);

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

    return res.status(200).json({
      success: true,
      message: userInfoResponse.data,
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
      "ya29.a0AeXRPp4pzd0XAIY8y2A0sT2eBGwEI-NCmiD6Sqj4d73tvxAkhsHPlBSQGPmtQE28o1TARUgJ6OCMBCLH4xuq-tDk__qY_xxCdXC7KIA3Yc_CyvgdAIkECp0v452MC_Cl-ipi-lC_fyWrqoxljek-VqdFoQbgc2pWU60KRxk8aCgYKAScSARESFQHGX2MiAcbaExBOvH3gtC7nYvjBaQ0175";

    // Fetch user info
    const userInfoResponse = await axios.get(
      "https://people.googleapis.com/v1/people/me",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { personFields: "names,emailAddresses" }, // Required for People API
      }
    );

    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

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

    return res.status(200).json({
      success: true,
      message: userInfoResponse.data,
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
