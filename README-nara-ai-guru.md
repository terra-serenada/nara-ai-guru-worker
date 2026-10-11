# Nara AI Guru Worker (Anoman AI)

This package deploys the `nara-ai-guru` Cloudflare Worker using Anoman AI's OpenAI-compatible API.

## Required secret

In Cloudflare Worker Settings > Variables and Secrets, create or keep a **Secret** with this exact name:

`ANOMAN_AI`

Its value must be the API key generated in your own Anoman account. Never place the key in this repository or in JavaScript source code.

## Routes

- `GET /` — health check
- `GET /models` — model list allowed for your Anoman API key
- `POST /chat` — chat completion accepting JSON such as:

```json
{
  "messages": [
    { "role": "user", "content": "Halo, perkenalkan dirimu." }
  ]
}
```

The initial default model is `gpt-4o-mini`, which is shown in the Anoman dashboard example. This does not guarantee that the model is included in the account's free allowance; check `GET /models` and the dashboard before using paid models.

## Deployment through GitHub + Cloudflare Workers Builds

1. Upload `index.js`, `wrangler.jsonc`, and `package.json` to the **root** of a new GitHub repository. Upload `README-nara-ai-guru.md` too if desired; it can be renamed to `README.md`.
2. In Cloudflare, open the existing Worker `nara-ai-guru` > Settings > Builds > Connect, then connect that repository.
3. Make sure the deployment directory/path is the repository root. Use build command `npm install` (if requested) and deploy command `npm run deploy` or `npx wrangler deploy`.
4. Check that the Worker name configured in `wrangler.jsonc` is exactly `nara-ai-guru`.
5. Keep the Cloudflare Secret named `ANOMAN_AI` in the Worker settings. Never add the secret value to GitHub.
6. After deployment, open the Worker's URL with `/` to test health, then `/models` to view models available to the API key.

## Important

The chat API currently permits browser requests only from `https://terra-serenada.github.io`. If the Terra Serenada app uses a different website origin, update `ALLOWED_ORIGINS` in `index.js` before deploying. Origin checks are a basic barrier, not full authentication or rate limiting.
