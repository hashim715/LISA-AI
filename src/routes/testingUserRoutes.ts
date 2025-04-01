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
} from "../controllers/testinguser";

export const testingUserRouter: Router = express.Router();

testingUserRouter.route("/getUnreadEmails").get(getUnreadEmails);
testingUserRouter.route("/getCalenderEvents").get(getCalenderEvents);
testingUserRouter
  .route("/getEmailsUsingSearchQuery/:searchField")
  .get(getEmailsUsingSearchQuery);
testingUserRouter.route("/getCurrentDateTime").get(getCurrentDateTime);
testingUserRouter.route("/notionTesting").get(notionClientApiTesting);
testingUserRouter.route("/getProductHuntPosts/:topic").get(getProductHuntPosts);
testingUserRouter.route("/getMorningFeedback").get(concatenateallApis);
testingUserRouter.route("/perplexityNews").get(perplexityApi);
