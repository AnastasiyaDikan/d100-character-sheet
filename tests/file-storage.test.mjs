import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true } });
after(async () => { await vite.close(); });

test("builds stable main and autosave JSON names", async () => {
  const { characterFileNames } = await vite.ssrLoadModule("/lib/character/file-storage.ts");
  assert.deepEqual(characterFileNames("Лиза Ашвинг"), {
    mainFileName: "Лиза Ашвинг.json",
    backupFileName: "Лиза Ашвинг.autosave.json",
  });
});

test("removes characters forbidden in Windows file names", async () => {
  const { characterFileNames } = await vite.ssrLoadModule("/lib/character/file-storage.ts");
  assert.deepEqual(characterFileNames("  Лиза: Ашвинг?  "), {
    mainFileName: "Лиза Ашвинг.json",
    backupFileName: "Лиза Ашвинг.autosave.json",
  });
  assert.equal(characterFileNames("... ").mainFileName, "character.json");
});

test("uses a twenty minute folder autosave interval", async () => {
  const { FOLDER_AUTOSAVE_INTERVAL_MS } = await vite.ssrLoadModule("/lib/character/file-storage.ts");
  assert.equal(FOLDER_AUTOSAVE_INTERVAL_MS, 1_200_000);
});
