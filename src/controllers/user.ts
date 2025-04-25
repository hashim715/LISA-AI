import { prisma } from "../config/postgres";
import { Request, Response, NextFunction, RequestHandler } from "express";
import axios from "axios";
import jwt_decode from "jwt-decode";
import {
  internalServerError,
  badRequestResponse,
  notFoundResponse,
} from "./errors";
import { Client } from "@notionhq/client";
import {
  getAllPages,
  searchNotion,
  getAllDatabases,
  getDatabaseTitle,
  updatePageTitle,
  selectPageBasedOnInput,
  getPageTitle,
  getDatabaseItems,
  parseUserInput,
  getItemTitle,
  updateItemStatus,
  findPage,
  archivePage,
  findMostSimilarDatabase,
  parseUserInputForChangeDueDate,
  updateItemDueDate,
  getFieldInfo,
  parseEntryInput,
  addDatabaseEntryFunc,
} from "../utils/notionFuncs";
import {
  getChannelNameUsingLLM,
  getPreferencesSummary,
  getSearchNewsQueryFromMorningPreferences,
  getEventsFromMorningPreferences,
  getrelevantEventsFromMorningPreferences,
} from "../utils/chatgptFuncs";
import {
  getConversations,
  sendMessageAsUser,
  getUnreadMessagesFunc,
  getLastReadTimestamp,
  formatUnreadMessages,
  getUsername,
} from "../utils/slackApi";
import {
  getGoogleEmails,
  getGoogleCalenderEvents,
  getGoogleEmailsFromSpecificSender,
  getLatestReadGoogleEmails,
  getLatestUnreadGoogleEmails,
} from "../utils/gmailApi";
import {
  getOutlookEmails,
  getOutlookCalenderEvents,
  getOutlookEmailsFromSpecificSender,
} from "../utils/outlookApi";
import {
  addGoogleCalenderFunc,
  addOutlookCalenderFunc,
  draftGoogleGmailFunc,
  draftOutlookMailFunc,
  draftGoogleGmailReplyFunc,
  draftOutlookMailReplyFunc,
  updateGoogleCalenderFunc,
  deleteGoogleCalenderFunc,
  deleteGoogleGmailFunc,
} from "../utils/controllerFuncs";
import { scheduleUserBriefs } from "../index";
import { validatePhoneNumber } from "../utils/validatePhoneNumber";
import { twilio_client } from "../utils/twilioClient";
import { DateTime } from "luxon";
import {
  areaCodeToTimeZone,
  regionToTimeZone,
} from "../utils/allStateTimeZones";
import { logger } from "../utils/logger";
import {
  Email,
  CalenderEvent,
  Slack,
  NotionSummary,
  PerplexityNews,
} from "../utils/types";

import {
  getSlackMessages,
  getNotionSummaryForMorningUpdate,
  getPerplexityNews,
  getNotionDatabaseSummary,
} from "../utils/helper_functions";

import { new_user_system_prompt } from "../constants/constants";

const isNonEmptyString = (value: any): boolean => {
  return typeof value === "string" && value.trim().length > 0;
};

const deleteNotionPage = async (query: string, notion: Client) => {
  const page = await findPage(query, notion);

  if (!page) {
    logger.error("⚠️ No matching page found.");
    throw new Error("No matching page found.");
  }

  await archivePage(page.id, notion);
};

const updateNotionPageTitle = async (
  notion: Client,
  page: string,
  pageTitle: string
) => {
  const pages = await getAllPages(notion);

  if (pages.length === 0) {
    logger.error("No pages found in the workspace");
    throw new Error("No page found in the workspace");
  }

  const selectedPage = await selectPageBasedOnInput(pages, page);

  if (!selectedPage) {
    logger.error(
      "Could not find a matching page. Please try again with a more specific description."
    );
    throw new Error("Could not find a matching page");
  }

  const currentTitle = getPageTitle(selectedPage);
  logger.info(`Found page: "${currentTitle}"`);

  const success = await updatePageTitle(selectedPage.id, pageTitle, notion);

  if (success) {
    logger.info(
      `Successfully changed title from "${currentTitle}" to "${pageTitle}"`
    );
  } else {
    logger.error("Failed to update the page title");
    throw new Error("Failed to update the page title");
  }
};

const changeStatusInNotion = async (notion: Client, input: string) => {
  const databases = await getAllDatabases(notion);

  if (databases.length === 0) {
    logger.error("No databases found in the workspace");
    throw new Error("No databases found in the workspace");
  }

  const allItems = [];
  for (const db of databases) {
    const items = await getDatabaseItems(db.id, notion);
    allItems.push(...items.map((item) => ({ ...item, databaseId: db.id })));
  }

  // Parse the predefined input
  const parsedInput = await parseUserInput(input, databases, allItems);

  console.log(parsedInput);

  if (
    !parsedInput ||
    !parsedInput.database ||
    !parsedInput.item ||
    !parsedInput.status
  ) {
    logger.error("Could not understand the predefined request.");
    throw new Error("Could not understand the predefined request.");
  }

  // Find the selected database
  const selectedDatabase = databases.find(
    (db) =>
      getDatabaseTitle(db).toLowerCase() === parsedInput.database.toLowerCase()
  );

  console.log(selectedDatabase);

  if (!selectedDatabase) {
    logger.error("Could not find the specified database");
    throw new Error("Could not find the specified database");
  }

  // Find the selected item
  const selectedItem = allItems.find(
    (item) =>
      getItemTitle(item).toLowerCase() === parsedInput.item.toLowerCase() &&
      item.databaseId === selectedDatabase.id
  );

  console.log(selectedItem);

  if (!selectedItem) {
    logger.error("Could not find the specified item in the database");
    throw new Error("Could not find the specified item in the database");
  }

  const success = await updateItemStatus(
    selectedItem.id,
    parsedInput.status,
    notion
  );

  if (success) {
    logger.info(
      `Successfully updated "${getItemTitle(selectedItem)}" status to "${
        parsedInput.status
      }" in "${getDatabaseTitle(selectedDatabase)}"`
    );
  } else {
    logger.error("Failed to update the item status");
    throw new Error("Failed to update the item status");
  }
};

const changeDueDate = async (notion: Client, userInput: string) => {
  const databases = await getAllDatabases(notion);

  if (databases.length === 0) {
    logger.error("No databases found in the workspace");
    throw new Error("No databases found in the workspace");
  }

  const allItems = [];
  for (const db of databases) {
    const items = await getDatabaseItems(db.id, notion);
    allItems.push(...items.map((item) => ({ ...item, databaseId: db.id })));
  }

  const parsedInput = await parseUserInputForChangeDueDate(
    userInput,
    databases,
    allItems
  );

  console.log(parsedInput);

  if (
    !parsedInput ||
    !parsedInput.database ||
    !parsedInput.item ||
    !parsedInput.dueDate
  ) {
    logger.error(
      "Could not understand your request. Please try again with a clearer description."
    );
    throw new Error(
      "Could not understand your request. Please try again with a clearer description."
    );
  }

  const similarDatabaseName = await findMostSimilarDatabase(
    databases,
    parsedInput.database
  );
  if (!similarDatabaseName) {
    logger.error("Could not find a similar database to the one specified");
    throw new Error("Could not find a similar database to the one specified");
  }

  const selectedDatabase = databases.find(
    (db) => getDatabaseTitle(db) === similarDatabaseName
  );

  if (!selectedDatabase) {
    logger.error("Could not find the specified database");
    throw new Error("Could not find the specified database");
  }

  const selectedItem = allItems.find(
    (item) =>
      getItemTitle(item).toLowerCase() === parsedInput.item.toLowerCase() &&
      item.databaseId === selectedDatabase.id
  );

  if (!selectedItem) {
    logger.error("Could not find the specified item in the database");
    throw new Error("Could not find the specified item in the database");
  }

  const success = await updateItemDueDate(
    selectedItem.id,
    parsedInput.dueDate,
    notion
  );

  if (success) {
    logger.info(
      `Successfully updated "${getItemTitle(selectedItem)}" due date to "${
        parsedInput.dueDate
      }" in "${getDatabaseTitle(selectedDatabase)}"`
    );
  } else {
    logger.error("Failed to update the item due date");
    throw new Error("Failed to update the item due date");
  }
};

const addDatabaseEntry = async (
  databaseQuery: string,
  entryInput: string,
  notion: Client
) => {
  const databases = await getAllDatabases(notion);

  if (databases.length === 0) {
    logger.error("No databases found in the workspace");
    throw new Error("No databases found in the workspace");
  }

  // Find the most similar database using OpenAI
  const { database: selectedDatabase, confidence } =
    await findMostSimilarDatabase(databases, databaseQuery);

  if (!selectedDatabase) {
    logger.error(
      "❌ No matching database found. Please try again with a more specific name."
    );
    throw new Error(
      "❌ No matching database found. Please try again with a more specific name."
    );
  }

  console.log(`\nFound database: "${getDatabaseTitle(selectedDatabase)}"`);

  // Get database properties
  const database = await notion.databases.retrieve({
    database_id: selectedDatabase.id,
  });

  const fields = getFieldInfo(database.properties);
  console.log("\nAvailable fields:");
  fields.forEach((field) => console.log(`- ${field.name} (${field.type})`));

  // Parse the input and create entry
  const entry = await parseEntryInput(entryInput, database.properties);

  if (!entry) {
    logger.error("❌ Failed to create entry due to invalid input");
    throw new Error("❌ Failed to create entry due to invalid input");
  }

  // Add entry to database
  await addDatabaseEntryFunc(selectedDatabase.id, entry, notion);
};

export const getUnreadEmails: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    // Fetch emails concurrently with Promise.allSettled
    const emailFetchResults = await Promise.allSettled([
      user?.google_login && user.google_access_token
        ? getGoogleEmails(user.google_access_token, user.timeZone)
        : Promise.resolve([]),
      user?.outlook_login && user.outlook_access_token
        ? getOutlookEmails(user.outlook_access_token)
        : Promise.resolve([]),
    ]);

    // Process results
    const response: {
      success: boolean;
      google_emails: Array<Email>;
      outlook_emails: Array<Email>;
      message?: string;
      failedServices?: string[];
    } = {
      success: true,
      google_emails: [],
      outlook_emails: [],
      message: "these are the fetched unread emails",
    };

    const failedServices: string[] = [];
    emailFetchResults.forEach(
      (result: PromiseSettledResult<Email[]>, index: number) => {
        if (result.status === "fulfilled") {
          if (index === 0) {
            response.google_emails = result.value || [];
          } else {
            response.outlook_emails = result.value || [];
          }
        } else {
          const service = index === 0 ? "Google" : "Outlook";
          logger.error(`${service} email fetch error:`, result.reason);
          failedServices.push(service);
        }
      }
    );

    // Add message if no emails or no accounts connected
    if (
      response.google_emails.length === 0 &&
      response.outlook_emails.length === 0 &&
      (!user?.google_login || !user.outlook_login)
    ) {
      response.message =
        "No unread emails found or no email accounts connected";
      response.success = false;
    }

    if (failedServices.length > 0) {
      response.failedServices = failedServices;
    }

    return res.status(200).json(response);
  } catch (err) {
    logger.error("Error in getUnreadEmails:", err);
    if (!res.headersSent) {
      return internalServerError(res, "Failed to fetch emails");
    }
  } finally {
    await prisma.$disconnect();
  }
};

export const getEmailsUsingSearchQuery: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    const { searchField } = req.params;

    if (!searchField || !searchField.trim()) {
      return badRequestResponse(res, "please provide a valid search query.");
    }

    // Fetch emails concurrently with Promise.allSettled
    const emailFetchResults = await Promise.allSettled([
      user?.google_login && user.google_access_token
        ? getGoogleEmailsFromSpecificSender(
            user.google_access_token,
            searchField.trim(),
            user.timeZone
          )
        : Promise.resolve([]),
      user?.outlook_login && user.outlook_access_token
        ? getOutlookEmailsFromSpecificSender(
            user.outlook_access_token,
            searchField.trim()
          )
        : Promise.resolve([]),
    ]);

    // Process results
    const response: {
      success: boolean;
      google_emails: Array<Email>;
      outlook_emails: Array<Email>;
      message?: string;
      failedServices?: string[];
    } = {
      success: true,
      google_emails: [],
      outlook_emails: [],
      message: "these are the fetched emails",
    };

    const failedServices: string[] = [];
    emailFetchResults.forEach(
      (result: PromiseSettledResult<Email[]>, index: number) => {
        if (result.status === "fulfilled") {
          if (index === 0) {
            response.google_emails = result.value || [];
          } else {
            response.outlook_emails = result.value || [];
          }
        } else {
          const service = index === 0 ? "Google" : "Outlook";
          logger.error(`${service} email fetch error:`, result.reason);
          failedServices.push(service);
        }
      }
    );

    // Add message if no emails or no accounts connected
    if (
      response.google_emails.length === 0 &&
      response.outlook_emails.length === 0 &&
      (!user?.google_login || !user.outlook_login)
    ) {
      response.message =
        "No unread emails found or no email accounts connected";
      response.success = false;
    }

    if (failedServices.length > 0) {
      response.failedServices = failedServices;
    }

    return res.status(200).json(response);
  } catch (err) {
    logger.error("Error in getEmailsFromSpecificSender:", err);
    if (!res.headersSent) {
      return internalServerError(
        res,
        "Failed to fetch emails from specific sender"
      );
    }
  } finally {
    await prisma.$disconnect();
  }
};

export const deleteGoogleGmail: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    const { text }: { text: string } = req.body;

    if (!text || !text.trim()) {
      return badRequestResponse(res, "please provide valid input");
    }

    const response: {
      success: boolean;
      message?: string;
    } = {
      success: true,
      message: "email was deleted successfully",
    };

    await deleteGoogleGmailFunc(text, user).catch((err: Error) => {
      response.success = false;
      response.message = `failed to delete email due to this: ${
        err.message || err.toString()
      }`;
    });

    return res.status(200).json(response);
  } catch (err) {
    logger.error("Error in deleteGoogleEmail:", err);
    if (!res.headersSent) {
      return internalServerError(res, "Failed to delete email");
    }
  } finally {
    await prisma.$disconnect();
  }
};

export const getLatestEmails: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    // Fetch emails concurrently
    const results = await Promise.allSettled([
      user?.google_login && user.google_access_token
        ? getLatestUnreadGoogleEmails(user.google_access_token, user.timeZone)
        : Promise.resolve([]),
      user?.google_login && user.google_access_token
        ? getLatestReadGoogleEmails(user.google_access_token, user.timeZone)
        : Promise.resolve([]),
      user?.outlook_login && user.outlook_access_token
        ? getOutlookEmails(user.outlook_access_token)
        : Promise.resolve([]),
    ]);

    // Process results
    const response: {
      success: boolean;
      google_unread_emails: Array<Email>;
      google_read_emails: Array<Email>;
      outlook_emails: Array<Email>;
      message?: string;
      failedServices?: string[];
    } = {
      success: true,
      google_unread_emails: [],
      google_read_emails: [],
      outlook_emails: [],
      message: "these are the fetched emails",
    };

    // Map promises to services for clarity and scalability
    const serviceMap = [
      { name: "Google Unread Emails", key: "google_unread_emails" },
      { name: "Google Read Emails", key: "google_read_emails" }, // Optional
      { name: "Outlook Emails", key: "outlook_emails" },
    ];

    const failedServices: string[] = [];
    results.forEach((result: PromiseSettledResult<Email[]>, index: number) => {
      const service = serviceMap[index];
      if (result.status === "fulfilled") {
        (response as any)[service.key] = result.value || [];
      } else {
        logger.error(`${service.name} fetch error: ${result.reason}`);
        failedServices.push(service.name);
      }
    });

    // Check if no emails were fetched
    if (
      response.google_unread_emails.length === 0 &&
      response.google_read_emails.length === 0 &&
      response.outlook_emails.length === 0 &&
      (!user?.google_login || !user.outlook_login)
    ) {
      response.message =
        "No unread emails found or no email accounts connected";
      response.success = false;
    }

    if (failedServices.length > 0) {
      response.failedServices = failedServices;
    }

    return res.status(200).json(response);
  } catch (err) {
    logger.error("Error in getLatestUnreadEmails:", err);
    if (!res.headersSent) {
      return internalServerError(res, "Failed to fetch latest emails");
    }
  } finally {
    await prisma.$disconnect();
  }
};

export const getCalenderEvents: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    let google_calender_events: Array<any> = [];
    let outlook_calender_events: Array<any> = [];

    if (user?.google_login) {
      google_calender_events = await getGoogleCalenderEvents(
        user.google_access_token || "access_token",
        user?.timeZone
      );

      if (!google_calender_events) {
        return badRequestResponse(res, "No events in google calender");
      }
    }

    if (user?.outlook_login) {
      outlook_calender_events = await getOutlookCalenderEvents(
        user.outlook_access_token || "access_token"
      );

      if (!outlook_calender_events) {
        return badRequestResponse(res, "No events in outlook calender");
      }
    }

    return res.status(200).json({
      success: true,
      google_calender_events: user?.google_login
        ? google_calender_events.length > 0
          ? google_calender_events
          : "No events in your google calender"
        : [],
      outlook_calender_events: user?.outlook_login
        ? outlook_calender_events.length > 0
          ? outlook_calender_events
          : "No events in your outlook calender"
        : [],
    });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const getCurrentDateTime: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    const now = DateTime.now().setZone(user?.timeZone);

    return res.status(200).json({ date: now.toString() });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const notionDataApi: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user) {
      return notFoundResponse(res);
    }

    if (!user.notion_login) {
      return badRequestResponse(res, "User is not connected with notion");
    }

    const { question }: { question: string } = req.body;

    if (!question || !question.trim()) {
      return badRequestResponse(res, "please provide valid inputs");
    }

    const notion = new Client({ auth: user.notion_access_token || "" });

    const summary = await searchNotion(question, notion);

    return res.status(200).json({ success: true, message: summary });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const performNotionTasks: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { text }: { text: string } = req.body;

    if (!text || !text.trim()) {
      return badRequestResponse(res, "please provide valid inputs");
    }

    console.log(text);

    const action: string = text.split(",")[0].split(":")[1].trim();

    console.log(action);

    if (!action) {
      return badRequestResponse(res, "not a valid action");
    }

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user?.notion_login) {
      return res
        .status(401)
        .json({ success: false, message: "User is not connected with notion" });
    }

    let page: string | null = null;
    let modification: string | null = null;
    let database: string | null = null;

    const notion: Client = new Client({ auth: user.notion_access_token || "" });

    const response: {
      success: boolean;
      message?: string;
    } = {
      success: true,
    };

    switch (action) {
      case "Delete":
        page = text.split(",")[1].split(":")[1];
        await deleteNotionPage(page, notion).catch((err: Error) => {
          response.success = false;
          response.message = `failed to delete page due to this: ${
            err.message || err.toString()
          }`;
        });
        break;
      case "Change Title":
        page = text.split(",")[1].split(":")[1];
        modification = text.split(",")[2].split(":")[1];
        await updateNotionPageTitle(notion, page, modification).catch(
          (err: Error) => {
            response.success = false;
            response.message = `failed to update page due to this: ${
              err.message || err.toString()
            }`;
          }
        );
        break;
      case "Change Status":
        await changeStatusInNotion(notion, text).catch((err: Error) => {
          response.success = false;
          response.message = `failed to change status due to this: ${
            err.message || err.toString()
          }`;
        });
        break;
      case "Change Due Date":
        await changeDueDate(notion, text).catch((err: Error) => {
          response.success = false;
          response.message = `failed to change due date: ${
            err.message || err.toString()
          }`;
        });
        break;
      case "Add Database Entry":
        database = text.split(",")[1].split(":")[1];
        modification = text.split(",")[2].split(":")[1];
        await addDatabaseEntry(database, modification, notion).catch(
          (err: Error) => {
            response.success = false;
            response.message = `failed to add entry into database due to this: ${
              err.message || err.toString()
            }`;
          }
        );
        break;
      default:
        response.success = false;
        response.message = "action can not be performed";
    }

    return res.status(200).json(response);
  } catch (err) {
    logger.error("Error in performNotionTasks:", err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  } finally {
    await prisma.$disconnect();
  }
};

export const notionDatabaseList: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user?.notion_login) {
      return res
        .status(401)
        .json({ success: false, message: "User is not connected with notion" });
    }

    const notion: Client = new Client({
      auth: user.notion_access_token || "notion_token",
    });

    const databases = await getAllDatabases(notion);

    if (databases.length === 0) {
      return notFoundResponse(res, "No databases found in the workspace");
    }

    const databasesMap: Map<string, string> = new Map<string, string>();

    databases.forEach((database, index) => {
      const title = getDatabaseTitle(database);
      console.log(`${index + 1}. ${title}`);
      console.log(`   ID: ${database.id}`);
      databasesMap.set(title, database.id);
    });

    return res
      .status(200)
      .json({ success: false, databases: Object.fromEntries(databasesMap) });
  } catch (err) {
    logger.error("Error in notionDatabaseList:", err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  } finally {
    await prisma.$disconnect();
  }
};

export const notionDatabaseProperties: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user) {
      return notFoundResponse(res, "user not found");
    }

    if (!user.notion_login) {
      return res
        .status(401)
        .json({ success: false, message: "User is not connected with notion" });
    }

    const { text }: { text: string } = req.body;

    if (!text || !text.trim()) {
      return badRequestResponse(res, "please provide valid input");
    }

    const notion: Client = new Client({
      auth: user.notion_access_token || "notion_token",
    });

    const databases = await getAllDatabases(notion);

    if (databases.length === 0) {
      return notFoundResponse(res, "No databases found in the workspace");
    }

    const { database: selectedDatabase, confidence } =
      await findMostSimilarDatabase(databases, text);

    if (!selectedDatabase) {
      logger.error(
        "❌ No matching database found. Please try again with a more specific name."
      );
      return notFoundResponse(res, "No database found matching this query");
    }

    const database = await notion.databases.retrieve({
      database_id: selectedDatabase.id,
    });

    const fields = getFieldInfo(database.properties);

    return res.status(200).json({ success: true, message: fields });
  } catch (err) {
    logger.error("Error in notionDatabaseProperties:", err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  } finally {
    await prisma.$disconnect();
  }
};

export const notionDatabaseSummary: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user) {
      return notFoundResponse(res, "user not found");
    }

    const { text }: { text: string } = req.body;

    if (!text || !text.trim()) {
      return badRequestResponse(res, "please provide valid input");
    }

    const response: {
      success: boolean;
      message?: string;
    } = {
      success: true,
    };

    await getNotionDatabaseSummary(user.notion_access_token || "", text)
      .then((data) => {
        response.message = data;
      })
      .catch((err: Error) => {
        response.success = false;
        response.message = `failed to add entry into database due to this: ${
          err.message || err.toString()
        }`;
      });

    return res.status(200).json(response);
  } catch (err) {
    logger.error("Error in notionDatabaseSummary:", err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  } finally {
    await prisma.$disconnect();
  }
};

export const getProductHuntPosts: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { topic } = req.params;

    if (!topic || !topic.trim()) {
      return badRequestResponse(
        res,
        "please provide a valid to search for products"
      );
    }

    const datetime = new Date();
    datetime.setUTCDate(datetime.getUTCDate() - 1);
    datetime.setUTCHours(datetime.getUTCHours() - 7);

    const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PRODUCT_HUNT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query {
          posts(first: 10, order: VOTES, topic: "${topic}", postedAfter: "${datetime}") {
            edges {
              node {
                name
                tagline
                description
                votesCount
              }
            }
          }
        }`,
      }),
    });

    const result = await response.json();

    if (result.errors) {
      return badRequestResponse(res, "Something went wrong");
    }

    const formattedProducts = result.data.posts.edges.map(
      (edge: any, index: any) => {
        const product = edge.node;
        return {
          rank: index + 1,
          name: product.name,
          tagline: product.tagline,
          description: product.description,
          votes: product.votesCount,
        };
      }
    );

    return res.status(200).json({ success: true, message: formattedProducts });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const getMorningUpdate: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "user not found" });

    // if (user.morning_update) {
    //   await prisma.user.update({
    //     where: { id: user.id },
    //     data: { morning_update_check: true },
    //   });

    //   return res
    //     .status(200)
    //     .json({ success: true, message: JSON.parse(user.morning_update) });
    // }

    const user_events: string = await getEventsFromMorningPreferences(
      user.morning_update_preferences || ""
    );

    const search_query: string = await getSearchNewsQueryFromMorningPreferences(
      user.morning_update_preferences || ""
    );

    console.log(search_query);

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
        ? getPerplexityNews(search_query)
        : Promise.resolve([]),
      getrelevantEventsFromMorningPreferences(user_events, events),
    ]);

    // Process results
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

    // Map promises to services for clarity and scalability
    const serviceMap = [
      { name: "Google Unread Emails", key: "google_unread_emails" },
      { name: "Outlook Unread Emails", key: "outlook_unread_emails" },
      { name: "Google Calender events", key: "google_calender_events" },
      { name: "Outlook Calender events", key: "outlook_calender_events" },
      { name: "Slack Unread Messages", key: "all_unread_messages" },
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

    console.log(response);

    await prisma.user.update({
      where: { id: user?.id },
      data: {
        morning_update_check: true,
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

    return res.status(200).json(response);
  } catch (err) {
    logger.error("Error in getMorningUpdate:", err);
    if (!res.headersSent) {
      return internalServerError(res, "Failed to get morning update");
    }
  } finally {
    await prisma.$disconnect();
  }
};

export const perplexityApi: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiUrl = "https://api.perplexity.ai/chat/completions";
    const token = process.env.PERPLEXITY_API_KEY;

    const { query }: { query: string } = req.body;

    if (!query || !query.trim()) {
      return badRequestResponse(res, "please provide a valid query to search.");
    }

    const requestData = {
      model: "sonar",
      messages: [
        { role: "system", content: "Be precise and concise." },
        { role: "user", content: query },
      ],
      max_tokens: 123,
      temperature: 0.2,
      top_p: 0.9,
      return_images: false,
      return_related_questions: false,
      search_recency_filter: "day",
      top_k: 0,
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 1,
      response_format: { type: "text" },
      web_search_options: {
        search_context_size: "high",
      },
    };

    const response = await axios.post(apiUrl, requestData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    return res.status(200).json({
      success: true,
      message: response.data.choices[0].message.content,
    });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const getUnreadMessages: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user?.slack_login) {
      return badRequestResponse(res, "User is not connected with slack");
    }

    const conversations = await getConversations(
      user.slack_user_access_token || "slack_token"
    );

    if (!conversations) {
      return badRequestResponse(res, "No any conversations found");
    }

    const all_unread_messages: Array<any> = [];

    for (const channel of conversations.channels) {
      const isDM = channel.is_im;
      const conversationName = isDM
        ? `DM with ${await getUsername(
            user.slack_user_access_token || "slack_token",
            channel.user
          )}`
        : channel.name;

      const last_read_timestamp = await getLastReadTimestamp(
        channel.id,
        user.slack_user_access_token || "slack_token"
      );

      if (last_read_timestamp) {
        const unread_messages = await getUnreadMessagesFunc(
          channel.id,
          last_read_timestamp,
          user.slack_user_access_token || "slack_token",
          user.timeZone
        );

        if (!unread_messages) {
          continue;
        }

        const formattedMessages = await formatUnreadMessages(
          unread_messages,
          user.slack_user_access_token || "slack_token"
        );

        all_unread_messages.push({
          channel_id: channel.id,
          channel_name: channel.name,
          unread_messages: formattedMessages,
          type: isDM
            ? "direct_message"
            : channel.is_private
            ? "private_channel"
            : "public_channel",
        });
      }
    }

    return res
      .status(200)
      .json({ success: true, message: all_unread_messages });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const sendMessage: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { text }: { text: string } = req.body;

    if (!text || !text.trim()) {
      return badRequestResponse(res, "Please provide valid input");
    }

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user?.slack_login) {
      return badRequestResponse(res, "User is not connected with slack");
    }

    const conversations = await getConversations(
      user.slack_user_access_token || "slack_token"
    );

    const channelMap = new Map();

    if (!conversations) {
      return badRequestResponse(res, "No any conversations found");
    }

    for (const channel of conversations.channels) {
      channelMap.set(channel.name, channel.id);
    }

    const processedInput = await getChannelNameUsingLLM(text, channelMap);

    if (!processedInput) {
      return badRequestResponse(res, "Please provide valid input");
    }

    const { channel, message }: { channel: string; message: string } =
      JSON.parse(processedInput);

    if (!channel || !channel.trim() || !message || !message.trim()) {
      return badRequestResponse(
        res,
        "please provide valid channel and message to send"
      );
    }

    const channelID = channelMap.get(channel.toLowerCase());

    if (!channelID || !channelID.trim()) {
      return res.status(400).json({
        success: false,
        messaeg:
          "channel not found can you please try again with valid channel name",
      });
    }

    const data = await sendMessageAsUser(
      user.slack_user_access_token || "slack_token",
      message,
      channelID
    );

    if (!data) {
      return badRequestResponse(res, "Message not sent");
    }

    return res.status(200).json({ success: true, message: "Message sent" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const getAuthorizedUrl: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    return res.status(200).json({ success: true, message: "Authorized url" });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const refreshAccessTokenController: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    return res
      .status(200)
      .json({ success: true, message: "Token refreshed successfully" });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const addCalenderEvent: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { text, type }: { text: string; type: string } = req.body;

    if (!text || !text.trim() || !type || !type.trim()) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

    console.log(text, type);

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (type === "gmail") {
      if (user?.google_login) {
        const data = await addGoogleCalenderFunc(text, user);

        if (!data) {
          return res
            .status(400)
            .json({ success: false, message: "Calender not added" });
        }
      } else {
        return res
          .status(400)
          .json({ success: false, message: "User is not connected to google" });
      }
    } else if (type === "outlook") {
      if (user?.outlook_login) {
        const data = await addOutlookCalenderFunc(text, user);

        if (!data) {
          return res
            .status(400)
            .json({ success: false, message: "Calender not added" });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "User is not connected to outlook",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Event added in your calender successfully",
    });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const updateCalenderEvent: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { text, type }: { text: string; type: string } = req.body;

    if (!text || !text.trim() || !type || !type.trim()) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

    console.log(text, type);

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (type === "gmail") {
      if (user?.google_login) {
        const data = await updateGoogleCalenderFunc(text, user);

        if (!data) {
          return res
            .status(400)
            .json({ success: false, message: "Calender not added" });
        }
      } else {
        return res
          .status(400)
          .json({ success: false, message: "User is not connected to google" });
      }
    } else if (type === "outlook") {
      if (user?.outlook_login) {
        const data = await addOutlookCalenderFunc(text, user);

        if (!data) {
          return res
            .status(400)
            .json({ success: false, message: "Calender not added" });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "User is not connected to outlook",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Event updated in your calender successfully",
    });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const deleteCalenderEvent: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { text, type }: { text: string; type: string } = req.body;

    if (!text || !text.trim() || !type || !type.trim()) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

    console.log(text, type);

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (type === "gmail") {
      if (user?.google_login) {
        const data = await deleteGoogleCalenderFunc(text, user);

        if (!data) {
          return res
            .status(400)
            .json({ success: false, message: "Calender not added" });
        }
      } else {
        return res
          .status(400)
          .json({ success: false, message: "User is not connected to google" });
      }
    } else if (type === "outlook") {
      if (user?.outlook_login) {
        const data = await addOutlookCalenderFunc(text, user);

        if (!data) {
          return res
            .status(400)
            .json({ success: false, message: "Calender not added" });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "User is not connected to outlook",
        });
      }
    }
    return res.status(200).json({
      success: true,
      message: "Event deleted in your calender successfully",
    });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const draftEmail: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { text, type }: { text: string; type: string } = req.body;

    if (!text || !text.trim() || !type || !type.trim()) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

    console.log(text, type);

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (type === "gmail") {
      if (user?.google_login) {
        const data = await draftGoogleGmailFunc(text, user);

        if (!data) {
          return res
            .status(400)
            .json({ success: false, message: "email not sent" });
        }
      } else {
        return res
          .status(400)
          .json({ success: false, message: "User is not connected to google" });
      }
    } else if (type === "outlook") {
      if (user?.outlook_login) {
        const data = await draftOutlookMailFunc(text, user);

        if (!data) {
          return res
            .status(400)
            .json({ success: false, message: "email not sent" });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "User is not connected to outlook",
        });
      }
    }

    return res
      .status(200)
      .json({ success: true, message: "Email drafted successfully" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const drafteEmailReply: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { text, type }: { text: string; type: string } = req.body;

    if (!text || !text.trim() || !type || !type.trim()) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (type === "gmail") {
      if (user?.google_login) {
        const data = await draftGoogleGmailReplyFunc(text, user);

        if (!data) {
          return res
            .status(400)
            .json({ success: false, message: "email not sent" });
        }
      } else {
        return res
          .status(400)
          .json({ success: false, message: "User is not connected to google" });
      }
    } else if (type === "outlook") {
      if (user?.outlook_login) {
        const data = await draftOutlookMailReplyFunc(text, user);

        if (!data) {
          return res
            .status(400)
            .json({ success: false, message: "email not sent" });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "User is not connected to outlook",
        });
      }
    }

    return res
      .status(200)
      .json({ success: true, message: "Email drafted successfully" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const getStaticData: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const prompt = `
     5:00 PM: Unveiling of 45-Foot Naked Statue "R-Evolution" at Embarcadero Plaza (Free)

      7:00 PM: Bees and the Native Plants They Love (Free, donations welcome)

      7:00 PM: SF Unplugged at Savoy Tivoli with Anthony Arya & Joe Kaplow ($20, includes a free drink with an advanced ticket)

      7:30 PM: You’re Going to Die Presents: Climate Grief ($15)

      8:00 PM: Basement Jaxx ($60.38)

      9:00 PM: "The Monster Show" – Drag Tribute to The Beatles at The Edge ($5)
    `;

    return res.status(200).json({ success: true, message: prompt });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const addPreferences: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { prompt }: { prompt: string } = req.body;

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    await prisma.user.update({
      where: { id: user?.id },
      data: {
        preferences: prompt,
        preferences_added: prompt.length > 0 ? true : false,
      },
    });

    return res
      .status(200)
      .json({ success: true, message: "Got the user preferences" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const updatePreferences: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { prompt }: { prompt: string } = req.body;

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    const summary = await getPreferencesSummary(
      user?.preferences || "",
      prompt
    );

    await prisma.user.update({
      where: { id: user?.id },
      data: {
        preferences: prompt.length > 0 ? summary : prompt,
        preferences_added: prompt.length > 0 ? true : false,
      },
    });

    return res
      .status(200)
      .json({ success: true, message: "Update the user preferences" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const getPreferences: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    return res.status(200).json({ success: true, message: user?.preferences });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const updateMorningUpdateCheck: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    await prisma.user.update({
      where: { id: user?.id },
      data: { morning_update_check: true },
    });

    return res
      .status(200)
      .json({ success: true, message: "User recieved the morning feedback" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const updateUserPreferences: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { prompt }: { prompt: string } = req.body;

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    await prisma.user.update({
      where: { id: user?.id },
      data: {
        preferences: prompt,
        preferences_added: prompt.length > 0 ? true : false,
      },
    });

    return res
      .status(200)
      .json({ success: true, message: "Update the user preferences" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const addMorningPreferences: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      prompt,
      morningBriefTime,
      region,
    }: { prompt: string; morningBriefTime: string; region: string } = req.body;

    if (
      !morningBriefTime ||
      !morningBriefTime.trim() ||
      !region ||
      !region.trim()
    ) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

    if (!/^(1[0-2]|0?[1-9]):[0-5][0-9]\s?(AM|PM)$/i.test(morningBriefTime)) {
      return res.status(400).json({
        success: false,
        message: "Invalid time format. Use HH:MM AM/PM",
      });
    }

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    const timeZone = regionToTimeZone[region];

    if (!timeZone) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide valid region" });
    }

    await prisma.user.update({
      where: { id: user?.id },
      data: {
        morning_update_preferences: prompt,
        morning_brief_time: morningBriefTime,
        timeZone: timeZone,
      },
    });

    res
      .status(200)
      .json({ success: true, message: "Update the user morning preferences" });

    scheduleUserBriefs();
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const getPublicEvents: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const events = await prisma.events.findMany({});

    return res.status(200).json({ success: true, message: events });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const addEvent: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { text }: { text: string } = req.body;

    if (!text || !text.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide valid inputs" });
    }

    let events = await prisma.events.findMany({});

    if (events.length > 0) {
      await prisma.events.update({
        where: { id: events[0].id },
        data: { events: text },
      });
    }

    await prisma.events.create({ data: { events: text } });

    return res.status(200).json({ success: true, message: "Created event" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const addUserDetails: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      company_name,
      position,
      profile_image,
    }: { company_name: string; position: string; profile_image: string } =
      req.body;

    if (
      !company_name ||
      !company_name.trim() ||
      !position ||
      !position.trim()
    ) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    await prisma.user.update({
      where: { id: user?.id },
      data: {
        company_name: company_name,
        position: position,
        profile_image: profile_image ? profile_image : user?.profile_image,
      },
    });

    return res
      .status(200)
      .json({ success: true, message: "User details added successfully" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const addPhoneNumber: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let { phone_number }: { phone_number: string } = req.body;

    if (!phone_number.trim()) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

    if (!phone_number.startsWith("+1")) {
      phone_number = phone_number.startsWith("1")
        ? "+" + phone_number
        : "+1" + phone_number;
    }

    if (!validatePhoneNumber(phone_number)) {
      return badRequestResponse(
        res,
        "Phone number that you provided is not valid"
      );
    }

    const areaCode: string = phone_number.slice(2, 5);
    let timeZone = areaCodeToTimeZone[areaCode];

    if (!timeZone) {
      return res.status(400).json({
        success: false,
        message: "please provide a valid phone number",
      });
    }

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    await prisma.user.update({
      where: { id: user?.id },
      data: {
        phone_number: phone_number,
        timeZone: timeZone,
      },
    });

    return res
      .status(200)
      .json({ success: true, message: "phone number added successfully" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const testingMessageSend: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const message = await twilio_client.messages.create({
      body: `Your morning brief is ready`,
      from: process.env.TWILIO_ACCOUNT_PHONE_NUMBER,
      to: "+13463916054",
    });

    return res.status(200).json({ success: true, message: "Message sent" });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const lisaCallEndpoint: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { caller_id }: { caller_id: string } = req.body;

    console.log(caller_id);

    if (!isNonEmptyString(caller_id)) {
      return res
        .status(400)
        .json({ success: false, message: "please provide valid inputs" });
    }

    const user = await prisma.user.findFirst({
      where: { phone_number: caller_id },
    });

    if (!user) {
      return notFoundResponse(
        res,
        "user with that phone number does not exists in our database create your account first"
      );
    }

    const response = {
      type: "conversation_initiation_client_data",
      dynamic_variables: {
        user_name: user.name,
        user_token: user.token,
        token: user.token,
        user: JSON.stringify(user),
        email_connected:
          user.google_login && user.outlook_login
            ? "Google and Outlook both connected"
            : user.google_login && !user.outlook_login
            ? "Only Google connected"
            : user.outlook_login && !user.google_login
            ? "Only Outlook connected"
            : "No emails connected",
        first_message: !user.preferences_added
          ? "Hey, I am Lisa and you are?"
          : !user.morning_update_check
          ? "Good morning, ready for the morning update?"
          : "Hi, How can I help you today?",
        system_prompt: !user.preferences_added
          ? new_user_system_prompt
          : !user.morning_update_check
          ? "You are an AI voice assistant named Lisa. Your job is to understand the morning briefings by accessing data from the tools and then come up with a short summary of what's important. Using the Morning_Update tool to get the morning update for the user. If the user declines to receive the morning update, use the Finish_Update tool."
          : "You are an AI voice assistant named Lisa. Your job is to use the provided tools to answer the user's question and perform the action requested.",
      },
    };

    return res.status(200).json(response);
  } catch (err) {
    logger.error("Error in lisaCallEndpoint:", err);
    if (!res.headersSent) {
      return internalServerError(res, "failed to get user data");
    }
  } finally {
    await prisma.$disconnect();
  }
};
