import jwt from "jsonwebtoken";
import { prisma } from "../config/postgres";
import dotenv from "dotenv";
import { Response } from "express";
dotenv.config();

const getSignedToken: Function = async (
  username: string
): Promise<{ token: string }> => {
  const token = jwt.sign(
    { username: username },
    process.env.JWT_SECRET_REFRESH,
    { expiresIn: "10d" }
  );
  const user = await prisma.user.update({
    where: { username: username },
    data: { token: token } as { token: string },
  });
  const tokens = {
    token: token,
  };
  return tokens;
};

export const sendToken = async (
  username: string,
  statusCode: number,
  res: Response
): Promise<Response> => {
  const token = await getSignedToken(username);
  return res.status(statusCode).json({
    success: true,
    token: token.token,
  });
};

module.exports = { sendToken };
