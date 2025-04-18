import express, { Application, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { authRouter } from "./routes/authRoutes";
import { userRouter } from "./routes/userRoutes";
import bodyParser from "body-parser";
import timeout from "connect-timeout";
import { prisma } from "./config/postgres";
import cron from "node-cron";
// import { limiter } from "./middleware/rateLimiter";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { getGoogleEmails, getGoogleCalenderEvents } from "./utils/gmailApi";
import { getOutlookEmails, getOutlookCalenderEvents } from "./utils/outlookApi";
import {
  extractDatabaseContent,
  getPageTitle,
  retrieveBlockChildren,
  formatPageContent,
} from "./utils/notionFuncs";
import { Client } from "@notionhq/client";
import { summarizeNotionWithLLM } from "./utils/chatgptFuncs";
import { refreshAccessTokensFunc } from "./utils/refreshAccessTokensFunc";
import { twilio_client } from "./utils/twilioClient";

dotenv.config();

const app: Application = express();
const PORT: number = parseInt(process.env.PORT) || 5001;

app.use(express.json());
app.use(cookieParser());
// Trust first proxy (e.g., NGINX, AWS Load Balancer, Cloudflare)
app.set("trust proxy", 1);
app.use(helmet()); // Sets HTTP security headers
const allowedOrigins = [
  "http://localhost:5173",
  "https://ourlisa.com",
  "https://www.ourlisa.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(timeout("90s"));

// rate limiter
// app.use(limiter);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  if (req.timedout) {
    return res.status(503).json({
      success: false,
      message: "Your request has timed out. Please try again later.",
    });
  }
  return res
    .status(500)
    .json({ success: false, message: "Something went wrong try again.." });
});

app.use("/v1/auth", authRouter);
app.use("/v1/user", userRouter);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  if (req.timedout) {
    return res.status(503).json({
      success: false,
      message: "Your request has timed out. Please try again later.",
    });
  }
  return res
    .status(500)
    .json({ success: false, message: "Something went wrong try again.." });
});

const server: http.Server = http.createServer(app);

const getPrepCronExpression = (briefTime: string) => {
  const [hours, minutes] = briefTime.split(" ")[0].split(":").map(Number);
  let prepMinutes = minutes - 10;
  let prepHours = hours;

  if (prepMinutes < 0) {
    prepMinutes += 60;
    prepHours = prepHours === 0 ? 23 : prepHours - 1;
  }

  return `0 ${prepMinutes} ${prepHours} * * *`; // e.g., "0 50 6 * * *" for 6:50 AM
};

const prepareMorningBrief = async (user: any) => {
  try {
    let google_emails: Array<any> = [];
    let outlook_emails: Array<any> = [];

    let google_calender_events: Array<any> = [];
    let outlook_calender_events: Array<any> = [];

    await refreshAccessTokensFunc(user.token);

    if (user.google_login) {
      google_emails = await getGoogleEmails(
        user.google_access_token,
        user.timeZone
      );
    }

    if (user.outlook_login) {
      outlook_emails = await getOutlookEmails(user.outlook_access_token);
    }

    if (user.google_login) {
      google_calender_events = await getGoogleCalenderEvents(
        user.google_access_token
      );
    }

    if (user.outlook_login) {
      outlook_calender_events = await getOutlookCalenderEvents(
        user.outlook_access_token
      );
    }

    let notion_summary = null;

    if (user.notion_login) {
      const notion = new Client({ auth: user.notion_access_token });

      const searchResponse = await notion.search({
        filter: {
          value: "page",
          property: "object",
        },
      });

      let allContent = "";

      for (const item of searchResponse.results as any) {
        if (item.object === "database") {
          const databaseContent = await extractDatabaseContent(item.id, notion);
          allContent += databaseContent + "\n\n";
        } else if (item.object === "page") {
          const pageTitle = getPageTitle(item);

          const blocks = await retrieveBlockChildren(item.id, 0, notion);
          const pageContent = formatPageContent(item, blocks);
          allContent += pageContent + "\n\n---\n\n";
        }
      }

      console.log("\nGenerating summary...");
      notion_summary = await summarizeNotionWithLLM(allContent);
      console.log("\nDone generating summary...");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        morning_update_check: false,
        morning_update: JSON.stringify({
          notion_summary: notion_summary,
          google_calender_events: google_calender_events,
          outlook_calender_events: outlook_calender_events,
          google_emails: google_emails,
          outlook_emails: outlook_emails,
        }),
      },
    });

    if (user.phone_number) {
      const message = await twilio_client.messages.create({
        body: `Your morning brief is ready`,
        from: process.env.TWILIO_ACCOUNT_PHONE_NUMBER,
        to: user.phone_number,
      });
    }
  } catch (err) {
    console.log(err);
  }
};

// Schedule cron jobs for all users on server start
export const scheduleUserBriefs = async () => {
  try {
    const users = await prisma.user.findMany({});
    console.log(`Scheduling briefs for ${users.length} users`);

    users.forEach((user: any) => {
      if (user.morning_brief_time) {
        const cronExpression = getPrepCronExpression(user.morning_brief_time);
        console.log(`Scheduling brief for ${user.name} at ${cronExpression}`);

        // Schedule the cron job
        cron.schedule(
          cronExpression,
          () => {
            prepareMorningBrief(user);
          },
          {
            timezone: user.timeZone || "UTC",
          }
        );
      }
    });
  } catch (error) {
    console.error("Error scheduling briefs:", error);
  }
};

const start = async (): Promise<void> => {
  try {
    server.listen(PORT, (): void => {
      console.log(`Listening on port ${PORT}`);
    });
    await scheduleUserBriefs();
  } catch (err) {
    console.log(err);
  }
};

start();
