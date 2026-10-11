/**
 * Terra Serenada - Nara AI Guru Worker
 * Provider: Anoman AI (OpenAI-compatible API)
 * Required Cloudflare secret: ANOMAN_AI
 * Default model: gpt-4o-mini (change only after checking the Anoman model catalog)
 *
 * Routes:
 *   GET  /        Health check
 *   GET  /models  List models available to this Anoman API key
 *   POST /chat    Chat completion; JSON body: { "messages": [{"role":"user","content":"..."}] }
 */

const ANOMAN_BASE_URL = "https://api.anoman.io/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const ALLOWED_ORIGINS = new Set([
  "https://terra-serenada.github.io",
]);
const MAX_BODY_BYTES = 32 * 1024;
const MAX_MESSAGES = 40;
const MAX_TOKENS = 800;

function corsHeaders(origin) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return headers;
}

function jsonResponse(data, status = 200, origin = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  });
}

function getOrigin(request) {
  return request.headers.get("Origin");
}

function originAllowedForApi(request) {
  const origin = getOrigin(request);
  // Browser calls from the GitHub Pages app are allowed. Reject other or missing
  // origins on API routes; this is a basic barrier, not a substitute for rate limits.
  return Boolean(origin && ALLOWED_ORIGINS.has(origin));
}

async function anomanFetch(path, env, init = {}, origin = null) {
  if (!env.ANOMAN_AI) {
    return jsonResponse({
      error: "Secret ANOMAN_AI belum disetel di Cloudflare Worker.",
    }, 500, origin);
  }

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${env.ANOMAN_AI}`);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  let upstream;
  try {
    upstream = await fetch(`${ANOMAN_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch (_error) {
    return jsonResponse({ error: "Tidak dapat terhubung ke layanan Anoman AI." }, 502, origin);
  }

  const responseText = await upstream.text();
  let responseBody;
  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch (_error) {
    responseBody = { error: "Layanan Anoman mengembalikan respons yang tidak dikenali." };
  }

  return new Response(JSON.stringify(responseBody), {
    status: upstream.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...Object.fromEntries(corsHeaders(origin).entries()),
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = getOrigin(request);

    if (request.method === "OPTIONS") {
      if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        return jsonResponse({ error: "Origin tidak diizinkan." }, 403, origin);
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return jsonResponse({
        ok: true,
        service: "Terra Serenada - Nara AI Guru",
        provider: "Anoman AI",
        defaultModel: DEFAULT_MODEL,
        routes: ["GET /models", "POST /chat"],
      }, 200, origin);
    }

    if (request.method === "GET" && url.pathname === "/models") {
      return anomanFetch("/models", env, { method: "GET" }, origin);
    }

    if (request.method === "POST" && url.pathname === "/chat") {
      if (!originAllowedForApi(request)) {
        return jsonResponse({ error: "Origin tidak diizinkan untuk endpoint chat." }, 403, origin);
      }

      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
        return jsonResponse({ error: "Permintaan terlalu besar." }, 413, origin);
      }

      let body;
      try {
        body = JSON.parse(rawBody);
      } catch (_error) {
        return jsonResponse({ error: "Body harus berupa JSON yang valid." }, 400, origin);
      }

      if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
        return jsonResponse({ error: "Isi permintaan wajib memiliki array messages." }, 400, origin);
      }
      if (body.messages.length > MAX_MESSAGES) {
        return jsonResponse({ error: `Maksimal ${MAX_MESSAGES} pesan per permintaan.` }, 400, origin);
      }

      for (const message of body.messages) {
        if (!message || !["system", "user", "assistant"].includes(message.role) ||
            !(typeof message.content === "string" || Array.isArray(message.content))) {
          return jsonResponse({ error: "Format salah pada salah satu pesan." }, 400, origin);
        }
      }

      const payload = {
        model: DEFAULT_MODEL,
        messages: body.messages,
        temperature: typeof body.temperature === "number"
          ? Math.max(0, Math.min(1, body.temperature))
          : 0.3,
        max_tokens: MAX_TOKENS,
        stream: false,
      };

      const upstreamResponse = await anomanFetch("/chat/completions", env, {
        method: "POST",
        body: JSON.stringify(payload),
      }, origin);

      // Add CORS for the approved app origin while preserving the upstream status/body.
      const headers = new Headers(upstreamResponse.headers);
      const allowedHeaders = corsHeaders(origin);
      for (const [key, value] of allowedHeaders.entries()) headers.set(key, value);
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers,
      });
    }

    return jsonResponse({ error: "Rute tidak ditemukan." }, 404, origin);
  },
};
