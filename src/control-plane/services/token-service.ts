import { randomToken, signToken } from "../../common/crypto.js";

export class SessionTokenService {
  public constructor(public readonly secret: string) {}

  public mintToken(
    scope: "bootstrap" | "events",
    sessionId: string,
    machineId: string,
    ttlMs: number
  ): { token: string; expiresAt: string } {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + ttlMs;

    return {
      token: signToken(
        {
          exp: expiresAt,
          iat: issuedAt,
          nonce: randomToken(12),
          scope,
          session_id: sessionId,
          machine_id: machineId
        },
        this.secret
      ),
      expiresAt: new Date(expiresAt).toISOString()
    };
  }
}
