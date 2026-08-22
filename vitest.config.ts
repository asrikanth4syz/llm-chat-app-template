import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        singleWorker: true,
        // Workers AI (env.AI) is a remote-only binding. Tests never call it
        // (extraction runs with use_ai:false and the handler guards on env.AI),
        // so skip the remote proxy session that would otherwise require login.
        remoteBindings: false,
        wrangler: { configPath: "./wrangler.jsonc" },
        // Test-only R2 bucket so the document-storage R2 path is exercised
        // (production wrangler.jsonc keeps the binding commented until provisioned).
        miniflare: { r2Buckets: ["DOCS"] },
      },
    },
  },
});
