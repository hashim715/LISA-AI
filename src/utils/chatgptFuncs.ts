import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const processUserInput = async (
  input: string,
  channelMap: Map<string, string>
): Promise<any | null> => {
  try {
    const prompt = `
        You are an assistant that extracts information from user requests to send Slack messages.
        Given a sentence, identify:
        1. The Slack channel name (e.g., "planning", "general").
        2. The message content to send to that channel.
        3. You can find the channel name by using channel map that is provided you if you find a channel name that is matching to some extent in channel map so use channel name from the channel map.
        
        If the input doesn't specify a channel or message, return null for those fields.
        Return the result as a JSON object.

        Example:
        Input: "Can you write a message on planning channel saying where are we on the design phase"
        Output: {"channel": "planning", "message": "where are we on the design phase"}

        Example:
        Input: "Ask Shahbaz on General channel about the project status"
        Output: {"channel": "general", "message": "Hey Shahbaz, where are we on the project status?"}

        Input: ${input}
        Channel Map : ${channelMap}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.log(err);
    return null;
  }
};

export const summarizeEmailsWithLLM = async (email: string) => {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that analyzes email body and provides clear summaries. Focus on key information, main topics, and important points from each email.",
        },
        {
          role: "user",
          content: `Please provide a summary of this email:\n\n${email}`,
        },
      ],
      model: "gpt-3.5-turbo",
    });

    return completion.choices[0].message.content;
  } catch (err) {
    console.log(err);
    return null;
  }
};

export const summarizeNotionWithLLM = async (allContent: any) => {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that analyzes Notion page content and provides clear summaries. Focus on key information, main topics, and important points from each page.",
        },
        {
          role: "user",
          content: `Please provide a summary of these Notion pages:\n\n${allContent}`,
        },
      ],
      model: "gpt-3.5-turbo",
    });

    return completion.choices[0].message.content;
  } catch (err) {
    console.log(err);
    return null;
  }
};
