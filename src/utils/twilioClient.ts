import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_ACCOUNT_TOKEN;
export const twilio_client = twilio(accountSid, authToken);

async function createService() {
  const service = await twilio_client.verify.v2.services.create({
    friendlyName: "Protect",
  });
  console.log(service.sid);
}

// createService();

async function createVerification() {
  const verification = await twilio_client.verify.v2
    .services("VA3a58098e38160606c6552b7198354374")
    .verifications.create({
      channel: "sms",
      to: "+13463916054",
    });

  console.log(verification.status);
}

//createVerification();

async function createVerificationCheck() {
  const verificationCheck = await twilio_client.verify.v2
    .services("VA3a58098e38160606c6552b7198354374")
    .verificationChecks.create({
      code: "631632",
      to: "+13463916054",
    });

  console.log(verificationCheck.status);
}

// createVerificationCheck();
