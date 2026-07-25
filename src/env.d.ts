// Optional R2 bucket for document storage (#9). When the DOCS bucket is bound,
// vendor / delivery-challan document blobs are stored in R2 instead of as base64
// in D1 (which bloats rows and read cost). When it is NOT bound, the app falls
// back to the original base64-in-D1 behaviour, so this is safe to ship unbound.
//
// To enable: create a bucket and add the binding in wrangler.jsonc (see the
// commented "r2_buckets" block there), then `wrangler types`.
declare global {
  interface Env {
    DOCS?: R2Bucket;
  }
}

export {};
