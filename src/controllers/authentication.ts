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

    return res.status(200).json({ success: true, message: "good" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
  }
};
