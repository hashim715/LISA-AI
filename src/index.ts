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
import { refreshAccessTokensFunc } from "./utils/refreshAccessTokensFunc";
import { twilio_client } from "./utils/twilioClient";
import { logger } from "./utils/logger";

import {
  getSlackMessages,
  getPerplexityNews,
  getNotionSummaryForMorningUpdate,
} from "./utils/helper_functions";

import {
  getSearchNewsQueryFromMorningPreferences,
  getEventsFromMorningPreferences,
  getrelevantEventsFromMorningPreferences,
} from "./utils/chatgptFuncs";

import {
  Email,
  CalenderEvent,
  NotionSummary,
  Slack,
  PerplexityNews,
} from "./utils/types";

dotenv.config();

const app: Application = express();
const PORT: number = parseInt(process.env.PORT || "5002");

app.use(express.json());
app.use(cookieParser());
// Trust first proxy (e.g., NGINX, AWS Load Balancer, Cloudflare)
app.set("trust proxy", 1);
app.use(helmet()); // Sets HTTP security headers
const allowedOrigins = [
  "http://localhost:5173",
  "https://ourlisa.com",
  "https://www.ourlisa.com",
  "https://beta.ourlisa.com",
  "http://192.168.1.168:5173",
  "http://0.0.0.0:5173",
];

const corsOptions =
  process.env.ALLOW_ALL_ORIGINS === "true"
    ? {
        origin: function (origin: any, callback: any) {
          callback(null, origin || "*"); // Allow all origins
        },
        credentials: true,
      }
    : {
        origin: function (origin: any, callback: any) {
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          } else {
            return callback(new Error("Not allowed by CORS"));
          }
        },
        credentials: true,
      };

app.use(cors(corsOptions));

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

const updateUserStateAndSendMorningBriefMessage = async (user: any) => {
  await prisma.user.update({
    where: { id: user.id },
    data: {
      morning_update_check: false,
    },
  });

  if (user.phone_number) {
    const message = await twilio_client.messages.create({
      body: `Your morning brief is ready! View it here: https://beta.ourlisa.com/main`,
      from: process.env.TWILIO_ACCOUNT_PHONE_NUMBER,
      to: user.phone_number,
    });
  }
};

const prepareMorningBrief = async (user: any) => {
  try {
    user = await refreshAccessTokensFunc(user.token);

    if (!user) {
      return;
    }

    const user_events: string = await getEventsFromMorningPreferences(
      user.morning_update_preferences || ""
    );

    const serach_query: string = await getSearchNewsQueryFromMorningPreferences(
      user.morning_update_preferences || ""
    );

    const events = ``;

    const results = await Promise.allSettled([
      user.google_login && user.google_access_token
        ? getGoogleEmails(user.google_access_token, user.timeZone)
        : Promise.resolve([]),
      user.outlook_login && user.outlook_access_token
        ? getOutlookEmails(user.outlook_access_token)
        : Promise.resolve([]),
      user.google_login && user.google_access_token
        ? getGoogleCalenderEvents(user.google_access_token, user.timeZone)
        : Promise.resolve([]),
      user.outlook_login && user.outlook_access_token
        ? getOutlookCalenderEvents(user.outlook_access_token)
        : Promise.resolve([]),
      user.slack_login && user.slack_user_access_token
        ? getSlackMessages(user.slack_user_access_token, user.timeZone)
        : Promise.resolve([]),
      user.notion_login && user.notion_access_token
        ? getNotionSummaryForMorningUpdate(user.notion_access_token)
        : Promise.resolve([]),
      user.morning_update_preferences
        ? getPerplexityNews(serach_query)
        : Promise.resolve([]),
      getrelevantEventsFromMorningPreferences(user_events, events),
    ]);

    const response: {
      success: boolean;
      google_unread_emails: Array<Email>;
      outlook_unread_emails: Array<Email>;
      google_calender_events: Array<CalenderEvent>;
      outlook_calender_events: Array<CalenderEvent>;
      all_unread_messages: Array<Slack>;
      notion_summary: NotionSummary;
      perplexity_news: PerplexityNews;
      event_data: string;
      message?: string;
      failedServices?: string[];
    } = {
      success: true,
      google_unread_emails: [],
      outlook_unread_emails: [],
      google_calender_events: [],
      outlook_calender_events: [],
      all_unread_messages: [],
      notion_summary: {
        summary: "could not get summary for notion you can try again",
      },
      perplexity_news: { news: "No news" },
      event_data: "No event data",
      message: "your morning update is ready",
    };

    const serviceMap = [
      { name: "Google Unread Emails", key: "google_unread_emails" },
      { name: "Outlook Unread Emails", key: "outlook_unread_emails" },
      { name: "Google Calender events", key: "google_calender_events" },
      { name: "Outlook Calender events", key: "outlook_calender_events" },
      { name: "Notion summary", key: "notion_summary" },
      { name: "Perplexity News", key: "perplexity_news" },
      { name: "Event Data", key: "event_data" },
    ];

    const failedServices: string[] = [];
    results.forEach(
      (
        result: PromiseSettledResult<
          | Array<Email>
          | Array<CalenderEvent>
          | Array<Slack>
          | NotionSummary
          | PerplexityNews
          | string
        >,
        index: number
      ) => {
        const service = serviceMap[index];
        if (result.status === "fulfilled") {
          (response as any)[service.key] = result.value || [];
        } else {
          logger.error(`${service.name} fetch error: ${result.reason}`);
          failedServices.push(service.name);
        }
      }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        morning_update_check: false,
        morning_update: JSON.stringify({
          notion_summary: response.notion_summary,
          google_calender_events: response.google_calender_events,
          outlook_calender_events: response.outlook_calender_events,
          google_emails: response.google_unread_emails,
          outlook_emails: response.outlook_unread_emails,
          slack_unread_messages: response.all_unread_messages,
          perplexity_news: response.perplexity_news,
          event_data: response.event_data,
        }),
      },
    });

    if (user.phone_number) {
      const message = await twilio_client.messages.create({
        body: `Your morning brief is ready! View it here: https://beta.ourlisa.com/main`,
        from: process.env.TWILIO_ACCOUNT_PHONE_NUMBER,
        to: user.phone_number,
      });
    }
  } catch (err) {
    console.log(err);
    await updateUserStateAndSendMorningBriefMessage(user);
  }
};

const setMorningBriefCheck = async (user: any) => {
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        morning_update_check: true,
      },
    });
  } catch (err) {
    console.log(err);
  }
};

// Schedule cron jobs for all users on server start
export const scheduleUserBriefs = async () => {
  try {
    const users = await prisma.user.findMany({});
    console.log(`Scheduling morning briefs for ${users.length} users`);

    users.forEach((user: any) => {
      if (user.morning_brief_time) {
        const cronExpression = getPrepCronExpression(user.morning_brief_time);

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
    logger.error("Error scheduling briefs:", error);
  }
};

export const scheduleUserMorningUpdateCheck = async () => {
  try {
    const users = await prisma.user.findMany({});
    console.log(`Scheduling morning brief checkers for ${users.length} users`);

    users.forEach((user: any) => {
      if (user.morning_brief_time) {
        const cronExpression = "0 12 * * *"; // 12 PM every day

        // Schedule the cron job
        cron.schedule(
          cronExpression,
          () => {
            setMorningBriefCheck(user);
          },
          {
            timezone: user.timeZone || "UTC",
          }
        );
      }
    });
  } catch (err) {
    logger.error("Error scheduling brief checks:", err);
  }
};

const start = async (): Promise<void> => {
  try {
    server.listen(PORT, (): void => {
      logger.info(`Listening on port ${PORT}`);
    });
    await scheduleUserBriefs();
    await scheduleUserMorningUpdateCheck();
  } catch (err) {
    logger.error(err);
  }
};

start();
