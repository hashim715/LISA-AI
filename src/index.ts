import express, { Application, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
// import { userRouter } from "./routes/userRoutes";
import { testingRouter } from "./routes/testingRoutes";
import bodyParser from "body-parser";
import timeout from "connect-timeout";
// import { prisma } from "./config/postgres";
import cron from "node-cron";
// import { limiter } from "./middleware/rateLimiter";
import helmet from "helmet";

dotenv.config();

const app: Application = express();
const PORT: number = parseInt(process.env.PORT) || 5002;

app.use(express.json());
// Trust first proxy (e.g., NGINX, AWS Load Balancer, Cloudflare)
app.set("trust proxy", 1);
app.use(helmet()); // Sets HTTP security headers
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(timeout("40s"));

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

// app.use("/api/user", userRouter);
app.use("/v1/testing", testingRouter);

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

const scheduleTask = async () => {
  cron.schedule("*/1 * * * *", async () => {
    // Runs every minute
    const expirationTime = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago
    // await prisma.user.deleteMany({
    //   where: {
    //     isUserRegistered: false,
    //     createdAt: {
    //       lte: expirationTime,
    //     },
    //   },
    // });
  });
  console.log("Scheduler is set");
};

const start = async (): Promise<void> => {
  try {
    server.listen(PORT, (): void => {
      console.log(`Listening on port ${PORT}`);
    });
    await scheduleTask();
  } catch (err) {
    console.log(err);
  }
};

start();
