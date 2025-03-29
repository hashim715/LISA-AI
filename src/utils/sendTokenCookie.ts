import { Response } from "express";
import { sendToken } from "./sendToken";

export const sendTokenCookie = async (res: Response, username: string) => {
  const token = await sendToken(username);

  res.cookie("authToken", token.token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
};
