import jwt from "jsonwebtoken";
import { prisma } from "../config/postgres";
import dotenv from "dotenv";
dotenv.config();

const getSignedToken: Function = async (
  username: string
): Promise<{ token: string }> => {
  const token = jwt.sign(
    { username: username },
    process.env.JWT_SECRET_REFRESH,
    { expiresIn: "10d" }
  );

  const expiryDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

  const user = await prisma.user.update({
    where: { username: username },
    data: { token: token, expiresAt: expiryDate.toISOString() },
  });

  const tokens = {
    token: token,
  };

  return tokens;
};

export const sendToken = async (
  username: string
): Promise<{ token: string }> => {
  const token = await getSignedToken(username);

  return token;
};

module.exports = { sendToken };
