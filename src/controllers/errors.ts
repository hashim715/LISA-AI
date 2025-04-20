import { Response } from "express";

export const internalServerError = (
  res: Response,
  messaeg: string = "Something went wrong"
) => {
  return res.status(500).json({ success: false, message: messaeg });
};

export const forbiddenResponse = (res: Response) => {
  return res.status(403).json({ success: false, message: "forbidden" });
};

export const badRequestResponse = (res: Response, message: string) => {
  return res.status(400).json({ success: false, message: message });
};

export const confictResponse = (res: Response, message: string) => {
  return res.status(409).json({ success: false, message: message });
};

export const notFoundResponse = (
  res: Response,
  message: string = "not found"
) => {
  return res.status(404).json({ success: false, message: message });
};

export const unauthorizedErrorResponse = (
  res: Response,
  message: string = "unauthorized"
) => {
  return res.status(401).json({ success: false, message: message });
};
