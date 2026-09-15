import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function loadRules() {
  const entry = `
    export { createCharacter, RACES } from ${JSON.stringify(new URL("../lib/character/data.ts", import.meta.url).pathname)};
    export { applyRace, calculateNaturalArmor, calculateRaceWounds } from ${JSON.stringify(new URL("../lib/character/race-engine.ts", import.meta.url).pathname)};
    export { carrying, effectiveBonus, experienceCost, fatigueEffect, fatiguedCharacteristicValue, fatiguedEffectiveBonus, fatigueThreshold, movement, recordedSpentExperience, skillThreshold, spentExperience, supernaturalMultiplier, zoneDefense } from ${JSON.stringify(new URL("../lib/character/calculations.ts", import.meta.url).pathname)};
    export { COMBAT_ACTIONS, combatActionValues, selectedCombatRank } from ${JSON.stringify(new URL("../lib/character/combat.ts", import.meta.url).pathname)};
    export { normalizeCharacter } from ${JSON.stringify(new URL("../lib/character/storage.ts", import.meta.url).pathname)};
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

test("fatigue halves and then nullifies characteristics using the ordinary bonus", async () => {
  const rules = await loadRules();
  const race = rules.RACES.find((item) => item.id === "human");
  const base = rules.applyRace(rules.createCharacter(), race, {});
  const makeCharacter = (fatigueCurrent) => ({
    ...base,
    fatigueCurrent,
    characteristics: Object.fromEntries(Object.entries(base.characteristics).map(([id, item]) => [id, { ...item, value: 20 }])),
    talents: [talent("Сверхъестественная Навык рукопашной (3)")],
    skills: [...base.skills, { id: "melee-test", label: "Проверка рукопашной", characteristic: "melee", level: 1 }],
  });

  const tired = makeCharacter(2);
  assert.equal(rules.fatigueEffect(tired, "melee"), "halved");
  assert.equal(rules.fatiguedCharacteristicValue(tired, "melee"), 10);
  assert.equal(rules.fatiguedEffectiveBonus(tired, "melee"), 3);
  assert.equal(rules.skillThreshold(tired, "melee-test"), 13);
  assert.equal(rules.zoneDefense(tired, "body"), 1);
  assert.deepEqual(rules.movement(tired), { free: 1, halfAction: 2, charge: 3, run: 6 });
  assert.equal(rules.fatigueThreshold(tired), 4, "the fatigue threshold itself must not fall");
  assert.equal(rules.calculateRaceWounds(tired, race), 8, "wounds must keep using unpenalized bonuses");

  const exhausted = makeCharacter(4);
  assert.equal(rules.fatigueEffect(exhausted, "melee"), "zero");
  assert.equal(rules.fatiguedCharacteristicValue(exhausted, "melee"), 0);
  assert.equal(rules.skillThreshold(exhausted, "melee-test"), 0);
  assert.deepEqual(rules.movement(exhausted), { free: 0.5, halfAction: 1, charge: 2, run: 3 });
});

test("uses the requested experience price table and permits a manual spent total", async () => {
  const rules = await loadRules();
  assert.deepEqual([1, 2, 3, 4, 5].map((step) => rules.experienceCost(2, step)), [100, 200, 400, 800, 1600]);
  assert.deepEqual([1, 2, 3, 4, 5].map((step) => rules.experienceCost(1, step)), [250, 500, 1000, 2000, 4000]);
  assert.deepEqual([1, 2, 3, 4, 5].map((step) => rules.experienceCost(0, step)), [500, 1000, 2000, 4000, 8000]);

  const base = rules.createCharacter();
  assert.equal(rules.recordedSpentExperience(base), rules.spentExperience(base));
  assert.equal(rules.recordedSpentExperience({ ...base, experienceSpentOverride: 1375 }), 1375);
});

test("calculates combat actions from the current characteristics and saved modifiers", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const standardAttack = rules.COMBAT_ACTIONS.find((action) => action.id === "standard-attack");
  const withMelee = {
    ...base,
    characteristics: { ...base.characteristics, melee: { ...base.characteristics.melee, value: 70 } },
  };

  assert.equal(rules.combatActionValues(withMelee, standardAttack)[0].value, 77);
  const expert = { ...withMelee, combatSettings: { ...withMelee.combatSettings, expert: true } };
  assert.equal(rules.combatActionValues(expert, standardAttack)[0].value, 87);
  assert.equal(rules.combatActionValues({ ...expert, combatSettings: { ...expert.combatSettings, shoulderToShoulder: 10 } }, standardAttack)[0].value, 97);
  assert.equal(rules.combatActionValues({ ...expert, combatSettings: { ...expert.combatSettings, shoulderToShoulder: 20 } }, standardAttack)[0].value, 107);
});

test("copies parry and dodge ranks from the sheet but allows combat overrides", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const trained = {
    ...base,
    skills: base.skills.map((skill) => skill.id === "parry" ? { ...skill, level: 3 } : skill.id === "dodge" ? { ...skill, level: 2 } : skill),
  };
  assert.equal(rules.selectedCombatRank(trained, "parry"), 3);
  assert.equal(rules.selectedCombatRank(trained, "dodge"), 2);
  assert.equal(rules.selectedCombatRank({ ...trained, combatSettings: { ...trained.combatSettings, parryRank: 5 } }, "parry"), 5);
});

test("adds combat defaults to old saves and preserves valid combat choices", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const legacy = { ...base };
  delete legacy.combatSettings;
  assert.deepEqual(rules.normalizeCharacter(legacy).combatSettings, base.combatSettings);
  const configured = { ...base, combatSettings: { ...base.combatSettings, expert: true, parryRank: 5, shieldEnabled: true, shieldBonus: 12 } };
  assert.deepEqual(rules.normalizeCharacter(configured).combatSettings, configured.combatSettings);
});
