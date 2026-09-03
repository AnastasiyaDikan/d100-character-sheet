import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const catalogPath = fileURLToPath(new URL("../lib/character/talents.json", import.meta.url));
const snapshot = JSON.parse(await readFile(catalogPath, "utf8"));

test("ships a complete local talent catalog", () => {
  assert.equal(snapshot.talents.length, 250);
  assert.ok(snapshot.talents.every((talent) => talent.properties.length > 0));
  assert.ok(snapshot.talents.every((talent) => !/Rogue Trader|DeathWatch|Imperium Maledictum/i.test(talent.lineages)));
});

test("contains the full Jaded talent card", () => {
  const talent = snapshot.talents.find((item) => item.name.toLocaleLowerCase("ru").replace(/ё/g, "е") === "искушенный");
  assert.ok(talent);
  assert.match(talent.properties, /повидали столько зла/i);
  assert.match(talent.requirements, /Сила воли\s*30/i);
});
