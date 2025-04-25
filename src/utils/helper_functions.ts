import {
  getConversations,
  getUnreadMessagesFunc,
  getLastReadTimestamp,
} from "../utils/slackApi";

import { Slack, NotionSummary, PerplexityNews } from "../utils/types";

import {
  retrieveBlockChildren,
  formatPageContent,
  getAllPages,
  selectTaskListPage,
  findBestMatchingDatabase,
  generateSummary,
  getDatabaseSchema,
  getSampleItems,
  getAllDatabases,
  getDatabaseTitle,
} from "../utils/notionFuncs";

import { Client } from "@notionhq/client";
import { logger } from "../utils/logger";

import { summarizeNotionWithLLM } from "../utils/chatgptFuncs";

import axios from "axios";

export const getSlackMessages = async (
  slack_user_access_token: string,
  timeZone: string
): Promise<Array<Slack>> => {
  const all_unread_messages: Array<Slack> = [];

  const conversations = await getConversations(slack_user_access_token);

  if (conversations) {
    for (const channel of conversations.channels) {
      const isDM = channel.is_im;

      const last_read_timestamp = await getLastReadTimestamp(
        channel.id,
        slack_user_access_token
      );

      if (last_read_timestamp) {
        const unread_messages = await getUnreadMessagesFunc(
          channel.id,
          last_read_timestamp,
          slack_user_access_token,
          timeZone
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
  return all_unread_messages;
};

export const getNotionSummaryForMorningUpdate = async (
  notion_access_token: string
): Promise<NotionSummary> => {
  const notion: Client = new Client({
    auth: notion_access_token,
  });

  console.log("Searching for all accessible pages...");
  const pages: Array<any> = await getAllPages(notion);

  if (pages.length === 0) {
    logger.error("No pages found in the workspace.");
    throw new Error("No pages found in the workspace.");
  }

  const selectedPage: any = await selectTaskListPage(pages);

  const blocks = await retrieveBlockChildren(selectedPage.id, 0, notion);
  const pageContent = formatPageContent(selectedPage, blocks);

  const notion_summary = await summarizeNotionWithLLM(pageContent);

  return { summary: notion_summary };
};

export const getPerplexityNews = async (
  query: string
): Promise<PerplexityNews> => {
  const apiUrl = "https://api.perplexity.ai/chat/completions";
  const token = process.env.PERPLEXITY_API_KEY;

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

  const response = await axios
    .post(apiUrl, requestData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
    .catch((err) => {
      logger.error("error in fetching news:", err);
      throw new Error("error in fetching news");
    });

  return { news: response.data.choices[0].message.content || "" };
};

export const getNotionDatabaseSummary = async (
  notion_access_token: string,
  database_name: string
) => {
  const notion: Client = new Client({
    auth: notion_access_token,
  });

  const databases = await getAllDatabases(notion);
  if (databases.length === 0) {
    logger.error("No databases found in the workspace");
    throw new Error("No databases found in the workspace");
  }

  const selectedDatabase = await findBestMatchingDatabase(
    database_name,
    databases
  );

  if (!selectedDatabase) {
    logger.error(`No matching database found for "${database_name}"`);
    throw new Error(`No matching database found for "${database_name}"`);
  }

  const databaseTitle = getDatabaseTitle(selectedDatabase);

  const schema = getDatabaseSchema(selectedDatabase);
  const sampleItems = await getSampleItems(selectedDatabase.id, 5, notion);

  const summary = await generateSummary(databaseTitle, schema, sampleItems);

  return summary;
};
