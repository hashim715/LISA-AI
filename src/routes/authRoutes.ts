import express from "express";
import { Router } from "express";
import { googleAuth, googleredirectauth } from "../controllers/authentication";

export const authRouter: Router = express.Router();

authRouter.route("/google").get(googleAuth);
authRouter.route("/google/callback").get(googleredirectauth);
