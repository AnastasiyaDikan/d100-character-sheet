import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function loadRoute() {
  const projectRoot = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
  const entry = `export { POST } from ${JSON.stringify(`${projectRoot}/app/api/feedback/route.ts`)};`;
  const result = await build({
    stdin: { contents: entry, loader: "ts", resolveDir: projectRoot },
    alias: { "@": projectRoot },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

function feedbackRequest() {
  return new Request("https://d100-character-sheet.nastych.workers.dev/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: "Марк",
      kind: "Предложение",
      description: "Добавить удобное переключение оружия в боевых действиях.",
      version: "0.19.3",
      page: "https://d100-character-sheet.nastych.workers.dev/",
    }),
  });
}

test("delivers feedback to the secret Discord webhook", async () => {
  const { POST } = await loadRoute();
  const originalFetch = globalThis.fetch;
  const originalWebhook = process.env.FEEDBACK_DISCORD_WEBHOOK_URL;
  let discordCall;
  process.env.FEEDBACK_DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/123456789/secret_token";
  globalThis.fetch = async (url, options) => {
    discordCall = { url: String(url), options };
    return new Response(null, { status: 204 });
  };
  try {
    const response = await POST(feedbackRequest());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(discordCall.url, "https://discord.com/api/webhooks/123456789/secret_token?wait=true");
    const payload = JSON.parse(discordCall.options.body);
    assert.equal(payload.embeds[0].title, "Предложение для чарника");
    assert.equal(payload.embeds[0].fields[0].value, "Марк");
    assert.deepEqual(payload.allowed_mentions, { parse: [] });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWebhook === undefined) delete process.env.FEEDBACK_DISCORD_WEBHOOK_URL;
    else process.env.FEEDBACK_DISCORD_WEBHOOK_URL = originalWebhook;
  }
});

test("reports a missing Cloudflare secret without sending anything", async () => {
  const { POST } = await loadRoute();
  const originalFetch = globalThis.fetch;
  const originalWebhook = process.env.FEEDBACK_DISCORD_WEBHOOK_URL;
  let fetchCalled = false;
  delete process.env.FEEDBACK_DISCORD_WEBHOOK_URL;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(null, { status: 204 });
  };
  try {
    const response = await POST(feedbackRequest());
    assert.equal(response.status, 503);
    assert.equal(fetchCalled, false);
    assert.match((await response.json()).error, /не подключён/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWebhook === undefined) delete process.env.FEEDBACK_DISCORD_WEBHOOK_URL;
    else process.env.FEEDBACK_DISCORD_WEBHOOK_URL = originalWebhook;
  }
});
