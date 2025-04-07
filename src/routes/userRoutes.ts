import express from "express";
import { Router } from "express";
import {
  getUnreadEmails,
  getCurrentDateTime,
  getEmailsUsingSearchQuery,
  getCalenderEvents,
  notionDataApi,
  getProductHuntPosts,
  concatenateallApis,
  perplexityApi,
  getUnreadMessages,
  sendMessage,
  getAuthorizedUrl,
  refreshAccessTokenController,
} from "../controllers/user";

import { protect } from "../middleware/middleware";
import { refreshAccessToken } from "../middleware/refreshAccessToken";
import { protectAgent } from "../middleware/agentMiddleware";

export const userRouter: Router = express.Router();

userRouter
  .route("/getUnreadEmails")
  .get(protectAgent, refreshAccessToken, getUnreadEmails);
userRouter
  .route("/getCalenderEvents")
  .get(protectAgent, refreshAccessToken, getCalenderEvents);
userRouter
  .route("/getEmailsUsingSearchQuery/:searchField")
  .get(protectAgent, refreshAccessToken, getEmailsUsingSearchQuery);
userRouter.route("/getCurrentDateTime").get(getCurrentDateTime);
userRouter.route("/notionData").get(protectAgent, notionDataApi);
userRouter
  .route("/getProductHuntPosts/:topic")
  .get(protectAgent, getProductHuntPosts);
userRouter
  .route("/getMorningFeedback")
  .get(protectAgent, refreshAccessToken, concatenateallApis);
userRouter.route("/perplexityNews").post(protectAgent, perplexityApi);
userRouter.route("/getUnreadMessages").get(protectAgent, getUnreadMessages);
userRouter.route("/sendMessage").get(protectAgent, sendMessage);
userRouter
  .route("/getAuthorizedUrl")
  .get(protect, refreshAccessToken, getAuthorizedUrl);
userRouter
  .route("/refreshAccessTokens")
  .get(protect, refreshAccessToken, refreshAccessTokenController);
