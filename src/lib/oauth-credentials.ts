/**
 * OAuth 2.0 Client Credentials flow for machine-to-machine auth (ByteByteGo #8).
 * Used for agent-to-backend API calls, service-to-service communication.
 */

import { createHmac, randomBytes } from "crypto";

interface ClientCredentials {
  clientId: string;
  clientSecret: string;
  scopes: string[];
  createdAt: number;
  expiresAt: number | null;
}

interface AccessToken {
  token: string;
  expiresIn: number;
  scopes: string[];
  issuedAt: number;
}

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const tokenStore = new Map<string, AccessToken>();

export function generateClientCredentials(scopes: string[] = ["read"]): ClientCredentials {
  const clientId = `cid_${randomBytes(16).toString("hex")}`;
  const clientSecret = `cs_${randomBytes(32).toString("hex")}`;
  return { clientId, clientSecret, scopes, createdAt: Date.now(), expiresAt: null };
}

export function issueToken(clientId: string, clientSecret: string, registeredCreds: ClientCredentials): AccessToken | null {
  if (clientId !== registeredCreds.clientId) return null;
  if (clientSecret !== registeredCreds.clientSecret) return null;
  if (registeredCreds.expiresAt && Date.now() > registeredCreds.expiresAt) return null;

  const payload = `${clientId}:${Date.now()}:${randomBytes(8).toString("hex")}`;
  const token = createHmac("sha256", clientSecret).update(payload).digest("hex");

  const accessToken: AccessToken = {
    token: `mt_${token}`,
    expiresIn: TOKEN_EXPIRY_MS / 1000,
    scopes: registeredCreds.scopes,
    issuedAt: Date.now(),
  };

  tokenStore.set(accessToken.token, accessToken);
  return accessToken;
}

export function validateToken(token: string): { valid: boolean; scopes: string[] } {
  const stored = tokenStore.get(token);
  if (!stored) return { valid: false, scopes: [] };
  if (Date.now() - stored.issuedAt > TOKEN_EXPIRY_MS) {
    tokenStore.delete(token);
    return { valid: false, scopes: [] };
  }
  return { valid: true, scopes: stored.scopes };
}

export function revokeToken(token: string): boolean {
  return tokenStore.delete(token);
}
