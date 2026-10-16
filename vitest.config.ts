import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    // Integration suites make many sequential HTTP round-trips per test against a
    // single shared worker runtime; deep into a full run the default 5s ceiling is
    // too tight (a timeout mid-test also corrupts the pool's isolated-storage stack).
    testTimeout: 30000,
    hookTimeout: 60000,
    poolOptions: {
      workers: {
        singleWorker: true,
        // Test-only config: mirrors wrangler.jsonc but omits the Workers AI
        // binding, which the pool would otherwise provision via a remote proxy
        // that needs an interactive login (breaking offline/CI test runs).
        wrangler: { configPath: "./wrangler.test.jsonc" },
        // Test-only R2 bucket so the document-storage R2 path is exercised
        // (production wrangler.jsonc keeps the binding commented until provisioned).
        miniflare: { r2Buckets: ["DOCS"] },
      },
    },
  },
});
