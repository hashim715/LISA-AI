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
  .post(protectAgent, refreshAccessToken, getUnreadEmails);
userRouter
  .route("/getCalenderEvents")
  .post(protectAgent, refreshAccessToken, getCalenderEvents);
userRouter
  .route("/getEmailsUsingSearchQuery/:searchField")
  .post(protectAgent, refreshAccessToken, getEmailsUsingSearchQuery);
userRouter.route("/getCurrentDateTime").get(getCurrentDateTime);
userRouter.route("/notionData").post(protectAgent, notionDataApi);
userRouter
  .route("/getProductHuntPosts/:topic")
  .post(protectAgent, getProductHuntPosts);
userRouter
  .route("/getMorningFeedback")
  .post(protectAgent, refreshAccessToken, concatenateallApis);
userRouter.route("/perplexityNews/:query").post(protectAgent, perplexityApi);
userRouter.route("/getUnreadMessages").post(protectAgent, getUnreadMessages);
userRouter.route("/sendMessage/:text").post(protectAgent, sendMessage);
userRouter
  .route("/getAuthorizedUrl")
  .get(protect, refreshAccessToken, getAuthorizedUrl);
userRouter
  .route("/refreshAccessTokens")
  .get(protect, refreshAccessToken, refreshAccessTokenController);
