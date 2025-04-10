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
  getGoogleCalenderFieldsUsingLLM,
  getGmailDraftFieldsUsingLLM,
  getMatchingGmail,
  getMatchingReplyGmail,
  getReplyGmailDraftFieldsUsingLLM,
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
  addGoogleCalenderEventFunc,
  createGmailDraft,
  getSenderEmailsUsingSearchQuery,
  createGmailReplyDraft,
  getReplySenderEmailsUsingSearchQuery,
} from "../utils/gmailApi";
import {
  getOutlookEmails,
  getOutlookCalenderEvents,
  getOutlookEmailsFromSpecificSender,
} from "../utils/outlookApi";

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

export const concatenateallApis: RequestHandler = async (
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

export const addGoogleCalenderEvent: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { text }: { text: string } = req.body;

    if (!text || !text.trim()) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user.google_login) {
      return res
        .status(400)
        .json({ success: false, message: "User is not connected to google" });
    }

    const processedInput = await getGoogleCalenderFieldsUsingLLM(
      text,
      new Date().toISOString()
    );

    if (!processedInput) {
      return badRequestResponse(res, "Please provide valid input");
    }

    const {
      summary,
      description,
      location,
      start,
      end,
      attendees,
    }: {
      summary: string;
      description: string;
      location: string;
      start: any;
      end: any;
      attendees: any;
    } = JSON.parse(processedInput);

    const data = await addGoogleCalenderEventFunc(
      user.google_access_token,
      summary,
      description,
      location,
      start,
      end,
      attendees
    );

    if (!data) {
      return res.status(400).json({
        success: false,
        message:
          "could not add calender event can you please try again may be something wrong with the input you provided",
      });
    }

    return res.status(200).json({ success: true, message: data });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const draftGoogleGmail: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { text }: { text: string } = req.body;

    if (!text || !text.trim()) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user.google_login) {
      return res
        .status(400)
        .json({ success: false, message: "User is not connected to google" });
    }

    const processedInput = await getGmailDraftFieldsUsingLLM(text);

    if (!processedInput) {
      return badRequestResponse(res, "Please provide valid input");
    }

    console.log(processedInput);

    const {
      name,
      bodyContent,
      subject,
    }: {
      name: string;
      bodyContent: string;
      subject: string;
    } = JSON.parse(processedInput);

    if (!name || !name.trim() || !bodyContent || !bodyContent.trim()) {
      return badRequestResponse(
        res,
        "Ask the user to tell name,body,subject correctly one of the field is not specified correctly"
      );
    }

    const emailMetaData = await getSenderEmailsUsingSearchQuery(
      name,
      user.google_access_token
    );

    console.log(emailMetaData);

    const processedSearchQueryEmail = await getMatchingGmail(
      name,
      emailMetaData
    );

    if (!processedSearchQueryEmail) {
      return badRequestResponse(
        res,
        "Could not find emails for the given name"
      );
    }

    console.log(processedSearchQueryEmail);

    const { from }: { from: string } = JSON.parse(processedSearchQueryEmail);

    if (!from || !from.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Tell the user i tried to find the reciever email couldn't find it so please specify exactly to whon to send this email",
      });
    }

    const data = await createGmailDraft(
      user.google_access_token,
      user.google_email,
      from,
      user.name,
      subject,
      bodyContent
    );

    if (!data) {
      return res.status(400).json({
        success: false,
        message: "could not draft email please try again",
      });
    }

    return res.status(200).json({ success: true, message: data });
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};

export const draftGoogleGmailReply: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { text }: { text: string } = req.body;

    if (!text || !text.trim()) {
      return badRequestResponse(res, "Please provide valid inputs");
    }

    const token = req.cookies.authToken;

    const { username }: { username: string } = jwt_decode(token);

    const user = await prisma.user.findFirst({ where: { username: username } });

    if (!user.google_login) {
      return res
        .status(400)
        .json({ success: false, message: "User is not connected to google" });
    }

    const processedInput = await getReplyGmailDraftFieldsUsingLLM(text);

    if (!processedInput) {
      return badRequestResponse(res, "please provide valid input");
    }

    console.log(processedInput);

    const {
      name,
      bodyContent,
    }: {
      name: string;
      bodyContent: string;
    } = JSON.parse(processedInput);

    if (!name || !name.trim() || !bodyContent || !bodyContent.trim()) {
      return badRequestResponse(
        res,
        "Ask the user to tell name,body correctly one of the field is not specified correctly"
      );
    }

    const replyEmailMetaData = await getReplySenderEmailsUsingSearchQuery(
      name,
      user.google_access_token
    );

    if (!replyEmailMetaData) {
      return badRequestResponse(
        res,
        "Could not find emails for the given name"
      );
    }

    console.log(replyEmailMetaData);

    const processedSearchQueryEmail = await getMatchingReplyGmail(
      name,
      replyEmailMetaData
    );

    if (!processedSearchQueryEmail) {
      return badRequestResponse(
        res,
        "Could not find emails for the given name"
      );
    }

    console.log(processedSearchQueryEmail);

    const {
      messageId,
      threadId,
      subject,
      from,
    }: { messageId: string; threadId: string; subject: string; from: string } =
      JSON.parse(processedSearchQueryEmail);

    if (
      !messageId ||
      !messageId.trim() ||
      !threadId ||
      !threadId.trim() ||
      !from ||
      !from.trim()
    ) {
      return badRequestResponse(
        res,
        "Tell the user i tried to find the reciever email couldn't find it so please specify exactly to whom to reply"
      );
    }

    const data = await createGmailReplyDraft(
      user.google_access_token,
      user.google_email,
      from,
      user.name,
      subject,
      bodyContent,
      threadId,
      messageId
    );

    if (!data) {
      return badRequestResponse(
        res,
        "could not create draft reply email try again with valid inputs"
      );
    }
  } catch (err) {
    console.log(err);
    if (!res.headersSent) {
      return internalServerError(res);
    }
  }
};
