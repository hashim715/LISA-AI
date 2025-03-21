import { prisma } from "../config/postgres";
import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt_decode from "jwt-decode";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import queryString from "query-string";
import dotenv from "dotenv";
import axios from "axios";
import { htmlToText } from "html-to-text";

dotenv.config();

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
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: process.env.GOOGLE_SCOPES, // Add 'https://mail.google.com/' for email access
        access_type: "offline", // For refresh tokens
        prompt: "consent", // Forces consent screen for testing
      });

    return res.status(200).json({ success: true, message: authUrl });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};

export const googleredirectauth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res
        .status(400)
        .json({ success: false, message: "Try again something went wrong!" });
    }

    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      queryString.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const userInfoResponse = await axios.get(
      "https://people.googleapis.com/v1/people/me",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        params: { personFields: "names,emailAddresses" }, // Required for People API
      }
    );

    const username: string = "hashim715";

    const codeToSend = Math.floor(100000 + Math.random() * 900000).toString();

    const currentDate = new Date();
    const next1Minutes = new Date(currentDate.getTime() + 1 * 60 * 1000);

    // await prisma.user.create({
    //   data: {
    //     email: userInfoResponse.data.email,
    //     username: username,
    //     google_login: true,
    //     google_access_token: access_token,
    //     google_refresh_token: refresh_token,
    //     google_token_expiry: expires_in,
    //     one_time_code: codeToSend,
    //     one_time_code_expiry: next1Minutes.toISOString(),
    //   },
    // });

    return res.redirect(`http://localhost:5173?code=${codeToSend}/`);
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};
