import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        singleWorker: true,
        wrangler: { configPath: "./wrangler.jsonc" },
        // Test-only R2 bucket so the document-storage R2 path is exercised
        // (production wrangler.jsonc keeps the binding commented until provisioned).
        miniflare: { r2Buckets: ["DOCS"] },
      },
    },
  },
});
