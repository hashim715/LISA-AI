import { Response } from "express";
import { sendToken } from "./sendToken";
import dotenv from "dotenv";

dotenv.config();

export const sendTokenCookie = async (res: Response, username: string) => {
  const token = await sendToken(username);

  res.cookie("authToken", token.token, {
    httpOnly: true,
    secure: process.env.ENV == "production" ? true : false,
    sameSite: process.env.ENV == "production" ? "none" : "strict",
  });
};
