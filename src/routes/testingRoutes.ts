import express from "express";
import { Router } from "express";
import {
  linkedlnAuth,
  linkedlnredirectauth,
  googleAuth,
  googleredirectauth,
  testingAppRedirect,
  getUnreadEmails,
  getCalenderEvents,
  refreshGoogleAccessToken,
  outlookAuth,
  outlookredirectauth,
  getOutlookUnreadEmails,
  getOutlookEvents,
  getGmailOutlookUnreadEmails,
  getGmailOutlookCalenderEvents,
} from "../controllers/testing";

export const testingRouter: Router = express.Router();

testingRouter.route("/auth/linkedin").get(linkedlnAuth);
testingRouter.route("/auth/linkedin/callback").get(linkedlnredirectauth);
testingRouter.route("/auth/google").get(googleAuth);
testingRouter.route("/auth/google/callback").get(googleredirectauth);
testingRouter.route("/testappredirect").get(testingAppRedirect);
testingRouter.route("/getUnreadEmails").get(getUnreadEmails);
testingRouter.route("/getCalenderEvents").get(getCalenderEvents);
testingRouter.route("/refreshGoogleAccessToken").get(refreshGoogleAccessToken);
testingRouter.route("/auth/outlook").get(outlookAuth);
testingRouter.route("/auth/outlook/callback").get(outlookredirectauth);
testingRouter.route("/getOutlookUnReadEmails").get(getOutlookUnreadEmails);
testingRouter.route("/getOutlookEvents").get(getOutlookEvents);
testingRouter
  .route("/getOutlookGmailUnreadEmails")
  .get(getGmailOutlookUnreadEmails);
testingRouter
  .route("/getOutlookGmailCalenderEvents")
  .get(getGmailOutlookCalenderEvents);
