// Worker entrypoint.
//
// Why this file exists: src/index.ts intentionally exposes many *named* exports
// (SEND_CRON, BOOKS_SYNC_CRON, pure helpers, …) so the vitest suite can unit-test
// them in isolation. The vitest-pool-workers runtime tolerates those named
// exports, but the real `workerd` used by `wrangler dev` / `wrangler deploy`
// treats every named export of the ENTRY module as a service entrypoint and
// aborts startup with: "Incorrect type for map entry 'BOOKS_SYNC_CRON': the
// provided value is not of type 'function or ExportedHandler'."
//
// Pointing wrangler's `main` at this thin entry keeps the entry module's exports
// to just the default handler; src/index.ts becomes an ordinary imported module,
// so its named exports stay available to the tests without reaching workerd's
// entrypoint validation.
import worker from "./index";
export default worker;
