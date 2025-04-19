import { Response } from "express";
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

import { badRequestResponse } from "../controllers/errors";

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
} from "./gmailApi";

import {
  getSenderOutlookEmailsUsingSearchQuery,
  addOutlookCalendarEvent,
  createOutlookMailDraft,
  getReplySenderOutlookEmailsUsingSearchQuery,
  createOutlookReplyDraft,
} from "./outlookApi";

import { DateTime } from "luxon";

export const addGoogleCalenderFunc = async (
  res: Response,
  text: string,
  user: any
) => {
  try {
    const now = DateTime.now().setZone(user.timeZone).toString();

    const processedInput = await getGoogleCalenderFieldsUsingLLM(
      text,
      now,
      user.timeZone
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

    let emailArray = [];

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

      const { from }: { from: string } = JSON.parse(processedSearchQueryEmail);

      if (from) {
        emailArray.push({ email: from });
      }
    }

    emailArray = emailArray.filter(
      (email) => email.email !== "name@example.com"
    );

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

    if (!data) {
      return res.status(400).json({
        success: false,
        message:
          "could not add calender event can you please try again may be something wrong with the input you provided",
      });
    }

    return data;
  } catch (err) {
    return null;
  }
};

export const addOutlookCalenderFunc = async (
  text: string,
  res: Response,
  user: any
) => {
  try {
    const now = DateTime.now().setZone(user.timeZone).toString();

    const processedInput = await getOutlookCalenderFieldsUsingLLM(text, now);

    if (!processedInput) {
      return badRequestResponse(res, "Please provide valid input");
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
    } = JSON.parse(processedInput);

    let emailArray = [];

    for (const name of attendees) {
      const emailMetaData = await getSenderOutlookEmailsUsingSearchQuery(
        user.outlook_access_token,
        name
      );

      const processedSearchQueryEmail = await getMatchingGmail(
        name,
        emailMetaData
      );

      const { from }: { from: string } = JSON.parse(processedSearchQueryEmail);

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

    if (!data) {
      return res.status(400).json({
        success: false,
        message:
          "could not add calender event can you please try again may be something wrong with the input you provided",
      });
    }

    return data;
  } catch (err) {
    return null;
  }
};

export const updateGoogleCalenderFunc = async (
  res: Response,
  text: string,
  user: any
) => {
  try {
    const now = DateTime.now().setZone(user.timeZone).toString();

    const processedInput = await getGoogleCalenderFieldsForUpdateUsingLLM(
      text,
      now,
      user.timeZone
    );

    if (!processedInput) {
      return badRequestResponse(res, "Please provide valid input");
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
    } = JSON.parse(processedInput);

    let emailArray = [];

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
          processedSearchQueryEmail
        );

        if (from) {
          emailArray.push({ email: from });
        }
      }
    }

    emailArray = emailArray.filter(
      (email) => email.email !== "name@example.com"
    );

    const events = await searchGoogleCalendarEventsFunc(
      user.google_access_token,
      user.timeZone
    );

    console.log(events);

    if (!events || events.length === 0) {
      return res.status(404).json({
        success: false,
        message: "event that you mentioned does not exists",
      });
    }

    const matchinEvent = await getMatchingCalenderEvent(query, events, now);

    if (!matchinEvent) {
      return badRequestResponse(
        res,
        "Could not find emails for the given name"
      );
    }

    console.log(matchinEvent);

    const { event }: { event: any } = JSON.parse(matchinEvent);

    if (!event) {
      return res.status(400).json({
        success: false,
        message:
          "Tell the user i tried to find the event couldn't find it so please specify exactly which event to update",
      });
    }

    const data = await updateGoogleCalendarEventFunc(
      user.google_access_token,
      event,
      title,
      description,
      location,
      start,
      end,
      attendees ? emailArray : null
    );

    if (!data) {
      return res.status(400).json({
        success: false,
        message:
          "could not update calender event can you please try again may be something wrong with the input you provided",
      });
    }

    return data;
  } catch (err) {
    return null;
  }
};

export const deleteGoogleCalenderFunc = async (
  res: Response,
  text: string,
  user: any
) => {
  try {
    const searchQuery = await getDeleteSearchQueryUsingLLM(text);
    const now = DateTime.now().setZone(user.timeZone).toString();

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        message: "could not find out what user is asking",
      });
    }

    const { query }: { query: any } = JSON.parse(searchQuery);

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "could not find out what user is asking",
      });
    }

    console.log(query);

    const events = await getGoogleCalenderEvents(
      user.google_access_token,
      user.timeZone
    );

    console.log(events);

    if (!events || events.length === 0) {
      return res.status(404).json({
        success: false,
        message: "event that you mentioned does not exists",
      });
    }

    const matchinEvent = await getMatchingCalenderEvent(query, events, now);

    if (!matchinEvent) {
      return badRequestResponse(
        res,
        "Could not find emails for the given name"
      );
    }

    const { event }: { event: any } = JSON.parse(matchinEvent);

    if (!event) {
      return res.status(400).json({
        success: false,
        message:
          "Tell the user i tried to find the event couldn't find it so please specify exactly which event to update",
      });
    }

    const data = await deleteGoogleCalendarEventFunc(
      user.google_access_token,
      event.id
    );

    if (!data) {
      return res.status(400).json({
        success: false,
        message:
          "could not update calender event can you please try again may be something wrong with the input you provided",
      });
    }

    return data;
  } catch (err) {
    return null;
  }
};

export const draftGoogleGmailFunc = async (
  text: string,
  res: Response,
  user: any
) => {
  try {
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
      user.google_access_token,
      user.timeZone
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

    return data;
  } catch (err) {
    return null;
  }
};

export const draftOutlookMailFunc = async (
  text: string,
  res: Response,
  user: any
) => {
  try {
    const processedInput = await getOutlookDraftFieldsUsingLLM(text);

    if (!processedInput) {
      return badRequestResponse(res, "Please provide valid input");
    }

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

    const emailMetaData = await getSenderOutlookEmailsUsingSearchQuery(
      user.outlook_access_token,
      name
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

    const data = await createOutlookMailDraft(
      user.outlook_access_token,
      from,
      subject,
      bodyContent
    );

    if (!data) {
      return res.status(400).json({
        success: false,
        message: "could not draft email please try again",
      });
    }

    return data;
  } catch (err) {
    return null;
  }
};

export const draftGoogleGmailReplyFunc = async (
  text: string,
  res: Response,
  user: any
) => {
  try {
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
      user.google_access_token,
      user.timeZone
    );

    console.log(replyEmailMetaData);

    if (!replyEmailMetaData || replyEmailMetaData.length === 0) {
      return badRequestResponse(
        res,
        "Could not find emails for the given name"
      );
    }

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

    return data;
  } catch (err) {
    console.log(err);
    return null;
  }
};

export const draftOutlookMailReplyFunc = async (
  text: string,
  res: Response,
  user: any
) => {
  try {
    const processedInput = await getReplyOutlookDraftFieldsUsingLLM(text);

    if (!processedInput) {
      return badRequestResponse(res, "please provide valid input");
    }

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

    const replyEmailMetaData =
      await getReplySenderOutlookEmailsUsingSearchQuery(
        user.outlook_access_token,
        name
      );

    if (!replyEmailMetaData || replyEmailMetaData.length === 0) {
      return badRequestResponse(
        res,
        "Could not find emails for the given name"
      );
    }

    const processedSearchQueryEmail = await getMatchingReplyOutlookMail(
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

    const { messageId, from }: { messageId: string; from: string } = JSON.parse(
      processedSearchQueryEmail
    );

    if (!messageId || !messageId.trim() || !from || !from.trim()) {
      return badRequestResponse(
        res,
        "Tell the user i tried to find the reciever email couldn't find it so please specify exactly to whom to reply"
      );
    }

    const data = await createOutlookReplyDraft(
      messageId,
      bodyContent,
      user.outlook_access_token
    );

    if (!data) {
      return badRequestResponse(
        res,
        "could not create draft reply email try again with valid inputs"
      );
    }

    return data;
  } catch (err) {
    return null;
  }
};
