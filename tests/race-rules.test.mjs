import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function loadRaceRules() {
  const entry = `
    export { createCharacter, RACES } from ${JSON.stringify(new URL("../lib/character/data.ts", import.meta.url).pathname)};
    export { applyAptitudeCharacteristics, applyRace, beginIndependentAptitudeDistribution, calculateNaturalArmor, calculateRaceWounds, independentAptitudeBudget } from ${JSON.stringify(new URL("../lib/character/race-engine.ts", import.meta.url).pathname)};
  `;
  const result = await build({ stdin: { contents: entry, loader: "ts", resolveDir: process.cwd() }, bundle: true, platform: "node", format: "esm", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("applies fixed and free human aptitudes to 15/20/25 characteristics", async () => {
  const { applyRace, createCharacter, RACES } = await loadRaceRules();
  const humanRace = RACES.find((race) => race.id === "human");
  const human = applyRace(createCharacter(), humanRace, {});
  assert.equal(Object.values(human.aptitudes).reduce((sum, value) => sum + value, 0), 9);
  assert.equal(humanRace.aptitudeBudget, 11);
  assert.ok(Object.values(human.characteristics).every((item) => item.value === 20));
  assert.deepEqual(human.aptitudes, human.racialAptitudes);
});

test("applies infernal heritage stats, armor, traits and wound formula", async () => {
  const { applyRace, calculateRaceWounds, createCharacter, RACES } = await loadRaceRules();
  const race = RACES.find((item) => item.id === "infernal-tiefling");
  const dispatер = applyRace(createCharacter(), race, { archdevil: "Диспатер" });
  assert.equal(dispatер.naturalArmor, 5);
  assert.equal(dispatер.corruption, null);
  assert.ok(dispatер.talents.some((item) => item.name === "Адское зрение"));
  assert.ok(dispatер.talents.some((item) => item.name === "Наследие Диспатера"));
  const characteristics = {
    ...dispatер.characteristics,
    strength: { ...dispatер.characteristics.strength, value: 30 },
    endurance: { ...dispatер.characteristics.endurance, value: 55 },
    willpower: { ...dispatер.characteristics.willpower, value: 30 },
  };
  assert.equal(calculateRaceWounds({ ...dispatер, characteristics }, race), 19);

  const mephistopheles = applyRace(createCharacter(), race, { archdevil: "Мефистофель" });
  assert.equal(mephistopheles.characteristics.intelligence.value, 45);
});

test("keeps every fixed aptitude set inside its race budget", async () => {
  const { RACES } = await loadRaceRules();
  for (const race of RACES) {
    const fixed = Object.values(race.aptitudes).reduce((sum, value) => sum + (value ?? 0), 0);
    assert.ok(fixed <= race.aptitudeBudget, `${race.name}: ${fixed}/${race.aptitudeBudget}`);
  }
});

test("calculates Berendei natural armor from endurance bonus", async () => {
  const { applyRace, calculateNaturalArmor, createCharacter, RACES } = await loadRaceRules();
  const race = RACES.find((item) => item.id === "berendei");
  const berendei = applyRace(createCharacter(), race, {});
  const character = { ...berendei, characteristics: { ...berendei.characteristics, endurance: { ...berendei.characteristics.endurance, value: 55 } } };
  assert.equal(calculateNaturalArmor(character, race), 8);
});

test("recalculates starting characteristics after manual aptitude distribution", async () => {
  const { applyAptitudeCharacteristics, applyRace, beginIndependentAptitudeDistribution, createCharacter, independentAptitudeBudget, RACES } = await loadRaceRules();
  const race = RACES.find((item) => item.id === "green-orc");
  const orc = applyRace(createCharacter(), race, {});
  assert.equal(orc.characteristics.agility.value, 25);
  assert.equal(orc.characteristics.intelligence.value, 15);
  const cleared = beginIndependentAptitudeDistribution(orc);
  assert.equal(Object.values(cleared.aptitudes).reduce((sum, value) => sum + value, 0), 0);
  assert.equal(independentAptitudeBudget(race), 10);
  const redistributed = {
    ...cleared,
    aptitudes: { ...orc.aptitudes, agility: 0, intelligence: 1 },
  };
  assert.equal(Object.values(redistributed.aptitudes).reduce((sum, value) => sum + value, 0), race.aptitudeBudget - 1);
  const applied = applyAptitudeCharacteristics(redistributed, race);
  assert.equal(applied.characteristics.agility.value, 15);
  assert.equal(applied.characteristics.intelligence.value, 20);
  assert.deepEqual(applied.appliedAptitudes, redistributed.aptitudes);
});
