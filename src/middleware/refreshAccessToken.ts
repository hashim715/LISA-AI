import { prisma } from "../config/postgres";
import { Request, Response, NextFunction, RequestHandler } from "express";
import dotenv from "dotenv";
import jwt_decode from "jwt-decode";
import {
  internalServerError,
  unauthorizedErrorResponse,
  notFoundResponse,
  badRequestResponse,
} from "../controllers/errors";
import axios from "axios";

dotenv.config();

export const refreshGoogleAccessToken = async (
  refresh_token: string
): Promise<null | any> => {
  try {
    const response = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        refresh_token: refresh_token,
        grant_type: "refresh_token",
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    return response.data;
  } catch (err) {
    console.log(err.response.data);
    return null;
  }
};

export const refreshOutlookAccessToken = async (
  refresh_token: string
): Promise<null | any> => {
  try {
    const response = await axios.post(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET,
        redirect_uri: process.env.OUTLOOK_REDIRECT_URI,
        refresh_token: refresh_token,
        grant_type: "refresh_token",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    return response.data;
  } catch (err) {
    console.log(err.response.data);
    return null;
  }
};

export const refreshAccessToken: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let token = req.cookies.authToken;

    if (!token) {
      return unauthorizedErrorResponse(res);
    }

    const { username }: { username: string } = jwt_decode(token);
    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user) {
      return notFoundResponse(res);
    }

    if (user.google_login) {
      const currentDate = new Date();
      const expiryDate = new Date(user.google_token_expiry);

      const isExpired: boolean = expiryDate < currentDate;

      if (isExpired) {
        const google_token_data = await refreshGoogleAccessToken(
          user.google_refresh_token
        );

        if (!google_token_data) {
          return badRequestResponse(res, "Something went wrong");
        }

        const expiryDate = new Date(
          Date.now() + parseInt(google_token_data.expires_in) * 1000
        );

        await prisma.user.update({
          where: { email: user.email },
          data: {
            google_access_token: google_token_data.access_token,
            google_refresh_token: google_token_data.refresh_token,
            google_token_expiry: expiryDate.toISOString(),
          },
        });
      }
    }

    if (user.outlook_login) {
      const currentDate = new Date();
      const expiryDate = new Date(user.outlook_token_expiry);

      const isExpired: boolean = expiryDate < currentDate;

      if (isExpired) {
        const outlook_token_data = await refreshOutlookAccessToken(
          user.outlook_refresh_token
        );

        if (!outlook_token_data) {
          return badRequestResponse(res, "Something went wrong");
        }

        const expiryDate = new Date(
          Date.now() + parseInt(outlook_token_data.expires_in) * 1000
        );

        await prisma.user.update({
          where: { email: user.email },
          data: {
            outlook_access_token: outlook_token_data.access_token,
            outlook_refresh_token: outlook_token_data.refresh_token,
            outlook_token_expiry: expiryDate.toISOString(),
          },
        });
      }
    }

    next();
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};
