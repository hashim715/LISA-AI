import crypto from "crypto";

export const generateVerificationCode = () => {
  const token = crypto.randomBytes(20).toString("hex");
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const verificationToken = crypto
    .createHash("sha256")
    .update(code + token)
    .digest("hex");
  return { verificationToken, token, code };
};
