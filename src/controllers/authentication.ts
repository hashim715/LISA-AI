import { prisma } from "../config/postgres";
import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt_decode from "jwt-decode";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import axios from "axios";
import { sendTokenCookie } from "../utils/sendTokenCookie";
import {
  internalServerError,
  badRequestResponse,
  notFoundResponse,
  unauthorizedErrorResponse,
} from "./errors";

dotenv.config();

const integrateOutlookAccount = async (
  code: string,
  token: string,
  res: Response
) => {
  try {
    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user) {
      return notFoundResponse(res);
    }

    const tokenResponse = await axios.post(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET,
        code,
        redirect_uri: process.env.OUTLOOK_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const expiryDate = new Date(Date.now() + expires_in * 1000);

    const { data } = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    await prisma.user.update({
      where: { username: user.username },
      data: {
        outlook_access_token: access_token,
        outlook_email: data.mail,
        outlook_refresh_token: refresh_token,
        outlook_login: true,
        outlook_token_expiry: expiryDate.toISOString(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Outlook account integrated successfully",
    });
  } catch (err) {
    console.log(err.response.data);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

const integrateGmailAccount = async (
  res: Response,
  token: string,
  code: string
) => {
  try {
    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user) {
      return notFoundResponse(res);
    }

    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const expiryDate = new Date(Date.now() + parseInt(expires_in) * 1000);

    const userInfoResponse = await axios.get(
      "https://people.googleapis.com/v1/people/me",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { personFields: "names,emailAddresses" },
      }
    );

    await prisma.user.update({
      where: { username: user.username },
      data: {
        google_access_token: access_token,
        google_email: userInfoResponse.data.emailAddresses[0].value,
        google_login: true,
        google_refresh_token: refresh_token,
        google_token_expiry: expiryDate.toISOString(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Google account integrated successfully",
    });
  } catch (err) {
    console.log(err.response.data);
    if (!res.headersSent) {
      return internalServerError(res);
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
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: process.env.GOOGLE_SCOPES,
        access_type: "offline",
        prompt: "consent", // Forces consent screen for testing
      });

    return res.status(200).json({ success: true, message: authUrl });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const googleredirectauth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code }: { code: string } = req.body;

    if (!code.trim()) {
      return badRequestResponse(res, "Try again something went wrong!");
    }

    const token = req.cookies.authToken;

    if (token) {
      console.log("wait i am integrating gmail account");
      return integrateGmailAccount(res, token, code);
    }

    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const expiryDate = new Date(Date.now() + parseInt(expires_in) * 1000);

    const userInfoResponse = await axios.get(
      "https://people.googleapis.com/v1/people/me",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { personFields: "names,emailAddresses" },
      }
    );

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: userInfoResponse.data.emailAddresses[0].value },
          { google_email: userInfoResponse.data.emailAddresses[0].value },
        ],
      },
    });

    if (user) {
      await prisma.user.update({
        where: { email: user.email },
        data: {
          google_access_token: access_token,
          google_refresh_token: refresh_token,
          google_token_expiry: expiryDate.toISOString(),
        },
      });

      await sendTokenCookie(res, user.username);

      return res
        .status(200)
        .json({ success: true, message: "Logged in successfully" });
    }

    const uuid = uuidv4();

    const username = uuid;

    const user_ = await prisma.user.findFirst({
      where: { username: username },
    });

    if (user_) {
      return badRequestResponse(res, "Try again something went wrong");
    }

    await prisma.user.create({
      data: {
        email: userInfoResponse.data.emailAddresses[0].value,
        google_email: userInfoResponse.data.emailAddresses[0].value,
        name: userInfoResponse.data.names[0].displayName,
        username: username,
        google_login: true,
        google_access_token: access_token,
        google_refresh_token: refresh_token,
        google_token_expiry: expiryDate.toISOString(),
      },
    });

    await sendTokenCookie(res, username);

    return res
      .status(200)
      .json({ success: true, message: "Logged in successfully" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
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
      new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID,
        redirect_uri: process.env.OUTLOOK_REDIRECT_URI,
        response_type: "code",
        scope: process.env.OUTLOOK_SCOPES,
        access_type: "offline",
        prompt: "consent",
      });

    return res.status(200).json({ success: true, message: authUrl });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const outlookredirectauth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code }: { code: string } = req.body;

    if (!code.trim()) {
      return badRequestResponse(res, "Try again something went wrong!");
    }

    const token = req.cookies.authToken;

    if (token) {
      console.log("wait i am integrating outlook account");
      return integrateOutlookAccount(code, token, res);
    }

    const tokenResponse = await axios.post(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET,
        code,
        redirect_uri: process.env.OUTLOOK_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const expiryDate = new Date(Date.now() + expires_in * 1000);

    const { data } = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: data.mail }, { outlook_email: data.mail }] },
    });

    if (user) {
      await prisma.user.update({
        where: { email: user.email },
        data: {
          outlook_access_token: access_token,
          outlook_refresh_token: refresh_token,
          outlook_token_expiry: expiryDate.toISOString(),
        },
      });

      await sendTokenCookie(res, user.username);

      return res
        .status(200)
        .json({ success: true, message: "Logged in successfully" });
    }

    const uuid = uuidv4();

    const username = uuid;

    const user_ = await prisma.user.findFirst({
      where: { username: username },
    });

    if (user_) {
      return badRequestResponse(res, "Try again something went wrong");
    }

    await prisma.user.create({
      data: {
        email: data.mail,
        outlook_email: data.mail,
        name: data.displayName,
        username: username,
        outlook_login: true,
        outlook_access_token: access_token,
        outlook_refresh_token: refresh_token,
        outlook_token_expiry: expiryDate.toISOString(),
      },
    });

    await sendTokenCookie(res, username);

    return res
      .status(200)
      .json({ success: true, message: "Logged in successfully" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const getUser: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    return res.status(200).json({ success: true, message: user });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const logOut: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    await prisma.user.update({
      where: { username: username },
      data: { token: null, expiresAt: null },
    });

    res.clearCookie("authToken", {
      httpOnly: true,
      secure: process.env.ENV == "production" ? true : false,
      sameSite: process.env.ENV == "production" ? "none" : "strict",
    });

    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const refreshToken: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const user = await prisma.user.findFirst({ where: { token: token } });

    if (!user) {
      return badRequestResponse(res, "Invalid refresh token");
    }

    await sendTokenCookie(res, user.username);

    return res.status(200).json({ success: true, user: user });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const notionAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authUrl =
      `https://api.notion.com/v1/oauth/authorize?` +
      new URLSearchParams({
        client_id: process.env.NOTION_CLIENT_ID,
        redirect_uri: process.env.NOTION_REDIRECT_URI,
        response_type: "code",
        owner: "user",
      });

    return res.status(200).json({ success: true, message: authUrl });
  } catch (err) {
    console.log(err.response.data);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const integrateNotionAccount: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code }: { code: string } = req.body;

    if (!code.trim()) {
      return unauthorizedErrorResponse(res);
    }

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user) {
      return notFoundResponse(res);
    }

    const tokenResponse = await axios.post(
      "https://api.notion.com/v1/oauth/token",
      new URLSearchParams({
        code,
        redirect_uri: process.env.NOTION_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
          ).toString("base64")}`,
        },
      }
    );

    const { access_token } = tokenResponse.data;

    const response = await axios.get("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${access_token}`, // Retrieve from DB
        "Notion-Version": "2022-06-28",
      },
    });

    await prisma.user.update({
      where: { username: user.username },
      data: { notion_access_token: access_token, notion_login: true },
    });

    return res
      .status(200)
      .json({ success: true, message: "Integrated successfully" });
  } catch (err) {
    console.log(err.response.data);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};
