export interface Env {
  DB: D1Database;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  JWT_SECRET: string;
  APP_ENV: string;
  EMAIL_FROM: string;
  MAILCHANNELS_ENABLED: string;
  ZOHO_BOOKS_ORG_ID: string;
  ZOHO_BOOKS_CLIENT_ID: string;
  ZOHO_BOOKS_WEBHOOK_SECRET: string;
  ZOHO_INVENTORY_ORG_ID?: string;
  ZOHO_ACCESS_TOKEN?: string;
  ZOHO_INVENTORY_WEBHOOK_SECRET?: string;
  // Zoho Inventory → App sync (milestone 002): OAuth2 refresh-token flow.
  ZOHO_CLIENT_ID?: string;
  ZOHO_CLIENT_SECRET?: string;
  ZOHO_REFRESH_TOKEN?: string;
  ZOHO_DC?: string; // data centre, e.g. "in" → accounts.zoho.in / zohoapis.in
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER: string;
  MSG91_AUTH_KEY: string;
  OTP_EXPIRY_MINUTES: string;
  OTP_ENABLED: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  org: string;
  initials: string;
  client_id?: string;
  iat: number;
  exp: number;
}
