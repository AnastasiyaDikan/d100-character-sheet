import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function loadFeedback() {
  const entry = `export * from ${JSON.stringify(new URL("../lib/character/feedback.ts", import.meta.url).pathname)};`;
  const result = await build({ stdin: { contents: entry, loader: "ts", resolveDir: process.cwd() }, bundle: true, platform: "node", format: "esm", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("accepts only complete feedback and creates a sortable subject", async () => {
  const rules = await loadFeedback();
  const feedback = rules.parseFeedbackRequest({ sender: "  Лиза  ", kind: "Ошибка", description: "  Кнопка не открывается  ", version: "0.17.1" });
  assert.equal(feedback.sender, "Лиза");
  assert.equal(feedback.description, "Кнопка не открывается");
  assert.equal(rules.feedbackEmailPayload(feedback)._subject, "[Чарник D100][Ошибка] Лиза");
  assert.equal(rules.parseFeedbackRequest({ sender: "Я", kind: "Другое", description: "Слишком коротко" }), null);
});

test("reads FormSubmit string flags and explains one-time activation", async () => {
  const rules = await loadFeedback();
  assert.deepEqual(rules.feedbackProviderResult({ success: "true", message: "Thanks" }, true), {
    ok: true,
    activationRequired: false,
    message: "Thanks",
  });
  const activation = rules.feedbackProviderResult({
    success: "false",
    message: "This form needs Activation. We've sent you an email containing an Activate Form link.",
  }, true);
  assert.equal(activation.ok, false);
  assert.equal(activation.activationRequired, true);
  assert.match(rules.feedbackProviderErrorText(activation), /Nastych@mail\.ru/);
  assert.match(rules.feedbackProviderErrorText(activation), /Activate Form/);
});
