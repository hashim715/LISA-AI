export const decodeBase64Url = (base64String: any) => {
  const base64 = base64String.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
};
