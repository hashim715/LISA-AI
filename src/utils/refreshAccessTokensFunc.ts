import {
  refreshGoogleAccessToken,
  refreshOutlookAccessToken,
} from "../middleware/refreshAccessToken";
import { prisma } from "../config/postgres";
import jwt_decode from "jwt-decode";

export const refreshAccessTokensFunc = async (token: string) => {
  try {
    const { username }: { username: string } = jwt_decode(token);
    let user = await prisma.user.findFirst({ where: { username: username } });

    if (user.google_login) {
      const currentDate = new Date();
      const expiryDate = new Date(user.google_token_expiry);

      const isExpired: boolean = expiryDate < currentDate;

      if (isExpired) {
        const google_token_data = await refreshGoogleAccessToken(
          user.google_refresh_token
        );

        if (!google_token_data) {
          return;
        }

        const expiryDate = new Date(
          Date.now() + parseInt(google_token_data.expires_in) * 1000
        );

        await prisma.user.update({
          where: { email: user.email },
          data: {
            google_access_token: google_token_data.access_token,
            google_refresh_token: google_token_data.refresh_token,
            google_token_expiry: expiryDate.toISOString(),
          },
        });
      }
    }

    if (user.outlook_login) {
      const currentDate = new Date();
      const expiryDate = new Date(user.outlook_token_expiry);

      const isExpired: boolean = expiryDate < currentDate;

      if (isExpired) {
        const outlook_token_data = await refreshOutlookAccessToken(
          user.outlook_refresh_token
        );

        if (!outlook_token_data) {
          return;
        }

        const expiryDate = new Date(
          Date.now() + parseInt(outlook_token_data.expires_in) * 1000
        );

        await prisma.user.update({
          where: { email: user.email },
          data: {
            outlook_access_token: outlook_token_data.access_token,
            outlook_refresh_token: outlook_token_data.refresh_token,
            outlook_token_expiry: expiryDate.toISOString(),
          },
        });
      }
    }

    user = await prisma.user.findFirst({ where: { username: username } });

    return user;
  } catch (err) {
    console.log(err);
    return null;
  }
};
