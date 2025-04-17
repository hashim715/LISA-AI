import express from "express";
import { Router } from "express";
import {
  googleAuth,
  googleredirectauth,
  outlookAuth,
  outlookredirectauth,
  getUser,
  logOut,
  refreshToken,
  notionAuth,
  integrateNotionAccount,
  slackAuth,
  integrateslackAccount,
} from "../controllers/authentication";

import { protect } from "../middleware/middleware";

export const authRouter: Router = express.Router();

authRouter.route("/google").get(googleAuth);
authRouter.route("/google/callback").post(googleredirectauth);
authRouter.route("/outlook").get(outlookAuth);
authRouter.route("/outlook/callback").post(outlookredirectauth);
authRouter.route("/me").get(getUser);
authRouter.route("/logout").get(logOut);
authRouter.route("/refresh").post(refreshToken);
authRouter.route("/notion").get(notionAuth);
authRouter.route("/notion/callback").post(protect, integrateNotionAccount);
authRouter.route("/slack").get(slackAuth);
authRouter.route("/slack/callback").post(protect, integrateslackAccount);
