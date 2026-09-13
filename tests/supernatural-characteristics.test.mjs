import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function loadRules() {
  const entry = `
    export { createCharacter, RACES } from ${JSON.stringify(new URL("../lib/character/data.ts", import.meta.url).pathname)};
    export { applyRace, calculateNaturalArmor, calculateRaceWounds } from ${JSON.stringify(new URL("../lib/character/race-engine.ts", import.meta.url).pathname)};
    export { carrying, effectiveBonus, fatigueThreshold, movement, skillThreshold, supernaturalMultiplier, zoneDefense } from ${JSON.stringify(new URL("../lib/character/calculations.ts", import.meta.url).pathname)};
  `;
  const result = await build({ stdin: { contents: entry, loader: "ts", resolveDir: process.cwd() }, bundle: true, platform: "node", format: "esm", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

function talent(name, properties = "") {
  return { id: name, name, properties, requirements: "—", source: "talent" };
}

test("multiplies all secondary values derived from supernatural endurance", async () => {
  const rules = await loadRules();
  const race = rules.RACES.find((item) => item.id === "human");
  const base = rules.applyRace(rules.createCharacter(), race, {});
  const character = {
    ...base,
    characteristics: {
      ...base.characteristics,
      strength: { ...base.characteristics.strength, value: 30 },
      endurance: { ...base.characteristics.endurance, value: 40 },
      willpower: { ...base.characteristics.willpower, value: 30 },
    },
    talents: [talent("Сверхчеловеческая Выносливость/Телосложение (3)")],
    skills: [...base.skills, { id: "endurance-test", label: "Стойкость", characteristic: "endurance", level: 1 }],
  };

  assert.equal(rules.supernaturalMultiplier(character, "endurance"), 3);
  assert.equal(rules.effectiveBonus(character, "endurance"), 12);
  assert.equal(rules.calculateRaceWounds(character, race), 30);
  assert.equal(rules.zoneDefense(character, "body"), 12);
  assert.equal(rules.fatigueThreshold(character), 15);
  assert.deepEqual(rules.carrying(character), { index: 15, carry: 450, lift: 900, push: 1800 });
  assert.equal(rules.skillThreshold(character, "endurance-test"), 52);
});

test("recognizes misspelling and grouped supernatural characteristics", async () => {
  const rules = await loadRules();
  const race = rules.RACES.find((item) => item.id === "human");
  const base = rules.applyRace(rules.createCharacter(), race, {});
  const character = {
    ...base,
    characteristics: {
      ...base.characteristics,
      agility: { ...base.characteristics.agility, value: 30 },
      strength: { ...base.characteristics.strength, value: 30 },
      endurance: { ...base.characteristics.endurance, value: 30 },
    },
    talents: [
      talent("Сверхестественная ловкость (2)"),
      talent("Дар великана", "Сверхъестественная сила и выносливость (2)."),
    ],
  };

  assert.equal(rules.effectiveBonus(character, "strength"), 6);
  assert.equal(rules.effectiveBonus(character, "endurance"), 6);
  assert.deepEqual(rules.movement(character), { free: 6, halfAction: 12, charge: 18, run: 36 });
});

test("uses the greatest supernatural multiplier instead of stacking talents", async () => {
  const rules = await loadRules();
  const race = rules.RACES.find((item) => item.id === "human");
  const base = rules.applyRace(rules.createCharacter(), race, {});
  const character = {
    ...base,
    talents: [talent("Сверхъестественная сила (2)"), talent("Сверхъестественная сила (4)")],
  };
  assert.equal(rules.supernaturalMultiplier(character, "strength"), 4);
});
