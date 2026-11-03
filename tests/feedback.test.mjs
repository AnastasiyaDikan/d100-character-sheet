import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function loadFeedback() {
  const entry = `export * from ${JSON.stringify(new URL("../lib/character/feedback.ts", import.meta.url).pathname)};`;
  const result = await build({ stdin: { contents: entry, loader: "ts", resolveDir: process.cwd() }, bundle: true, platform: "node", format: "esm", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("accepts only complete feedback and creates a safe Discord card", async () => {
  const rules = await loadFeedback();
  const feedback = rules.parseFeedbackRequest({ sender: "  Лиза  ", kind: "Ошибка", description: "  Кнопка не открывается  ", version: "0.19.3", page: "https://example.test/" });
  assert.equal(feedback.sender, "Лиза");
  assert.equal(feedback.description, "Кнопка не открывается");
  const payload = rules.feedbackDiscordPayload(feedback);
  assert.equal(payload.embeds[0].title, "Ошибка в чарнике");
  assert.equal(payload.embeds[0].description, "Кнопка не открывается");
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
  assert.equal(payload.embeds[0].fields[0].value, "Лиза");
  assert.equal(payload.embeds[0].fields[1].value, "0.19.3");
  assert.equal(rules.parseFeedbackRequest({ sender: "Я", kind: "Другое", description: "Слишком коротко" }), null);
});

test("uses a different card title and color for suggestions", async () => {
  const rules = await loadFeedback();
  const payload = rules.feedbackDiscordPayload({ sender: "Марк", kind: "Предложение", description: "Добавить переключение оружия." });
  assert.equal(payload.embeds[0].title, "Предложение для чарника");
  assert.equal(payload.embeds[0].color, 0x3f6f8f);
});
