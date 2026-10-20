// Cloudflare Pages Function: every request under /api/ is handled by server/api.js.
import { handle } from '../../server/api.js';

export const onRequest = (context) => handle(context.request, context.env);
