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

test("proxies feedback through the same-origin API instead of browser-side FormSubmit", async () => {
  const { POST } = await loadRoute();
  const originalFetch = globalThis.fetch;
  let providerCall;
  globalThis.fetch = async (url, options) => {
    providerCall = { url: String(url), options };
    return Response.json({ success: "true", message: "Thanks" });
  };
  try {
    const response = await POST(new Request("https://d100-character-sheet.nastych.workers.dev/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: "Марк",
        kind: "Предложение",
        description: "Добавить удобное переключение оружия в боевых действиях.",
        version: "0.19.2",
        page: "https://d100-character-sheet.nastych.workers.dev/",
      }),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(providerCall.url, "https://formsubmit.co/ajax/Nastych@mail.ru");
    assert.equal(providerCall.options.headers.Origin, "https://d100-character-sheet.nastych.workers.dev");
    const payload = JSON.parse(providerCall.options.body);
    assert.equal(payload["Имя отправителя"], "Марк");
    assert.equal(payload["Тип сообщения"], "Предложение");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

