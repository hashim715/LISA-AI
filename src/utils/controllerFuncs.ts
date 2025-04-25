import {
  getGoogleCalenderFieldsUsingLLM,
  getGmailDraftFieldsUsingLLM,
  getMatchingGmail,
  getMatchingReplyGmail,
  getReplyGmailDraftFieldsUsingLLM,
  getOutlookCalenderFieldsUsingLLM,
  getOutlookDraftFieldsUsingLLM,
  getReplyOutlookDraftFieldsUsingLLM,
  getMatchingReplyOutlookMail,
  getGoogleCalenderFieldsForUpdateUsingLLM,
  getMatchingCalenderEvent,
  getDeleteSearchQueryUsingLLM,
} from "./chatgptFuncs";

import {
  addGoogleCalenderEventFunc,
  createGmailDraft,
  getSenderEmailsUsingSearchQuery,
  createGmailReplyDraft,
  getReplySenderEmailsUsingSearchQuery,
  searchGoogleCalendarEventsFunc,
  updateGoogleCalendarEventFunc,
  deleteGoogleCalendarEventFunc,
  getGoogleCalenderEvents,
  deleteSpecificGmail,
} from "./gmailApi";

import {
  getSenderOutlookEmailsUsingSearchQuery,
  addOutlookCalendarEvent,
  createOutlookMailDraft,
  getReplySenderOutlookEmailsUsingSearchQuery,
  createOutlookReplyDraft,
} from "./outlookApi";

import { DateTime } from "luxon";

import { logger } from "./logger";
import { Email } from "./types";

const isNonEmptyString = (value: any): boolean => {
  return typeof value === "string" && value.trim().length > 0;
};

const fail = (message: string): void => {
  logger.error(message);
  throw new Error(message);
};

export const addGoogleCalenderFunc = async (text: string, user: any) => {
  if (!DateTime.now().setZone(user.timeZone).isValid) {
    throw new Error("Invalid timezone");
  }

  const now = DateTime.now().setZone(user.timeZone).toString();

  const processedInput: string | null = await getGoogleCalenderFieldsUsingLLM(
    text,
    now,
    user.timeZone
  );

  if (!isNonEmptyString(processedInput)) {
    fail("could not get your fields try again with clear description");
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
  } = JSON.parse(processedInput || "");

  let emailArray = [];

  for (const name of attendees) {
    const emailMetaData = await getSenderEmailsUsingSearchQuery(
      name,
      user.google_access_token,
      user.timeZone
    );

    const processedSearchQueryEmail: string | null = await getMatchingGmail(
      name,
      emailMetaData
    );

    const { from }: { from: string } = JSON.parse(
      processedSearchQueryEmail || ""
    );

    if (from) {
      emailArray.push({ email: from });
    }
  }

  emailArray = emailArray.filter((email) => email.email !== "name@example.com");

  console.log(emailArray);

  const data = await addGoogleCalenderEventFunc(
    user.google_access_token,
    summary,
    description,
    location,
    start,
    end,
    emailArray
  );

  return data;
};

export const addOutlookCalenderFunc = async (text: string, user: any) => {
  if (!DateTime.now().setZone(user.timeZone).isValid) {
    throw new Error("Invalid timezone");
  }

  const now = DateTime.now().setZone(user.timeZone).toString();

  const processedInput: string | null = await getOutlookCalenderFieldsUsingLLM(
    text,
    now
  );

  if (!isNonEmptyString(processedInput)) {
    fail("could not get your fields try again with clear description");
  }

  const {
    subject,
    body,
    location,
    start,
    end,
    attendees,
  }: {
    subject: string;
    body: string;
    location: string;
    start: any;
    end: any;
    attendees: any;
  } = JSON.parse(processedInput || "");

  let emailArray = [];

  for (const name of attendees) {
    const emailMetaData = await getSenderOutlookEmailsUsingSearchQuery(
      user.outlook_access_token,
      name
    );

    const processedSearchQueryEmail: string | null = await getMatchingGmail(
      name,
      emailMetaData
    );

    const { from }: { from: string } = JSON.parse(
      processedSearchQueryEmail || ""
    );

    if (from) {
      emailArray.push({
        emailAddress: {
          address: from,
          name: name,
        },
        type: "required",
      });
    }
  }

  emailArray = emailArray.filter(
    (email) => email.emailAddress.address !== "name@example.com"
  );

  console.log(emailArray);

  const data = await addOutlookCalendarEvent(
    user.outlook_access_token,
    subject,
    body,
    location,
    start,
    end,
    emailArray
  );

  return data;
};

export const updateGoogleCalenderFunc = async (text: string, user: any) => {
  if (!DateTime.now().setZone(user.timeZone).isValid) {
    throw new Error("Invalid timezone");
  }

  const now = DateTime.now().setZone(user.timeZone).toString();

  const processedInput = await getGoogleCalenderFieldsForUpdateUsingLLM(
    text,
    now,
    user.timeZone
  );

  if (!isNonEmptyString(processedInput)) {
    fail("could not get your fields try again with clear description");
  }

  console.log(processedInput);

  const {
    title,
    description,
    location,
    start,
    end,
    attendees,
    query,
  }: {
    title: string;
    description: string;
    location: string;
    start: any;
    end: any;
    attendees: any;
    query: string;
  } = JSON.parse(processedInput || "");

  let emailArray: Array<{ email: string }> = [];

  if (attendees) {
    for (const name of attendees) {
      const emailMetaData = await getSenderEmailsUsingSearchQuery(
        name,
        user.google_access_token,
        user.timeZone
      );

      const processedSearchQueryEmail = await getMatchingGmail(
        name,
        emailMetaData
      );

      const { from }: { from: string } = JSON.parse(
        processedSearchQueryEmail || ""
      );

      if (from) {
        emailArray.push({ email: from });
      }
    }
  }

  emailArray = emailArray.filter((email) => email.email !== "name@example.com");

  const events = await searchGoogleCalendarEventsFunc(
    user.google_access_token,
    user.timeZone
  );

  console.log(events);

  if (!events || events.length === 0) {
    fail("event that you mentioned does not exists");
  }

  const matchinEvent = await getMatchingCalenderEvent(query, events, now);

  if (!matchinEvent) {
    fail("Could not find emails for the given name");
  }

  console.log(matchinEvent);

  const { event }: { event: any } = JSON.parse(matchinEvent || "");

  if (!event) {
    fail(
      "Tell the user i tried to find the event couldn't find it so please specify exactly which event to update"
    );
  }

  const data = await updateGoogleCalendarEventFunc(
    user.google_access_token,
    event,
    title,
    description,
    location,
    start,
    end,
    attendees ? emailArray : []
  );

  return data;
};

export const deleteGoogleCalenderFunc = async (text: string, user: any) => {
  if (!DateTime.now().setZone(user.timeZone).isValid) {
    throw new Error("Invalid timezone");
  }

  const searchQuery = await getDeleteSearchQueryUsingLLM(text);
  const now = DateTime.now().setZone(user.timeZone).toString();

  if (!isNonEmptyString(searchQuery)) {
    fail("could not find out what user is asking");
  }

  const { query }: { query: any } = JSON.parse(searchQuery || "");

  if (!isNonEmptyString(query)) {
    fail("could not find out what user is asking");
  }

  console.log(query);

  const events = await getGoogleCalenderEvents(
    user.google_access_token,
    user.timeZone
  );

  console.log(events);

  if (!events || events.length === 0) {
    fail("event that you mentioned does not exists");
  }

  const matchinEvent = await getMatchingCalenderEvent(query, events, now);

  if (!isNonEmptyString(matchinEvent)) {
    fail("Could not find emails for the given name");
  }

  const { event }: { event: any } = JSON.parse(matchinEvent || "");

  if (!event) {
    fail(
      "Tell the user i tried to find the event couldn't find it so please specify exactly which event to update"
    );
  }

  const data = await deleteGoogleCalendarEventFunc(
    user.google_access_token,
    event.id
  );

  return data;
};

export const draftGoogleGmailFunc = async (text: string, user: any) => {
  const processedInput = await getGmailDraftFieldsUsingLLM(text);

  if (!isNonEmptyString(processedInput)) {
    fail("could not get your fields try again with clear description");
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
  } = JSON.parse(processedInput || "");

  if (!isNonEmptyString(name) || !isNonEmptyString(bodyContent)) {
    fail(
      "Ask the user to tell name,body,subject correctly one of the field is not specified correctly"
    );
  }

  const emailMetaData = await getSenderEmailsUsingSearchQuery(
    name,
    user.google_access_token,
    user.timeZone
  );

  console.log(emailMetaData);

  const processedSearchQueryEmail = await getMatchingGmail(name, emailMetaData);

  if (!isNonEmptyString(processedSearchQueryEmail)) {
    fail("Could not find emails for the given name");
  }

  console.log(processedSearchQueryEmail);

  const { from }: { from: string } = JSON.parse(
    processedSearchQueryEmail || ""
  );

  if (!isNonEmptyString(from)) {
    fail(
      "Tell the user i tried to find the reciever email couldn't find it so please specify exactly to whon to send this email"
    );
  }

  const data = await createGmailDraft(
    user.google_access_token,
    user.google_email,
    from,
    user.name,
    subject,
    bodyContent
  );

  return data;
};

export const draftOutlookMailFunc = async (text: string, user: any) => {
  const processedInput = await getOutlookDraftFieldsUsingLLM(text);

  if (!isNonEmptyString(processedInput)) {
    fail("could not get your fields try again with clear description");
  }

  const {
    name,
    bodyContent,
    subject,
  }: {
    name: string;
    bodyContent: string;
    subject: string;
  } = JSON.parse(processedInput || "");

  if (!isNonEmptyString(name) || !isNonEmptyString(bodyContent)) {
    fail(
      "Ask the user to tell name,body,subject correctly one of the field is not specified correctly"
    );
  }

  const emailMetaData = await getSenderOutlookEmailsUsingSearchQuery(
    user.outlook_access_token,
    name
  );

  console.log(emailMetaData);

  const processedSearchQueryEmail = await getMatchingGmail(name, emailMetaData);

  if (!isNonEmptyString(processedSearchQueryEmail)) {
    fail("Could not find emails for the given name");
  }

  console.log(processedSearchQueryEmail);

  const { from }: { from: string } = JSON.parse(
    processedSearchQueryEmail || ""
  );

  if (!isNonEmptyString(from)) {
    fail(
      "Tell the user i tried to find the reciever email couldn't find it so please specify exactly to whon to send this email"
    );
  }

  const data = await createOutlookMailDraft(
    user.outlook_access_token,
    from,
    subject,
    bodyContent
  );

  return data;
};

export const draftGoogleGmailReplyFunc = async (text: string, user: any) => {
  const processedInput = await getReplyGmailDraftFieldsUsingLLM(text);

  if (!isNonEmptyString(processedInput)) {
    fail("could not get your fields try again with clear description");
  }

  console.log(processedInput);

  const {
    name,
    bodyContent,
  }: {
    name: string;
    bodyContent: string;
  } = JSON.parse(processedInput || "");

  if (!isNonEmptyString(name) || !isNonEmptyString(bodyContent)) {
    fail(
      "Ask the user to tell name,body correctly one of the field is not specified correctly"
    );
  }

  const replyEmailMetaData = await getReplySenderEmailsUsingSearchQuery(
    name,
    user.google_access_token,
    user.timeZone
  );

  console.log(replyEmailMetaData);

  if (!replyEmailMetaData || replyEmailMetaData.length === 0) {
    fail("Could not find emails for the given name");
  }

  const processedSearchQueryEmail = await getMatchingReplyGmail(
    name,
    replyEmailMetaData
  );

  if (!isNonEmptyString(processedSearchQueryEmail)) {
    fail("Could not find emails for the given name");
  }

  console.log(processedSearchQueryEmail);

  const {
    messageId,
    threadId,
    subject,
    from,
  }: { messageId: string; threadId: string; subject: string; from: string } =
    JSON.parse(processedSearchQueryEmail || "");

  if (
    !isNonEmptyString(messageId) ||
    !isNonEmptyString(threadId) ||
    !isNonEmptyString(from)
  ) {
    fail(
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

  return data;
};

export const draftOutlookMailReplyFunc = async (text: string, user: any) => {
  const processedInput = await getReplyOutlookDraftFieldsUsingLLM(text);

  if (!isNonEmptyString(processedInput)) {
    fail("could not get your fields try again with clear description");
  }

  const {
    name,
    bodyContent,
  }: {
    name: string;
    bodyContent: string;
  } = JSON.parse(processedInput || "");

  if (!isNonEmptyString(name) || !isNonEmptyString(bodyContent)) {
    fail(
      "Ask the user to tell name,body correctly one of the field is not specified correctly"
    );
  }

  const replyEmailMetaData = await getReplySenderOutlookEmailsUsingSearchQuery(
    user.outlook_access_token,
    name
  );

  if (!replyEmailMetaData || replyEmailMetaData.length === 0) {
    fail("Could not find emails for the given name");
  }

  const processedSearchQueryEmail = await getMatchingReplyOutlookMail(
    name,
    replyEmailMetaData
  );

  if (!isNonEmptyString(processedSearchQueryEmail)) {
    fail("Could not find emails for the given name");
  }

  console.log(processedSearchQueryEmail);

  const { messageId, from }: { messageId: string; from: string } = JSON.parse(
    processedSearchQueryEmail || ""
  );

  if (!isNonEmptyString(messageId) || !isNonEmptyString(from)) {
    fail(
      "Tell the user i tried to find the reciever email couldn't find it so please specify exactly to whom to reply"
    );
  }

  const data = await createOutlookReplyDraft(
    messageId,
    bodyContent,
    user.outlook_access_token
  );

  return data;
};

export const deleteGoogleGmailFunc = async (text: string, user: any) => {
  const emailMetaData: Array<Email> = await getSenderEmailsUsingSearchQuery(
    text,
    user.google_access_token,
    user.timeZone
  );

  if (!emailMetaData || emailMetaData.length === 0) {
    fail("no emails found matching this search query");
  }

  const processedSearchQueryEmail: string | null = await getMatchingGmail(
    text,
    emailMetaData
  );

  let parseEmail;

  try {
    parseEmail = JSON.parse(processedSearchQueryEmail || "");
  } catch (err) {
    fail(`could not parse matching gmail due to this: ${err}`);
  }

  if (!parseEmail?.id?.trim()) {
    fail(
      "Tell the user i tried to find the reciever email couldn't find it so please specify exactly to whon to send this email"
    );
  }

  await deleteSpecificGmail(parseEmail.id, user.google_access_token).catch(
    (err: Error) => {
      logger.error("Gmail delete API error:", err.message || err.toString());
      throw new Error("email could not be deleted please try again.");
    }
  );
};
