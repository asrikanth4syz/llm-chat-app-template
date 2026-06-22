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
  iat: number;
  exp: number;
}
