import express from "express";
import { Router } from "express";
import {
  getUnreadEmails,
  getCurrentDateTime,
  getEmailsUsingSearchQuery,
  getCalenderEvents,
  notionClientApiTesting,
  getProductHuntPosts,
  concatenateallApis,
  perplexityApi,
  getUnreadMessages,
  sendMessage,
} from "../controllers/user";

import { protect } from "../middleware/middleware";
import { refreshAccessToken } from "../middleware/refreshAccessToken";

export const userRouter: Router = express.Router();

userRouter
  .route("/getUnreadEmails")
  .get(protect, refreshAccessToken, getUnreadEmails);
userRouter
  .route("/getCalenderEvents")
  .get(protect, refreshAccessToken, getCalenderEvents);
userRouter
  .route("/getEmailsUsingSearchQuery/:searchField")
  .get(protect, refreshAccessToken, getEmailsUsingSearchQuery);
userRouter.route("/getCurrentDateTime").get(getCurrentDateTime);
userRouter.route("/notionData").get(protect, notionClientApiTesting);
userRouter
  .route("/getProductHuntPosts/:topic")
  .get(protect, getProductHuntPosts);
userRouter
  .route("/getMorningFeedback")
  .get(protect, refreshAccessToken, concatenateallApis);
userRouter.route("/perplexityNews").get(protect, perplexityApi);
userRouter.route("/getUnreadMessages").get(protect, getUnreadMessages);
userRouter.route("/sendMessage").get(protect, sendMessage);
