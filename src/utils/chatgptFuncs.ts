import OpenAI from "openai";
import { Email } from "./types";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
};

export const summarizeNotionWithLLM = async (allContent: string) => {
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

  return completion.choices[0].message.content || "";
};

export const getGoogleCalenderFieldsUsingLLM = async (
  input: string,
  today_date: string,
  timeZone: string
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

      Example Instruction would be like: Set a meeting at 3pm at Y-	Combinator building with Sam Altman to discuss funding strategies for my startup. Keep it an hour long.

      Determine the appropriate timezone based on the user’s location.

      If a timezone is explicitly mentioned, use that.
      If neither a timezone nor a location is given, default to user's timezone as given.

      Today’s date is: “${today_date}”

      User's timezone: "${timeZone}"

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

export const getGoogleCalenderFieldsForUpdateUsingLLM = async (
  input: string,
  today_date: string,
  timeZone: string
) => {
  try {
    const prompt = `
      Extract event details from the user instruction and construct a search query to find matching events. Return a JSON object with keys:
      - query: a search query constructed from the extracted title, description, or location (prioritize title, then description, then location; combine if multiple fields are provided), or null if no fields are suitable
      - title: if provided, otherwise null
      - description: if provided, otherwise null
      - location: if provided, otherwise null
      - start: { dateTime, timeZone } if provided, otherwise null
      - end: { dateTime, timeZone } if provided, otherwise null
      - attendees (optional): array of attendies like [name] if provided otherwise null

      Example Instructions and Outputs:

      1. Instruction: "Set a meeting at 3pm at Y-Combinator building with Sam Altman to discuss funding strategies for my startup. Keep it an hour long."
        Output: {
          "query": "funding Y-Combinator",
          "title": "Meeting to discuss funding strategies",
          "description": "Discuss funding strategies for my startup",
          "location": "Y-Combinator building",
          "start": { "dateTime": "2025-04-19T15:00:00", "timeZone": "America/Los_Angeles" },
          "end": { "dateTime": "2025-04-19T16:00:00", "timeZone": "America/Los_Angeles" },
          "attendees": [sam altman],
      }

      2. Instruction: "Schedule a budget review at 2pm in New York tomorrow."
        Output: {
          "query": "budget review New York",
          "title": "Budget review",
          "description": null,
          "location": "New York",
          "start": { "dateTime": "2025-04-20T14:00:00", "timeZone": "America/New_York" },
          "end": null,
          "attendees": [],
      }

      3. Instruction: "Plan a team meeting with Jane Doe at 10am."
        Output: {
          "query": "team meeting",
          "title": "Team meeting",
          "description": null,
          "location": null,
          "start": { "dateTime": "2025-04-19T10:00:00", "timeZone": "America/Los_Angeles" },
          "end": null,
          "attendees": [jan doe],
      }

      If a timezone is explicitly mentioned, use that.
      If neither a timezone nor a location is given, default to user's timezone as given.

      Today’s date is: "${today_date}"

      User's timezone: "${timeZone}"

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

export const getMatchingCalenderEvent = async (
  inputEvent: any,
  eventList: Array<any>,
  today_date: string
) => {
  try {
    const prompt = `
     Extract the event from the list of events by matching and getting the most similar and return a json object

     - {event: object}

    Available emails:
    ${JSON.stringify(eventList)}

    Today’s date is: "${today_date}"
    
    Instruction: "${JSON.stringify(inputEvent)}"
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You extract calendar event details by matching a provided search query against a list of events, returning the first matching event or null with a debug message.",
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

export const getDeleteSearchQueryUsingLLM = async (input: string) => {
  try {
    const prompt = `
      Given the following instruction, extract the user's search query—such as a name, description, or location—and return it as a JSON object with the field:

      - query

      Instruction: "${input}"
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You extract search query from the given instruction",
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
};

export const getMatchingGmail = async (
  input: string,
  emailList: Array<Email>
): Promise<string | null> => {
  const prompt = `
    Extract the following fields from the instruction and return a JSON object:
    - from use email list provided to find a matching email by the name that is provided you in prompt if email is not found then retrun name@example.com.
    - id

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
};

export const getReplyGmailDraftFieldsUsingLLM = async (input: string) => {
  try {
    const prompt = `
    Extract the following fields from the instruction and return a JSON object:
    - name
    - bodyContent

    name would be the name of person and content would be the message they want to send.
    
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

export const getOutlookCalenderFieldsUsingLLM = async (
  input: string,
  today_date: string
) => {
  try {
    const prompt = `
      Extract event details from this user instruction and return it as a JSON object with keys:
      - subject
      - body {contentType: "Text", content: description}
      - location { displayName: location},
      - start: { dateTime, timeZone }
      - end: { dateTime, timeZone }
      - attendees (optional): array of attendies like [name]

      Example Instruction would be like: Set a meeting at 3pm at Y-	Combinator building with Sam Altman to discuss funding strategies 	for my startup. Keep it an hour long. 

      Determine the appropriate timezone based on the user’s location.

      If a timezone is explicitly mentioned, use that.
      If no timezone is mentioned but a location is provided, infer the timezone from the location.
      If neither a timezone nor a location is given, default to America/Los_Angeles.

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

export const getOutlookDraftFieldsUsingLLM = async (input: string) => {
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

export const getReplyOutlookDraftFieldsUsingLLM = async (input: string) => {
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

export const getMatchingReplyOutlookMail = async (
  input: string,
  emailList: Array<any>
) => {
  try {
    const prompt = `
    Extract the following fields from the instruction and return a JSON object:
    - from use email list provided to find a matching email by the name that is provided you in prompt if email is not found then return null.
    - messageId

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

export const getSearchNewsQueryFromMorningPreferences = async (
  morning_preferences: string
) => {
  const prompt = `
    These are the user preferences: ${morning_preferences} from a user for the morning update. From these preferences, remove any part which is talking about events and only filter out the parts that are talking about any news.

    Example 1, if the user preference is: "Web 3 events in San Fransisco and most Latest Research Papers in Natural Language Processing", you should filter it out to "Latest Research Papers in Natural Language Processing"

    Example 2, if the user preference is: "Hackathons in New York and Latest News in AI", you should filter it out to "Latest News in AI"

    just return the query result don't include words like query: or search:

    If there is no news piece that you can filter out, just return empty string
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You extract search query from the given instruction",
      },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message.content || "";
};

export const getEventsFromMorningPreferences = async (
  morning_preferences: string
) => {
  const prompt = `
      These are the user preferences: ${morning_preferences} from a user for the morning update. From these preferences, remove any part which is talking about news and only filter out the parts that are talking about any events. 

      Example 1, if the user preference is: "Web 3 events in San Fransisco and most Latest Research Papers in Natural Language Processing", you should filter it out to "Web 3 events in San Fransisco"

      Example 2, if the user preference is: "Hackathons in New York and Latest News in AI", you should filter it out to "Hackathons in New York"

      I there is no events piece that you can filter out, just return empty string
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You extract events from the user morning pereferences.",
      },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message.content || "";
};

export const getrelevantEventsFromMorningPreferences = async (
  user_events: string,
  events: string
) => {
  const prompt = `
      These are the types of events the user wants: ${user_events} and these are the events happening tomorrow: ${events}
      Find top two most relevant events. If you think none of them are relevant, just return empty string.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You extract events from the user morning pereferences.",
      },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message.content || "";
};
