import axios from "axios";
import { DateTime } from "luxon";

export const getConversations = async (slack_access_token: string) => {
  try {
    const response = await axios.get(
      "https://slack.com/api/conversations.list",
      {
        headers: {
          Authorization: `Bearer ${slack_access_token}`,
          "Content-Type": "application/json",
        },
        params: {
          types: "public_channel,private_channel,im",
        },
      }
    );

    return response.data;
  } catch (err: any) {
    console.log(
      "get conversations Error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const sendMessageAsUser = async (
  slack_access_token: string,
  text: string,
  channelId: string
) => {
  try {
    const response = await axios.post(
      "https://slack.com/api/chat.postMessage",
      {
        channel: channelId,
        text: text,
        as_user: true,
      },
      {
        headers: {
          Authorization: `Bearer ${slack_access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (err: any) {
    console.log(
      "send slack message Error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const getUsername = async (
  slack_access_token: string,
  userID: string
) => {
  try {
    const response = await axios.get("https://slack.com/api/users.info", {
      headers: { Authorization: `Bearer ${slack_access_token}` },
      params: { user: userID },
    });

    if (response.data.ok) {
      return response.data.user.real_name || response.data.user.name;
    }

    return null;
  } catch (err: any) {
    console.log(
      "get slack username error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const getUnreadMessagesFunc = async (
  channelId: string,
  lastReadTimestamp: string,
  slack_access_token: string,
  timezone: string
) => {
  try {
    const now = DateTime.now().setZone(timezone);
    const twentyFourHoursAgo = now.minus({ hours: 24 }).toUTC();

    const response = await axios.get(
      "https://slack.com/api/conversations.history",
      {
        headers: {
          Authorization: `Bearer ${slack_access_token}`,
          "Content-Type": "application/json",
        },
        params: {
          channel: channelId,
          limit: 100,
          oldest: twentyFourHoursAgo.toString(),
        },
      }
    );

    const messages = response.data.messages;

    const unreadMessages = messages.filter(
      (msg: any) => parseFloat(msg.ts) > parseFloat(lastReadTimestamp)
    );

    return unreadMessages;
  } catch (err: any) {
    console.log(
      "get slack unread messages error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const getLastReadTimestamp = async (
  channelId: string,
  slack_access_token: string
) => {
  try {
    const response = await axios.get(
      "https://slack.com/api/conversations.info",
      {
        headers: {
          Authorization: `Bearer ${slack_access_token}`,
          "Content-Type": "application/json",
        },
        params: { channel: channelId },
      }
    );

    if (response.data.ok) {
      return response.data.channel.last_read;
    }

    return null;
  } catch (err: any) {
    console.log(
      "get slack last read timestamp error:",
      err.response?.data || err.message || err
    );
    return null;
  }
};

export const formatUnreadMessages = async (
  unreadMessages: Array<any>,
  slack_access_token: string
) => {
  try {
    const formatedMessages: Array<any> = [];

    for (const message of unreadMessages) {
      const sender = message.user
        ? await getUsername(slack_access_token, message.user)
        : "Unknown";

      formatedMessages.push({
        sender,
        text: message.text || "(No text content)",
        timestamp: new Date(parseFloat(message.ts) * 1000).toISOString(),
      });
    }

    return formatedMessages;
  } catch (err) {
    return null;
  }
};
