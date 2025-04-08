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
  processUserInput,
  summarizeNotionWithLLM,
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

const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IjA3ZmRmMDVlLWVmYTEtNDU4Zi04YWM5LTEyZTc2YzlmNmJiYiIsImlhdCI6MTc0MzQwMjM0MywiZXhwIjoxNzQ0MjY2MzQzfQ.aGEh-c5vXmJqh55Cznz2EdbcntaPjjxnMbeqV7Mw2mw";

export const getUnreadEmails: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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
    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    const { searchField } = req.params;

    if (!searchField.trim()) {
      return badRequestResponse(res, "Please provide valid inputs");
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

export const notionClientApiTesting: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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

export const concatenateallApis: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    let google_emails: Array<any> = [];
    let outlook_emails: Array<any> = [];

    let google_calender_events: Array<any> = [];
    let outlook_calender_events: Array<any> = [];

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

    const requestData = {
      model: "sonar",
      messages: [
        { role: "system", content: "Be precise and concise." },
        { role: "user", content: "how is the weather today in san francisco?" },
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

    const news = `
      Half the western side of the San Francisco the spring seasons and early summer are covered by fog. This is brought about by the meeting of the cold current from the Pacific Ocean and the warm current coming from mainland California, but the fog is less experienced in the eastern part of San Francisco. The fall seasons and late summer seasons are the hottest months of the year (Cronquist 45).
      Even though the temperatures are almost the same throughout the year, there are two defined seasons i.e. dry and wet. 80% of the precipitations yearly always take place between November and March. Most of the morning in summer is mostly covered by fog, coming when the ocean is cool and backing on the hills.

      This area is sometimes called the ‘biome region’ is just like a desert. Most of the plants which are found in this region are less than one meter in height and mostly consist of shrubs, having characteristics similar to those in the desert, which help them to adapt during dry hot seasons. Many of these plants are yearly, they flower during the winter at this time there is plenty of water due to water but during the hot and dry season, they exist in terms of seeds. These plants are characterized by having small leaves to prevent them from losing water during dry seasons, their leave is always evergreen and lastly, they curled with their stomata below the leaf (Cronquist 76).

      The region of Salt Lake City in Utah is semi-arid and is found in the Salt: Lake Valley. This region is surrounded by mountains and receives little rain. Salt Lake region has four defined climatic changes. These seasons are; cold season, snow winter season, a hot & dry summer season, and wet season.

      The region is near the Pacific Ocean which influences the climate of this place. Storms are mostly experienced from October to May and it only receives rain during the spring seasons. In winter the region experiences snowfall this is as a result of the effect of the Great Salt Lake. The summers are hot and wet; sometimes the temperature reaches 38 degrees Celsius. Due to monsoon winds from the Gulf of California, it experiences precipitation.
    `;

    // return res.status(200).json({
    //   success: true,
    //   message: response.data.choices[0].message.content,
    // });
    return res.status(200).json({
      success: true,
      message: news,
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
    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

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

    if (!text.trim()) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

    console.log(text);

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    const conversations = await getConversations(user.slack_user_access_token);

    const channelMap = new Map();

    if (!conversations) {
      return badRequestResponse(res, "No any conversations found");
    }

    for (const channel of conversations.channels) {
      channelMap.set(channel.name, channel.id);
    }

    console.log(channelMap);

    const processedInput = await processUserInput(text, channelMap);

    if (!processedInput) {
      return badRequestResponse(res, "Please provide valid input");
    }

    const { channel, message }: { channel: string; message: string } =
      JSON.parse(processedInput);

    if (!channel || !message) {
      return badRequestResponse(res, "Please provide valid input");
    }

    console.log(channel, message);

    const channelID = channelMap.get(channel.toLowerCase());

    console.log(channelID);

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
