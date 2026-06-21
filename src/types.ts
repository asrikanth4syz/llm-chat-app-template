export interface Env {
  DB: D1Database;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  JWT_SECRET: string;
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

export interface User {
  id: string;
  email: string;
  role: string;
  name: string;
  org: string;
  initials: string;
  active: number;
}
