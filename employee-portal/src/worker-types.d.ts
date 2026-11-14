// Minimal ambient types so the Worker typechecks without pulling the full
// @cloudflare/workers-types package into this scaffold. `wrangler types` can
// regenerate the complete set later.
declare interface D1Result<T = unknown> { results: T[]; success: boolean; meta: Record<string, unknown>; }
declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
declare interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
