// Tells the rest of the backend whether it is running under Node (local dev)
// or inside a Cloudflare Worker, and exposes the Worker's bindings
// (HYPERDRIVE, UPLOADS). src/worker.mjs stores them on globalThis before the
// app handles any request.
const isWorker =
  typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

function cfEnv() {
  return globalThis.__ARTISOUL_CF_ENV || {};
}

module.exports = { isWorker, cfEnv };
