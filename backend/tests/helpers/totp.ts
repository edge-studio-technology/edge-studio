import * as OTPAuth from "otpauth";

/** Generates codes the way an authenticator app would, from the same TOTP parameters the app uses. */
export function currentToken(secret: string, timestamp = Date.now()) {
  return new OTPAuth.TOTP({
    issuer: "Edge Studio",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret)
  }).generate({ timestamp });
}

/** A well-formed 6-digit code that is never the valid one for `secret`. */
export function wrongToken(secret: string) {
  return currentToken(secret) === "000000" ? "111111" : "000000";
}
