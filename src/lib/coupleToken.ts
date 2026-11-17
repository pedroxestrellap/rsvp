import { createHmac, timingSafeEqual } from "node:crypto";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function signCoupleToken(weddingId: string, version: string, secret: string) {
  const payload = `${weddingId}.${version}`;
  const signature = createHmac("sha256", secret).update(`rsvp:couple-access:v1:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyCoupleToken(token: string, secret: string) {
  const [weddingId, version, signature, extra] = token.split(".");
  if (extra !== undefined || !uuid.test(weddingId ?? "") || !uuid.test(version ?? "") || !/^[\w-]{43}$/.test(signature ?? "")) return null;
  const expected = signCoupleToken(weddingId, version, secret).split(".")[2];
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return { weddingId, version };
}
