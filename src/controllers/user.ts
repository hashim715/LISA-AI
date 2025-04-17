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
  extractDatabaseContent,
  getPageTitle,
  retrieveBlockChildren,
  formatPageContent,
} from "../utils/notionFuncs";
import {
  getChannelNameUsingLLM,
  summarizeNotionWithLLM,
  getPreferencesSummary,
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
} from "../utils/controllerFuncs";
import { scheduleUserBriefs } from "../index";
import { validatePhoneNumber } from "../utils/validatePhoneNumber";

export const getUnreadEmails: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    let google_emails: Array<any> = [];
    let outlook_emails: Array<any> = [];

    if (user.google_login) {
      google_emails = await getGoogleEmails(user.google_access_token);

      if (!google_emails) {
        return badRequestResponse(res, "No emails found");
      }
    }

    if (user.outlook_login) {
      outlook_emails = await getOutlookEmails(user.outlook_access_token);

      if (!outlook_emails) {
        return badRequestResponse(res, "No emails found");
      }
    }

    return res.status(200).json({
      success: true,
      google_emails: user.google_login
        ? google_emails.length > 0
          ? google_emails
          : "No unread emails in your gmail account"
        : [],
      outlook_emails: user.outlook_login
        ? outlook_emails.length > 0
          ? outlook_emails
          : "No unread emails in your outlook account"
        : [],
    });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
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

    let google_emails: Array<any> = [];
    let outlook_emails: Array<any> = [];

    if (user.google_login) {
      google_emails = await getGoogleEmailsFromSpecificSender(
        user.google_access_token,
        searchField.trim()
      );

      if (!google_emails) {
        return badRequestResponse(res, "No emails found");
      }
    }

    if (user.outlook_login) {
      outlook_emails = await getOutlookEmailsFromSpecificSender(
        user.outlook_access_token,
        searchField.trim()
      );

      if (!outlook_emails) {
        return badRequestResponse(res, "No emails found");
      }
    }

    return res.status(200).json({
      success: true,
      google_emails: user.google_login
        ? google_emails.length > 0
          ? google_emails
          : "No emails found for this name"
        : [],
      outlook_emails: user.outlook_login
        ? outlook_emails.length > 0
          ? outlook_emails
          : "No emails found for this name"
        : [],
    });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
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

    if (user.google_login) {
      google_calender_events = await getGoogleCalenderEvents(
        user.google_access_token
      );

      if (!google_calender_events) {
        return badRequestResponse(res, "No events in google calender");
      }
    }

    if (user.outlook_login) {
      outlook_calender_events = await getOutlookCalenderEvents(
        user.outlook_access_token
      );

      if (!outlook_calender_events) {
        return badRequestResponse(res, "No events in outlook calender");
      }
    }

    return res.status(200).json({
      success: true,
      google_calender_events: user.google_login
        ? google_calender_events.length > 0
          ? google_calender_events
          : "No events in your google calender"
        : [],
      outlook_calender_events: user.outlook_login
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
    const datetime = new Date();
    datetime.setUTCHours(datetime.getUTCHours() - 7);

    return res.status(200).json({ date: datetime.toLocaleString() });
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
    const summary = await summarizeNotionWithLLM(allContent);
    if (!summary) {
      return badRequestResponse(res, "Try again something went wrong");
    }
    console.log("\nDone generating summary...");

    return res.status(200).json({ success: true, message: summary });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
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

    if (user.morning_update) {
      await prisma.user.update({
        where: { id: user.id },
        data: { morning_update_check: true },
      });

      return res
        .status(200)
        .json({ success: true, message: JSON.parse(user.morning_update) });
    }

    let google_emails: Array<any> = [];
    let outlook_emails: Array<any> = [];

    let google_calender_events: Array<any> = [];
    let outlook_calender_events: Array<any> = [];

    const all_unread_messages: Array<any> = [];

    if (user.google_login) {
      google_emails = await getGoogleEmails(user.google_access_token);
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

    if (user.slack_login) {
      const conversations = await getConversations(
        user.slack_user_access_token
      );

      if (conversations) {
        for (const channel of conversations.channels) {
          const isDM = channel.is_im;

          const last_read_timestamp = await getLastReadTimestamp(
            channel.id,
            user.slack_user_access_token
          );

          if (last_read_timestamp) {
            const unread_messages = await getUnreadMessagesFunc(
              channel.id,
              last_read_timestamp,
              user.slack_user_access_token
            );

            if (!unread_messages) {
              continue;
            }

            if (unread_messages.length > 0) {
              all_unread_messages.push({
                channel_name: channel.name,
                type: isDM
                  ? "direct_message"
                  : channel.is_private
                  ? "private_channel"
                  : "public_channel",
              });
            }
          }
        }
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        morning_update_check: true,
        morning_update: JSON.stringify({
          notion_summary: notion_summary,
          google_calender_events: google_calender_events,
          outlook_calender_events: outlook_calender_events,
          google_emails: google_emails,
          outlook_emails: outlook_emails,
          slack_unread_messages: all_unread_messages,
        }),
      },
    });

    return res.status(200).json({
      success: true,
      google_emails:
        google_emails && google_emails.length > 0
          ? google_emails
          : "No unread emails in your gmail account",
      outlook_emails:
        outlook_emails && outlook_emails.length > 0
          ? outlook_emails
          : "No unread emails in your outlook account",
      google_calender_events:
        google_calender_events && google_calender_events.length > 0
          ? google_calender_events
          : "No events in your google calender",
      outlook_calender_events:
        outlook_calender_events && outlook_calender_events.length > 0
          ? outlook_calender_events
          : "No events in your outlook calender",
      notion_summary: notion_summary && notion_summary,
      slack_unread_messages: all_unread_messages,
    });
  } catch (err) {
    if (!res.headersSent) {
      return internalServerError(res);
    }
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

    if (!user.slack_login) {
      return badRequestResponse(res, "User is not connected with slack");
    }

    const conversations = await getConversations(user.slack_user_access_token);

    if (!conversations) {
      return badRequestResponse(res, "No any conversations found");
    }

    const all_unread_messages: Array<any> = [];

    for (const channel of conversations.channels) {
      const isDM = channel.is_im;
      const conversationName = isDM
        ? `DM with ${await getUsername(
            user.slack_user_access_token,
            channel.user
          )}`
        : channel.name;

      const last_read_timestamp = await getLastReadTimestamp(
        channel.id,
        user.slack_user_access_token
      );

      if (last_read_timestamp) {
        const unread_messages = await getUnreadMessagesFunc(
          channel.id,
          last_read_timestamp,
          user.slack_user_access_token
        );

        if (!unread_messages) {
          continue;
        }

        const formattedMessages = await formatUnreadMessages(
          unread_messages,
          user.slack_user_access_token
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

    if (!user.slack_login) {
      return badRequestResponse(res, "User is not connected with slack");
    }

    const conversations = await getConversations(user.slack_user_access_token);

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
      user.slack_user_access_token,
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

    if (type === "google") {
      if (user.google_login) {
        const data = await addGoogleCalenderFunc(res, text, user);

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
      if (user.outlook_login) {
        const data = await addOutlookCalenderFunc(text, res, user);

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
      if (user.google_login) {
        const data = await draftGoogleGmailFunc(text, res, user);

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
      if (user.outlook_login) {
        const data = await draftOutlookMailFunc(text, res, user);

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

    console.log(text, type);

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (type === "google") {
      if (user.google_login) {
        const data = await draftGoogleGmailReplyFunc(text, res, user);

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
      if (user.outlook_login) {
        const data = await draftOutlookMailReplyFunc(text, res, user);

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
      where: { id: user.id },
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

    const summary = await getPreferencesSummary(user.preferences, prompt);

    await prisma.user.update({
      where: { id: user.id },
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

    return res.status(200).json({ success: true, message: user.preferences });
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
      where: { id: user.id },
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
      where: { id: user.id },
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
      timezone,
    }: { prompt: string; morningBriefTime: string; timezone: string } =
      req.body;

    if (
      !morningBriefTime ||
      !morningBriefTime.trim() ||
      !timezone ||
      !timezone.trim()
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

    await prisma.user.update({
      where: { id: user.id },
      data: {
        morning_update_preferences: prompt,
        morning_brief_time: morningBriefTime,
        timeZone: timezone,
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
    }: { company_name: string; position: string } = req.body;

    if (
      !company_name ||
      !company_name.trim() ||
      !position ||
      !position.trim()
    ) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

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

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        phone_number: phone_number,
        company_name: company_name,
        position: position,
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

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        phone_number: phone_number,
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
