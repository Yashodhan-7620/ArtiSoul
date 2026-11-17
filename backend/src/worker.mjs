// Cloudflare Workers entry point (used by `wrangler dev` / `wrangler deploy`,
// see wrangler.jsonc in the repo root). Local `npm run dev` still uses
// server.js and never loads this file.
//
// The built React app is served as static assets by Cloudflare itself; only
// /api/* and /uploads/* reach this Worker, where the unchanged Express app
// handles them through Cloudflare's Node.js HTTP server compatibility.
import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import app from './app.js';

// Bindings (HYPERDRIVE, UPLOADS) for config/db.js and utils/storage.js.
// Plain vars and secrets (JWT_SECRET, TEST_KEY_ID, …) arrive in process.env.
globalThis.__ARTISOUL_CF_ENV = env;

const PORT = 8787;
app.listen(PORT);

export default httpServerHandler({ port: PORT });
