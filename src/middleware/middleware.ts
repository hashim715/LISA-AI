import jwt from "jsonwebtoken";
import { prisma } from "../config/postgres";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import jwt_decode from "jwt-decode";
import {
  internalServerError,
  unauthorizedErrorResponse,
  notFoundResponse,
} from "../controllers/errors";

dotenv.config();

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token = req.cookies.authToken; // Get token from HTTP-only cookie

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
    next();
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};
