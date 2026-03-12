import { verifyToken } from "@clerk/backend";
import { HttpError } from "../../common/errors.js";
import type { AuthenticatedUser } from "../../common/types.js";

export interface UserTokenVerifier {
  verify(token: string): Promise<AuthenticatedUser>;
}

export class ClerkUserTokenVerifier implements UserTokenVerifier {
  private readonly secretKey: string;

  public constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  public async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = await verifyToken(token, { secretKey: this.secretKey });
      return {
        userId: payload.sub,
        token
      };
    } catch {
      throw new HttpError(401, "invalid_user_token", "User token is invalid.");
    }
  }
}
