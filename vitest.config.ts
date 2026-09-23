import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
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
