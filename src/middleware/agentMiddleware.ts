import jwt from "jsonwebtoken";
import { prisma } from "../config/postgres";
import { Request, Response, NextFunction, RequestHandler } from "express";
import dotenv from "dotenv";
import jwt_decode from "jwt-decode";
import {
  internalServerError,
  unauthorizedErrorResponse,
  notFoundResponse,
} from "../controllers/errors";

dotenv.config();

export const protectAgent: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { token }: { token: string } = req.body;

  if (!token) {
    return unauthorizedErrorResponse(res);
  }

  try {
    const verify = jwt.verify(token, process.env.JWT_SECRET_REFRESH);

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user) {
      return notFoundResponse(res);
    }

    req.cookies.authToken = token;

    next();
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};
