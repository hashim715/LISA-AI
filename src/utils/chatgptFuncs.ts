import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const getChannelNameUsingLLM = async (
  input: string,
  channelMap: Map<string, string>
): Promise<any | null> => {
  try {
    const channelList = JSON.stringify(Object.fromEntries(channelMap), null, 2);
    const prompt = `
        You are an assistant that extracts information from user requests to send Slack messages.
        Given a sentence and a channel mapping, identify:
        1. The correct Slack channel name from the provided mapping.
        2. The message content to send to that channel.
        
        Available channels and their IDs:
        ${channelList}

        If the input doesn't specify a channel or message, return null for those fields.
        Return the result as a JSON object.

        Example:
        Input: "Can you write a message on planning channel saying where are we on the design phase"
        Output: {"channel": "planning", "message": "where are we on the design phase"}

        Example:
        Input: "Ask Shahbaz on General channel about the project status"
        Output: {"channel": "general", "message": "Hey Shahbaz, where are we on the project status?"}

        Input: ${input}
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

export const getGoogleCalenderFieldsUsingLLM = async (
  input: string,
  today_date: string
) => {
  try {
    const prompt = `
      Extract event details from this user instruction and return it as a JSON object with keys:
      - summary
      - description
      - location
      - start: { dateTime, timeZone }
      - end: { dateTime, timeZone }
      - attendees (optional): array of attendies like [name]

      Example Instruction would be like: Set a meeting at 3pm at Y-	Combinator building with Sam Altman to discuss funding strategies 	for my startup. Keep it an hour long. 

      Get the timezone according to location and if it is not there then keep it in pacific time. if timezone is mentioned explicitly then use that one.

      Today’s date is: “${today_date}”

      Instruction: "${input}"
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You extract calendar event information from user instructions.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.log(err);
    return null;
  }
};

export const getGmailDraftFieldsUsingLLM = async (input: string) => {
  try {
    const prompt = `
    Extract the following fields from the instruction and return a JSON object:
    - name
    - subject
    - bodyContent

      Example: 
      Instruction: Write an email to Sam how the presentation went. 
      -name : shahbaz
      -subject: Presentation update
      -bodyContent: Hey Shahbaz, how did the presentation go?
    
    Instruction: "${input}"
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You extract email fields from user instructions for creating Gmail drafts.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.log(err);
    return null;
  }
};

export const getMatchingGmail = async (
  input: string,
  emailList: Array<any>
) => {
  try {
    const prompt = `
    Extract the following fields from the instruction and return a JSON object:
    - from use email list provided to find a matching email by the name that is provided you in prompt if email is not found then retrun name@example.com.

    Available emails:
    ${JSON.stringify(emailList)}
    
    Instruction: "${input}"
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You extract email fields from user instructions for creating Gmail drafts.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.log(err);
    return null;
  }
};

export const getReplyGmailDraftFieldsUsingLLM = async (input: string) => {
  try {
    const prompt = `
    Extract the following fields from the instruction and return a JSON object:
    - name
    - bodyContent
    
    Instruction: "${input}"
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You extract email fields from user instructions for creating Gmail drafts.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.log(err);
    return null;
  }
};

export const getMatchingReplyGmail = async (
  input: string,
  emailList: Array<any>
) => {
  try {
    const prompt = `
    Extract the following fields from the instruction and return a JSON object:
    - from use email list provided to find a matching email by the name that is provided you in prompt if email is not found then return null.
    - messageId
    - threadId
    - subject


    Available emails:
    ${JSON.stringify(emailList)}
    
    Instruction: "${input}"
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You extract email fields from user instructions for creating Gmail drafts.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.log(err);
    return null;
  }
};

export const getPreferencesSummary = async (
  old_preference: string,
  new_preference: string
) => {
  try {
    const prompt = `
    You are given the new preferences and old preferences generate a summary of these:
      Old Preference: "${old_preference}"
      New Preference: "${new_preference}"
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You extract email fields from user instructions for creating Gmail drafts.",
        },
        { role: "user", content: prompt },
      ],
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.log(err);
  }
};
