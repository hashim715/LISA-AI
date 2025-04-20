import jwt from "jsonwebtoken";
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
import { JwtPayload } from "../utils/types";
import { logger } from "../utils/logger";

dotenv.config();

export const protectAgent: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { token }: { token: string } = req.body;

  if (!token) {
    return unauthorizedErrorResponse(res, "Authentication token missing");
  }

  try {
    const verify = jwt.verify(token, process.env.JWT_SECRET_REFRESH);

    // Decode token
    let decoded: JwtPayload;
    try {
      decoded = jwt_decode<JwtPayload>(token);
    } catch (err) {
      return badRequestResponse(res, "Invalid authentication token");
    }

    const { username }: { username: string } = decoded;

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user) {
      return notFoundResponse(res);
    }

    req.cookies.authToken = token;

    next();
  } catch (err) {
    logger.error("Error in agentMiddleware:", err);
    if (!res.headersSent) {
      return internalServerError(res, "Failed to validate token");
    }
  } finally {
    await prisma.$disconnect();
  }
};
