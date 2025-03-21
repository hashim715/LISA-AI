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
} from "../controllers/testing";

export const testingRouter: Router = express.Router();

testingRouter.route("/auth/linkedin").get(linkedlnAuth);
testingRouter.route("/auth/linkedin/callback").get(linkedlnredirectauth);
testingRouter.route("/auth/google").get(googleAuth);
testingRouter.route("/auth/google/callback").get(googleredirectauth);
testingRouter.route("/testappredirect").get(testingAppRedirect);
testingRouter.route("/getUnreadEmails").get(getUnreadEmails);
testingRouter.route("/getCalenderEvents").get(getCalenderEvents);
