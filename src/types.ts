export interface Env {
  DB: D1Database;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  // Workers AI (Phase 2 draft extraction). Optional: an account without the
  // binding still works via the deterministic parser, which is the source of truth.
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
  JWT_SECRET: string;
  APP_ENV: string;
  // Optional production bootstrap admin (set as Cloudflare secrets). When present,
  // provisions/rotates one super_admin after seed accounts are disabled.
  BOOTSTRAP_ADMIN_EMAIL?: string;
  BOOTSTRAP_ADMIN_PASSWORD?: string;
  EMAIL_FROM: string;
  MAILCHANNELS_ENABLED: string;
  ZOHO_BOOKS_ORG_ID: string;
  ZOHO_BOOKS_CLIENT_ID: string;
  ZOHO_BOOKS_WEBHOOK_SECRET: string;
  ZOHO_INVENTORY_ORG_ID?: string;
  ZOHO_ACCESS_TOKEN?: string;
  ZOHO_INVENTORY_WEBHOOK_SECRET?: string;
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
