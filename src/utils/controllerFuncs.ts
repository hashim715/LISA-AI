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
} from "./chatgptFuncs";

import { badRequestResponse } from "../controllers/errors";

import {
  addGoogleCalenderEventFunc,
  createGmailDraft,
  getSenderEmailsUsingSearchQuery,
  createGmailReplyDraft,
  getReplySenderEmailsUsingSearchQuery,
} from "./gmailApi";

import {
  getSenderOutlookEmailsUsingSearchQuery,
  addOutlookCalendarEvent,
  createOutlookMailDraft,
  getReplySenderOutlookEmailsUsingSearchQuery,
  createOutlookReplyDraft,
} from "./outlookApi";

export const addGoogleCalenderFunc = async (
  res: Response,
  text: string,
  user: any
) => {
  try {
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

    let emailArray = [];

    for (const name of attendees) {
      const emailMetaData = await getSenderEmailsUsingSearchQuery(
        name,
        user.google_access_token
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
    const processedInput = await getOutlookCalenderFieldsUsingLLM(
      text,
      new Date().toISOString()
    );

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
      user.google_access_token
    );

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
