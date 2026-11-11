import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function loadRules() {
  const entry = `
    export { createCharacter, RACES } from ${JSON.stringify(new URL("../lib/character/data.ts", import.meta.url).pathname)};
    export { applyRace, calculateNaturalArmor, calculateRaceWounds } from ${JSON.stringify(new URL("../lib/character/race-engine.ts", import.meta.url).pathname)};
    export { adjustedCharacteristicValue, adjustedEffectiveBonus, characteristicBaseValue, characteristicCheckValue, characteristicTrainingBonus, characteristicValue, carrying, effectiveBonus, experienceCost, fatigueEffect, fatiguedCharacteristicValue, fatiguedEffectiveBonus, fatigueThreshold, movement, recordedSpentExperience, skillBaseThreshold, skillEffectiveLevel, skillModifier, skillThreshold, skillTrainingBonus, spentExperience, supernaturalBonus, supernaturalMultiplier, zoneDefense } from ${JSON.stringify(new URL("../lib/character/calculations.ts", import.meta.url).pathname)};
    export { COMBAT_ACTIONS, combatActionAvailable, combatActionRollsHitLocation, combatActionValues, combatAttackCount, selectedCombatRank } from ${JSON.stringify(new URL("../lib/character/combat.ts", import.meta.url).pathname)};
    export { activeCombatWeapon, rollCombatStrikes, selectCombatWeapon } from ${JSON.stringify(new URL("../lib/character/combat-roll.ts", import.meta.url).pathname)};
    export { normalizeCharacter } from ${JSON.stringify(new URL("../lib/character/storage.ts", import.meta.url).pathname)};
    export { DICE_SIDES, rollDie } from ${JSON.stringify(new URL("../lib/character/dice.ts", import.meta.url).pathname)};
    export { discordMessagePayload, parseDiscordWebhookUrl, validDiscordRoll } from ${JSON.stringify(new URL("../lib/character/discord.ts", import.meta.url).pathname)};
    export { evaluateSkillCheck } from ${JSON.stringify(new URL("../lib/character/skill-check.ts", import.meta.url).pathname)};
    export { specializationCharacteristic } from ${JSON.stringify(new URL("../lib/character/skills.ts", import.meta.url).pathname)};
    export { hitLocationForRoll, hitLocationAccusative } from ${JSON.stringify(new URL("../lib/character/hit-location.ts", import.meta.url).pathname)};
    export { hasLightningReflexes, hasParanoia, initiativeModifier } from ${JSON.stringify(new URL("../lib/character/initiative.ts", import.meta.url).pathname)};
    export { parseDamageExpression, parseWeaponDamage, rollWeaponDamage, rollWeaponDamageWithCriticalCount, selectedWeaponDamage, weaponDamageModes, weaponExplosionRank } from ${JSON.stringify(new URL("../lib/character/weapon-damage.ts", import.meta.url).pathname)};
    export { applyTrainingProgress, normalizeTrainingState, TRAINING_GOAL } from ${JSON.stringify(new URL("../lib/character/training.ts", import.meta.url).pathname)};
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
    talents: [talent("Сверхчеловеческая Выносливость/Телосложение (x3)")],
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

  assert.equal(rules.effectiveBonus(character, "strength"), 5);
  assert.equal(rules.effectiveBonus(character, "endurance"), 5);
  assert.deepEqual(rules.movement(character), { free: 5, halfAction: 10, charge: 15, run: 30 });
});

test("uses the greatest supernatural multiplier instead of stacking talents", async () => {
  const rules = await loadRules();
  const race = rules.RACES.find((item) => item.id === "human");
  const base = rules.applyRace(rules.createCharacter(), race, {});
  const character = {
    ...base,
    talents: [talent("Сверхъестественная сила (x2)"), talent("Сверхъестественная сила (×4)")],
  };
  assert.equal(rules.supernaturalMultiplier(character, "strength"), 4);
});

test("treats a plain supernatural value as addition and x as multiplication", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const strength40 = { ...base, characteristics: { ...base.characteristics, strength: { ...base.characteristics.strength, value: 40 } } };
  const additive = { ...strength40, talents: [talent("Сверхъестественная сила (3)")] };
  const multiplied = { ...strength40, talents: [talent("Сверхъестественная сила (x3)")] };
  assert.equal(rules.supernaturalBonus(additive, "strength"), 3);
  assert.equal(rules.supernaturalMultiplier(additive, "strength"), 1);
  assert.equal(rules.effectiveBonus(additive, "strength"), 7);
  assert.equal(rules.supernaturalBonus(multiplied, "strength"), 0);
  assert.equal(rules.supernaturalMultiplier(multiplied, "strength"), 3);
  assert.equal(rules.effectiveBonus(multiplied, "strength"), 12);
});

test("configures Supernatural Sense for any selected characteristic", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const perception40 = { ...base, characteristics: { ...base.characteristics, perception: { ...base.characteristics.perception, value: 40 } } };
  assert.equal(rules.supernaturalBonus({ ...perception40, talents: [talent("Сверхъестественное чувство: Восприятие (3)")] }, "perception"), 3);
  assert.equal(rules.supernaturalMultiplier({ ...perception40, talents: [talent("Сверхъестественное чувство: Восприятие (x3)")] }, "perception"), 3);
});

test("applies temporary buffs and debuffs downstream but not to wounds", async () => {
  const rules = await loadRules();
  const race = rules.RACES.find((item) => item.id === "human");
  const base = rules.applyRace(rules.createCharacter(), race, {});
  const character = {
    ...base,
    characteristics: {
      ...base.characteristics,
      melee: { ...base.characteristics.melee, value: 40 },
      agility: { ...base.characteristics.agility, value: 40 },
      endurance: { ...base.characteristics.endurance, value: 40 },
      strength: { ...base.characteristics.strength, value: 30 },
      willpower: { ...base.characteristics.willpower, value: 30 },
    },
    characteristicAdjustments: { ...base.characteristicAdjustments, melee: -20, agility: 30, endurance: -20 },
    skills: [...base.skills, { id: "melee-check", label: "Проверка НР", characteristic: "melee", level: 1 }],
  };
  const standard = rules.COMBAT_ACTIONS.find((action) => action.id === "standard-attack");
  assert.equal(rules.adjustedCharacteristicValue(character, "melee"), 20);
  assert.equal(rules.characteristicCheckValue(character, "melee"), 24);
  assert.equal(rules.skillThreshold(character, "melee-check"), 24);
  assert.equal(rules.combatActionValues(character, standard)[0].value, 34);
  assert.equal(rules.zoneDefense(character, "body"), 2);
  assert.deepEqual(rules.movement(character), { free: 7, halfAction: 14, charge: 21, run: 42 });
  assert.equal(rules.calculateRaceWounds(character, race), rules.calculateRaceWounds({ ...character, characteristicAdjustments: base.characteristicAdjustments }, race), "temporary effects must not change wounds");
});

test("rolls initiative from adjusted agility and doubles it for Lightning Reflexes", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const character = {
    ...base,
    characteristics: { ...base.characteristics, agility: { ...base.characteristics.agility, value: 40 } },
    characteristicAdjustments: { ...base.characteristicAdjustments, agility: 20 },
  };
  assert.equal(rules.initiativeModifier(character), 6);
  const withTalent = { ...character, talents: [talent("Молниеносные Рефлексы")] };
  assert.equal(rules.hasLightningReflexes(withTalent), true);
  assert.equal(rules.initiativeModifier(withTalent), 12);
  const withParanoia = { ...character, talents: [talent("Паранойя")] };
  assert.equal(rules.hasParanoia(withParanoia), true);
  assert.equal(rules.initiativeModifier(withParanoia), 8, "Paranoia adds +2 after the agility modifier");
  assert.equal(rules.initiativeModifier({ ...character, talents: [talent("Молниеносные Рефлексы"), talent("Паранойя")] }), 14);
});

test("fatigue compares tens against the full characteristic before halving or nullifying it", async () => {
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
  assert.equal(rules.fatiguedEffectiveBonus(tired, "melee"), 4);
  assert.equal(rules.skillThreshold(tired, "melee-test"), 15);
  assert.equal(rules.zoneDefense(tired, "body"), 1);
  assert.deepEqual(rules.movement(tired), { free: 1, halfAction: 2, charge: 3, run: 6 });
  assert.equal(rules.fatigueThreshold(tired), 4, "the fatigue threshold itself must not fall");
  assert.equal(rules.calculateRaceWounds(tired, race), 8, "wounds must keep using unpenalized bonuses");

  const exhausted = makeCharacter(4);
  assert.equal(rules.fatigueEffect(exhausted, "melee"), "zero");
  assert.equal(rules.fatiguedCharacteristicValue(exhausted, "melee"), 0);
  assert.equal(rules.skillThreshold(exhausted, "melee-test"), 5, "a zeroed value still keeps its original supernatural modifier");
  assert.deepEqual(rules.movement(exhausted), { free: 0.5, halfAction: 1, charge: 2, run: 3 });

  const remainderMatters = {
    ...makeCharacter(3),
    characteristics: Object.fromEntries(Object.entries(base.characteristics).map(([id, item]) => [id, { ...item, value: 35 }])),
  };
  assert.equal(rules.fatigueEffect(remainderMatters, "perception"), "none", "fatigue 3 must not halve a value of 35");
  assert.equal(rules.fatigueEffect({ ...remainderMatters, fatigueCurrent: 4 }, "perception"), "halved");
  assert.equal(rules.fatigueEffect({ ...remainderMatters, fatigueCurrent: 7 }, "perception"), "zero");

  const originalModifier = {
    ...remainderMatters,
    fatigueCurrent: 4,
    talents: [],
  };
  assert.equal(rules.fatiguedCharacteristicValue(originalModifier, "perception"), 17);
  assert.equal(rules.characteristicCheckValue(originalModifier, "perception"), 20, "17 after fatigue still uses the original +3 bonus");
  assert.equal(rules.adjustedEffectiveBonus(originalModifier, "perception"), 1, "derived values still react to the reduced characteristic");
});

test("applies every modeled Frenzy effect only when the talent is present and enabled", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const characteristics = {
    ...base.characteristics,
    melee: { ...base.characteristics.melee, value: 40 },
    strength: { ...base.characteristics.strength, value: 30 },
    endurance: { ...base.characteristics.endurance, value: 40 },
    willpower: { ...base.characteristics.willpower, value: 30 },
    shooting: { ...base.characteristics.shooting, value: 50 },
    intelligence: { ...base.characteristics.intelligence, value: 50 },
  };
  const toggledWithoutTalent = { ...base, fatigueCurrent: 4, characteristics, combatSettings: { ...base.combatSettings, frenzy: true } };
  assert.equal(rules.fatigueEffect(toggledWithoutTalent, "melee"), "halved", "the checkbox alone must not grant the talent");
  assert.equal(rules.adjustedCharacteristicValue(toggledWithoutTalent, "strength"), 15);

  const active = { ...toggledWithoutTalent, talents: [talent("Неистовство")] };
  assert.equal(rules.fatigueEffect(active, "melee"), "none", "Frenzy ignores fatigue effects");
  assert.equal(rules.adjustedCharacteristicValue(active, "melee"), 50);
  assert.equal(rules.adjustedCharacteristicValue(active, "strength"), 40);
  assert.equal(rules.adjustedCharacteristicValue(active, "endurance"), 50);
  assert.equal(rules.adjustedCharacteristicValue(active, "willpower"), 40);
  assert.equal(rules.adjustedCharacteristicValue(active, "shooting"), 30);
  assert.equal(rules.adjustedCharacteristicValue(active, "intelligence"), 30);

  const standard = rules.COMBAT_ACTIONS.find((action) => action.id === "standard-attack");
  assert.deepEqual(rules.combatActionValues(active, standard).map((item) => item.value), [64, 45]);
  assert.match(rules.combatActionValues(active, standard)[0].explanation, /Неистовство \+10/);
  for (const id of ["parry-weapon", "parry-shield", "disengage"]) {
    const value = rules.combatActionValues(active, rules.COMBAT_ACTIONS.find((action) => action.id === id))[0];
    assert.equal(value.value, null);
    assert.match(value.explanation, /Неистовство/);
  }
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

  assert.equal(rules.combatActionValues(withMelee, standardAttack)[0].value, 87);
  const expert = { ...withMelee, combatSettings: { ...withMelee.combatSettings, expert: true } };
  assert.equal(rules.combatActionValues(expert, standardAttack)[0].value, 97);
  assert.equal(rules.combatActionValues({ ...expert, combatSettings: { ...expert.combatSettings, shoulderToShoulder: 10 } }, standardAttack)[0].value, 107);
  assert.equal(rules.combatActionValues({ ...expert, combatSettings: { ...expert.combatSettings, shoulderToShoulder: 20 } }, standardAttack)[0].value, 117);

  const allOut = rules.COMBAT_ACTIONS.find((action) => action.id === "all-out-attack");
  const charge = rules.COMBAT_ACTIONS.find((action) => action.id === "charge");
  const knockDown = rules.COMBAT_ACTIONS.find((action) => action.id === "knock-down");
  const withSixtyMelee = { ...base, characteristics: { ...base.characteristics, melee: { ...base.characteristics.melee, value: 60 } } };
  assert.equal(rules.combatActionValues(withMelee, allOut)[0].value, 107);
  assert.equal(rules.combatActionValues(withMelee, charge)[0].value, 97, "charge adds its base +20");
  assert.equal(rules.combatActionValues({ ...withMelee, combatSettings: { ...withMelee.combatSettings, berserkerCharge: true } }, charge)[0].value, 107, "Berserker Charge replaces +20 with +30");
  assert.equal(rules.combatActionValues(withSixtyMelee, charge)[0].value, 86, "NR 60 + modifier 6 + charge 20");
  assert.equal(rules.combatActionValues({ ...withSixtyMelee, combatSettings: { ...withSixtyMelee.combatSettings, berserkerCharge: true } }, charge)[0].value, 96);
  assert.equal(rules.combatActionValues(base, knockDown)[0].value, 32);
  assert.equal(rules.combatActionValues({ ...withMelee, combatSettings: { ...withMelee.combatSettings, aimBonus: 20 } }, standardAttack)[0].value, 107);

  const tired = {
    ...base,
    fatigueCurrent: 4,
    characteristics: { ...base.characteristics, melee: { ...base.characteristics.melee, value: 35 } },
  };
  assert.equal(rules.combatActionValues(tired, standardAttack)[0].value, 30, "17 after fatigue + original modifier 3 + standard attack 10");
});

test("shows talent-only multiattacks and calculates every strike in the series", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const rapid = rules.COMBAT_ACTIONS.find((action) => action.id === "rapid-attack");
  const lightning = rules.COMBAT_ACTIONS.find((action) => action.id === "lightning-attack");
  const weapon = {
    id: "blade", name: "Клинок", weaponClass: "Клинковое", range: "", rate: "", damage: "к6",
    damageOneHand: "к6", damageTwoHands: "", extraDamage: "", penetration: "", magazine: "", reload: "", properties: "",
    collapsed: false, active: true, damageCharacteristic: "strength", damageMode: 0,
  };
  const character = {
    ...base,
    characteristics: { ...base.characteristics, melee: { ...base.characteristics.melee, value: 70 } },
    combatSettings: { ...base.combatSettings, expert: true, frenzy: true, shoulderToShoulder: 20, weaponModifier: 10, aimBonus: 20 },
    talents: [talent("Быстрая атака"), talent("Молниеносная атака")],
    weapons: [weapon],
  };

  assert.equal(rules.combatActionAvailable(base, rapid), false);
  assert.equal(rules.combatActionAvailable(character, rapid), true);
  assert.equal(rules.combatActionAvailable(character, lightning), true);
  assert.equal(rules.combatActionValues(character, rapid)[0].value, 137, "rapid attack uses expert, shoulder, aim and weapon modifier");
  assert.equal(rules.combatActionValues(character, lightning)[0].value, 127, "lightning attack uses the same bonuses and applies its -10");

  const explanation = rules.combatActionValues(character, rapid)[0].explanation;
  assert.match(explanation, /Эксперт \+10/);
  assert.match(explanation, /Плечом к Плечу \+20/);
  assert.match(explanation, /Прицеливание \+20/);
  assert.match(explanation, /Оружие \+10/);
  assert.doesNotMatch(explanation, /Неистовство/);

  const fourSuccesses = { roll: 97, threshold: 137, passed: true, critical: null, successes: 4, failures: 0, text: "" };
  assert.equal(rules.combatAttackCount(character, rapid, fourSuccesses), 3, "base attack plus one per two successes");
  assert.equal(rules.combatAttackCount(character, lightning, fourSuccesses), 5, "base attack plus one per success");
  assert.equal(rules.combatAttackCount(character, lightning, { ...fourSuccesses, successes: 30 }), 8, "extra attacks are capped by the melee modifier");

  const locationRolls = [1, 24, 71];
  const strikes = rules.rollCombatStrikes(character, rapid, fourSuccesses, () => locationRolls.shift());
  assert.equal(strikes.length, 3);
  assert.equal(strikes.some((strike) => Object.hasOwn(strike, "damage")), false, "combat checks no longer roll damage automatically");
  assert.deepEqual(strikes.map((strike) => strike.hitLocation.location), ["Голова", "Левая рука", "Правая нога"]);
});

test("selects exactly one weapon for combat damage and preserves it in the character", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const weapons = [
    { id: "sword", name: "Меч", weaponClass: "Клинковое", range: "", rate: "", damage: "", damageOneHand: "к8", damageTwoHands: "к10", extraDamage: "", penetration: "", magazine: "", reload: "", properties: "", collapsed: false, active: false, damageCharacteristic: "strength", damageMode: 0 },
    { id: "axe", name: "Топор", weaponClass: "Рубящее", range: "", rate: "", damage: "", damageOneHand: "к10", damageTwoHands: "", extraDamage: "", penetration: "", magazine: "", reload: "", properties: "", collapsed: false, active: false, damageCharacteristic: "strength", damageMode: 0 },
  ];
  const character = { ...base, weapons };

  assert.equal(rules.activeCombatWeapon(character), null);
  const withSword = rules.selectCombatWeapon(character, "sword");
  assert.equal(rules.activeCombatWeapon(withSword).id, "sword");
  assert.deepEqual(withSword.weapons.map((weapon) => weapon.active), [true, false]);

  const withAxe = rules.selectCombatWeapon(withSword, "axe");
  assert.equal(rules.activeCombatWeapon(withAxe).id, "axe");
  assert.deepEqual(withAxe.weapons.map((weapon) => weapon.active), [false, true]);
  assert.equal(rules.selectCombatWeapon(withAxe, "missing"), withAxe);
});

test("separates weapon and shield parry modifiers", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const weaponParry = rules.COMBAT_ACTIONS.find((action) => action.id === "parry-weapon");
  const shieldParry = rules.COMBAT_ACTIONS.find((action) => action.id === "parry-shield");
  const character = {
    ...base,
    characteristics: { ...base.characteristics, melee: { ...base.characteristics.melee, value: 70 } },
    skills: base.skills.map((skill) => skill.id === "parry" ? { ...skill, level: 1 } : skill),
    combatSettings: { ...base.combatSettings, expert: true, shoulderToShoulder: 20, shieldEnabled: true, shieldBonus: 15 },
  };
  assert.equal(rules.combatActionValues(character, weaponParry)[0].value, 107);
  assert.equal(rules.combatActionValues(character, shieldParry)[0].value, 112);
});

test("adds the weapon modifier only to weapon interactions", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const character = {
    ...base,
    characteristics: { ...base.characteristics, melee: { ...base.characteristics.melee, value: 70 } },
    skills: base.skills.map((skill) => skill.id === "parry" ? { ...skill, level: 1 } : skill),
    combatSettings: { ...base.combatSettings, weaponModifier: 5, counterattack: true },
  };
  const value = (id) => rules.combatActionValues(character, rules.COMBAT_ACTIONS.find((action) => action.id === id))[0].value;
  assert.equal(value("standard-attack"), 92);
  assert.equal(value("counterattack"), 62);
  assert.equal(value("parry-weapon"), 82);
  assert.equal(value("parry-shield"), 77);
  assert.equal(value("grapple"), 77);
  assert.equal(value("knock-down"), 32);
});

test("parses dual weapon damage and adds critical dice plus the selected characteristic", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const character = {
    ...base,
    characteristics: { ...base.characteristics, agility: { ...base.characteristics.agility, value: 50 } },
  };
  const weapon = {
    id: "sword", name: "Полуторный клинок", weaponClass: "", range: "", rate: "", damage: "к8/d10+2",
    penetration: "", magazine: "", reload: "", properties: "", collapsed: false, active: true, damageCharacteristic: "agility", damageMode: 1,
  };
  assert.deepEqual(rules.weaponDamageModes(weapon.damage), ["к8", "d10+2"]);
  assert.deepEqual(rules.parseWeaponDamage("2к8+3"), { diceCount: 2, sides: 8, fixedModifier: 3 });
  assert.equal(rules.selectedWeaponDamage(weapon), "d10+2");
  const outcome = { roll: 20, threshold: 120, passed: true, critical: null, successes: 10, failures: 0, text: "" };
  const damage = rules.rollWeaponDamage(character, weapon, outcome);
  assert.equal(damage.diceCount, 3);
  assert.equal(damage.sides, 10);
  assert.equal(damage.characteristicModifier, 5);
  assert.equal(damage.fixedModifier, 2);
  assert.equal(damage.total, damage.rolls.reduce((sum, value) => sum + value, 0) + 7);
  const critical = rules.rollWeaponDamage(character, { ...weapon, damage: "d8", damageMode: 0 }, { ...outcome, roll: 1, successes: 15, critical: "success" });
  assert.equal(critical.diceCount, 5);
  assert.ok(critical.rolls.every((roll) => roll >= 1 && roll <= 8));
});

test("rolls mixed extra damage without critical dice and supports both explosion ranks", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const weapon = {
    id: "blade", name: "Эльфийский клинок", weaponClass: "Клинковое", range: "", rate: "", damage: "",
    damageOneHand: "к8", damageTwoHands: "к10", extraDamage: "к12+к10+к4",
    penetration: "", magazine: "", reload: "", properties: "", collapsed: false, active: true, damageCharacteristic: "agility", damageMode: 1,
  };
  const criticalOutcome = { roll: 20, threshold: 120, passed: true, critical: null, successes: 10, failures: 0, text: "" };
  const criticalQueue = [3, 4, 5, 6, 7, 2];
  const critical = rules.rollWeaponDamage(base, weapon, criticalOutcome, () => criticalQueue.shift());
  assert.deepEqual(rules.parseDamageExpression("к12+к10+к4"), { dice: [{ diceCount: 1, sides: 12 }, { diceCount: 1, sides: 10 }, { diceCount: 1, sides: 4 }], fixedModifier: 0 });
  assert.equal(critical.criticalDice, 2);
  assert.deepEqual(critical.rollDetails.map((roll) => roll.kind), ["main", "critical", "critical", "extra", "extra", "extra"]);

  const plainOutcome = { ...criticalOutcome, successes: 0 };
  const specialized = { ...base, talents: [talent("Специализация (Клинок)")] };
  const specializationQueue = [10, 6, 4, 3, 2];
  const specialization = rules.rollWeaponDamage(specialized, weapon, plainOutcome, () => specializationQueue.shift());
  assert.equal(specialization.explosionRank, 1);
  assert.deepEqual(specialization.rollDetails.map((roll) => [roll.kind, roll.value]), [["main", 10], ["explosion", 6], ["extra", 4], ["extra", 3], ["extra", 2]]);

  const master = { ...base, talents: [talent("Мастер (Клинок)")] };
  const masterQueue = [10, 10, 7, 4, 3, 2];
  const mastered = rules.rollWeaponDamage(master, weapon, plainOutcome, () => masterQueue.shift());
  assert.equal(mastered.explosionRank, 2);
  assert.deepEqual(mastered.rollDetails.map((roll) => [roll.kind, roll.value]), [["main", 10], ["explosion", 10], ["explosion", 7], ["extra", 4], ["extra", 3], ["extra", 2]]);
});

test("repeats the entire base weapon pool for every critical", async () => {
  const rules = await loadRules();
  const character = rules.createCharacter();
  const weapon = {
    id: "axe", name: "Тяжёлый топор", weaponClass: "Рубящее", range: "", rate: "", damage: "",
    damageOneHand: "3к8", damageTwoHands: "", extraDamage: "к4",
    penetration: "", magazine: "", reload: "", properties: "", collapsed: false, active: true, damageCharacteristic: "strength", damageMode: 0,
  };
  const outcome = { roll: 10, threshold: 150, passed: true, critical: null, successes: 14, failures: 0, text: "" };
  const queue = [1, 2, 3, 4, 5, 6, 7, 8, 1, 4];
  const damage = rules.rollWeaponDamage(character, weapon, outcome, () => queue.shift());

  assert.equal(damage.criticalDice, 6);
  assert.equal(damage.diceCount, 10);
  assert.deepEqual(damage.rollDetails.map((roll) => roll.sides), [8, 8, 8, 8, 8, 8, 8, 8, 8, 4]);
  assert.deepEqual(damage.rollDetails.map((roll) => roll.kind), ["main", "main", "main", "critical", "critical", "critical", "critical", "critical", "critical", "extra"]);

  const manualQueue = [1, 2, 3, 4, 5, 6, 7, 8, 1, 4];
  const manual = rules.rollWeaponDamageWithCriticalCount(character, weapon, 2, () => manualQueue.shift());
  assert.equal(manual.criticalCount, 2);
  assert.equal(manual.criticalDice, 6);
  assert.equal(manual.diceCount, 10);
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
  assert.equal(rules.normalizeCharacter(configured).woundsTotalOverride, null);
  const legacyCustom = { ...base, raceId: "custom", woundsTotal: 37 };
  delete legacyCustom.woundsTotalOverride;
  assert.equal(rules.normalizeCharacter(legacyCustom).woundsTotalOverride, 37);
  assert.equal(rules.normalizeCharacter({ ...base, raceId: "custom", woundsTotalOverride: null }).woundsTotalOverride, null);
  assert.equal(rules.normalizeCharacter({ ...configured, journal: "Запись в журнале" }).journal, "Запись в журнале");
  const legacyWeapon = { id: "old", name: "Старый клинок", weaponClass: "", range: "", rate: "", damage: "d8", penetration: "", magazine: "", reload: "", properties: "", collapsed: false };
  assert.deepEqual(rules.normalizeCharacter({ ...configured, weapons: [legacyWeapon] }).weapons[0], { ...legacyWeapon, damageOneHand: "d8", damageTwoHands: "", extraDamage: "", active: false, damageCharacteristic: "strength", damageMode: 0 });
});

test("turns each ten-mark training cycle into +5 characteristic or the next skill point", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const dodge = base.skills.find((skill) => skill.id === "dodge");
  assert.equal(rules.TRAINING_GOAL, 10);
  assert.equal(base.characteristics.strength.trainingProgress, null);
  assert.equal(base.characteristics.strength.trainingBonus, 0);
  assert.equal(dodge.trainingProgress, null);
  assert.equal(dodge.trainingBonus, 0);

  const legacyStrength = { ...base.characteristics.strength };
  delete legacyStrength.trainingProgress;
  const normalizedLegacy = rules.normalizeCharacter({
    ...base,
    characteristics: { ...base.characteristics, strength: legacyStrength },
    talents: [{ ...talent("Паранойя"), trainingProgress: 4, trainingGoal: 12 }],
  });
  assert.equal(normalizedLegacy.characteristics.strength.trainingProgress, null);
  assert.equal(normalizedLegacy.characteristics.strength.trainingBonus, 0);
  assert.equal(Object.hasOwn(normalizedLegacy.talents[0], "trainingProgress"), false);
  assert.equal(Object.hasOwn(normalizedLegacy.talents[0], "trainingGoal"), false);

  const saved = rules.normalizeCharacter({
    ...base,
    characteristics: { ...base.characteristics, strength: { ...base.characteristics.strength, value: 55, trainingProgress: 17, trainingBonus: 0, trainingGoal: 12 } },
    skills: base.skills.map((skill) => skill.id === "dodge" ? { ...skill, level: 2, trainingProgress: 17, trainingBonus: 0, trainingGoal: 30 } : skill),
  });
  assert.deepEqual([saved.characteristics.strength.trainingProgress, saved.characteristics.strength.trainingBonus], [7, 5]);
  assert.deepEqual([saved.skills.find((skill) => skill.id === "dodge").trainingProgress, saved.skills.find((skill) => skill.id === "dodge").trainingBonus], [7, 1]);
  assert.equal(Object.hasOwn(saved.characteristics.strength, "trainingGoal"), false);
  assert.equal(Object.hasOwn(saved.skills.find((skill) => skill.id === "dodge"), "trainingGoal"), false);
  assert.deepEqual(rules.applyTrainingProgress(0, 17, 5), { trainingProgress: 7, trainingBonus: 5 });
  assert.deepEqual(rules.applyTrainingProgress(0, 27, 1, 5), { trainingProgress: 7, trainingBonus: 2 });
  assert.equal(rules.characteristicBaseValue(saved, "strength"), 55);
  assert.equal(rules.characteristicTrainingBonus(saved, "strength"), 5);
  assert.equal(rules.characteristicValue(saved, "strength"), 60);

  const dodgeBase = rules.skillBaseThreshold(saved, "dodge");
  assert.equal(rules.skillTrainingBonus(saved, "dodge"), 1);
  assert.equal(rules.skillEffectiveLevel(saved, "dodge"), 3);
  assert.equal(rules.skillThreshold(saved, "dodge"), dodgeBase + 10);
  assert.equal(rules.selectedCombatRank(saved, "dodge"), 3);

  const removed = {
    ...saved,
    characteristics: { ...saved.characteristics, strength: { ...saved.characteristics.strength, trainingBonus: 0 } },
    skills: saved.skills.map((skill) => skill.id === "dodge" ? { ...skill, trainingBonus: 0 } : skill),
  };
  assert.equal(rules.characteristicValue(removed, "strength"), 55);
  assert.equal(rules.skillEffectiveLevel(removed, "dodge"), 2);

  const oldRevision = rules.normalizeCharacter({
    ...base,
    dataRevision: 15,
    characteristics: { ...base.characteristics, strength: { ...base.characteristics.strength, trainingBonus: 1 } },
  });
  assert.equal(oldRevision.characteristics.strength.trainingBonus, 5);

  const nearlyMaxed = rules.normalizeCharacter({
    ...base,
    skills: base.skills.map((skill) => skill.id === "dodge" ? { ...skill, level: 4, trainingProgress: 27 } : skill),
  });
  assert.equal(nearlyMaxed.skills.find((skill) => skill.id === "dodge").trainingBonus, 1);
  assert.equal(nearlyMaxed.skills.find((skill) => skill.id === "dodge").trainingProgress, 7);
});

test("prices the +40 skill rank as the first purchase", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const withAptitudes = { ...base, aptitudes: { ...base.aptitudes, agility: 2 } };
  const atThirty = { ...withAptitudes, skills: withAptitudes.skills.map((skill) => skill.id === "dodge" ? { ...skill, level: 4 } : skill) };
  const atForty = { ...withAptitudes, skills: withAptitudes.skills.map((skill) => skill.id === "dodge" ? { ...skill, level: 5 } : skill) };
  assert.equal(rules.skillModifier(5), 40);
  assert.equal(rules.skillThreshold({ ...atForty, characteristics: { ...atForty.characteristics, agility: { ...atForty.characteristics.agility, value: 30 } } }, "dodge"), 73);
  assert.equal(rules.spentExperience(atForty) - rules.spentExperience(atThirty), 100);
});

test("includes Strength-based Intimidation and adds it to old saves", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const intimidation = base.skills.find((skill) => skill.id === "intimidation");
  assert.equal(intimidation?.label, "Запугивание");
  assert.equal(intimidation?.characteristic, "strength");
  assert.equal(intimidation?.level, 0);

  const legacy = { ...base, skills: base.skills.filter((skill) => skill.id !== "intimidation") };
  const normalized = rules.normalizeCharacter(legacy);
  assert.equal(normalized.skills.find((skill) => skill.id === "intimidation")?.characteristic, "strength");
});

test("splits Navigation and Operate into ground and air skills", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const expected = [
    ["navigation-ground", "Навигация: Наземная", "intelligence"],
    ["navigation-air", "Навигация: Воздушная", "intelligence"],
    ["operate-ground", "Управление: Наземное", "agility"],
    ["operate-air", "Управление: Воздушное", "agility"],
  ];
  for (const [id, label, characteristic] of expected) {
    const skill = base.skills.find((item) => item.id === id);
    assert.equal(skill?.label, label);
    assert.equal(skill?.characteristic, characteristic);
  }
  assert.equal(base.skills.some((skill) => skill.id === "navigation" || skill.id === "operate"), false);

  const legacy = {
    ...base,
    skills: [
      ...base.skills.filter((skill) => !skill.id.startsWith("navigation-") && !skill.id.startsWith("operate-")),
      { id: "navigation", label: "Навигация", characteristic: "intelligence", level: 3 },
      { id: "operate", label: "Управление", characteristic: "agility", level: 2 },
    ],
  };
  const normalized = rules.normalizeCharacter(legacy);
  assert.equal(normalized.skills.find((skill) => skill.id === "navigation-ground")?.level, 3);
  assert.equal(normalized.skills.find((skill) => skill.id === "navigation-air")?.level, 0);
  assert.equal(normalized.skills.find((skill) => skill.id === "operate-ground")?.level, 2);
  assert.equal(normalized.skills.find((skill) => skill.id === "operate-air")?.level, 0);
  assert.equal(normalized.skills.some((skill) => skill.id === "navigation" || skill.id === "operate"), false);
});

test("lets new Trade specializations use a selected characteristic", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const trade = base.skills.find((skill) => skill.id === "trade");
  const linguistics = base.skills.find((skill) => skill.id === "linguistics");
  assert.equal(rules.specializationCharacteristic(trade, "agility"), "agility");
  assert.equal(rules.specializationCharacteristic(trade, "strength"), "strength");
  assert.equal(rules.specializationCharacteristic(linguistics, "strength"), "intelligence", "other specializations keep the parent characteristic");

  const customTrade = { id: "trade-smithing", label: "Ремесло: Кузнечное дело", characteristic: "strength", level: 2, custom: true, parentId: "trade" };
  const normalized = rules.normalizeCharacter({ ...base, skills: [...base.skills, customTrade] });
  assert.equal(normalized.skills.find((skill) => skill.id === customTrade.id)?.characteristic, "strength", "old JSON files keep the selected characteristic");
});

test("counterattack uses melee, its modifier, Expert, Shoulder to Shoulder and the -20 penalty", async () => {
  const rules = await loadRules();
  const base = rules.createCharacter();
  const counterattack = rules.COMBAT_ACTIONS.find((action) => action.id === "counterattack");
  const character = {
    ...base,
    characteristics: { ...base.characteristics, melee: { ...base.characteristics.melee, value: 70 } },
    combatSettings: { ...base.combatSettings, counterattack: true, expert: true, shoulderToShoulder: 20, frenzy: true },
  };
  assert.equal(counterattack.requiresCounterattack, true);
  assert.equal(rules.combatActionValues(character, counterattack)[0].value, 87);
});

test("rolls hit location for every attack action", async () => {
  const rules = await loadRules();
  for (const action of rules.COMBAT_ACTIONS.filter((item) => item.subtype.toLocaleLowerCase("ru").includes("атака") || item.id === "counterattack")) {
    assert.equal(rules.combatActionRollsHitLocation(action), true, action.action);
  }
  assert.equal(rules.combatActionRollsHitLocation(rules.COMBAT_ACTIONS.find((item) => item.id === "dodge")), false);
});

test("accepts only Discord webhook URLs and builds safe roll embeds", async () => {
  const rules = await loadRules();
  assert.equal(rules.parseDiscordWebhookUrl("https://discord.com/api/webhooks/123456/token-value").toString(), "https://discord.com/api/webhooks/123456/token-value?wait=true");
  assert.equal(rules.parseDiscordWebhookUrl("https://example.com/api/webhooks/123456/token-value"), null);
  assert.equal(rules.parseDiscordWebhookUrl("https://discord.com.evil.test/api/webhooks/123456/token-value"), null);
  assert.equal(rules.validDiscordRoll({ sides: 100, result: 100 }), true);
  assert.equal(rules.validDiscordRoll({ sides: 20, result: 21 }), false);
  const payload = rules.discordMessagePayload({ characterName: "Лиза Ашвинг", sides: 20, result: 12 }, true);
  assert.equal(payload.username, "Лиза Ашвинг");
  assert.equal(payload.embeds[0].title, "Бросок d20");
  assert.equal(payload.embeds[0].description, "# 12");
  assert.equal("fields" in payload.embeds[0], false);
  assert.equal(payload.embeds[0].thumbnail.url, "attachment://character-avatar.png");
  assert.deepEqual(payload.allowed_mentions, { parse: [] });

  const multipleDice = { characterName: "Лиза Ашвинг", kind: "simple", sides: 8, diceCount: 3, rolls: [2, 8, 4], result: 14 };
  assert.equal(rules.validDiscordRoll(multipleDice), true);
  assert.equal(rules.validDiscordRoll({ ...multipleDice, result: 13 }), false);
  const multipleDicePayload = rules.discordMessagePayload(multipleDice, true);
  assert.equal(multipleDicePayload.embeds[0].title, "Бросок 3d8");
  assert.equal(multipleDicePayload.embeds[0].description, "2 + 8 + 4\n# 14");

  const skillPayload = rules.discordMessagePayload({ characterName: "Лиза Ашвинг", kind: "skill", sides: 100, result: 13, skillName: "Атлетика", threshold: 89 }, true);
  assert.equal(skillPayload.embeds[0].title, "Бросок навыка «Атлетика» d100");
  assert.match(skillPayload.embeds[0].description, /Порог — 89/);
  assert.match(skillPayload.embeds[0].description, /Проверка пройдена на 7 успехов/);
  assert.equal(rules.validDiscordRoll({ kind: "skill", sides: 100, result: 13, skillName: "Атлетика", threshold: 89 }), true);
  assert.equal(rules.validDiscordRoll({ kind: "skill", sides: 20, result: 13, skillName: "Атлетика", threshold: 89 }), false);
  const combatPayload = rules.discordMessagePayload({ characterName: "Лиза Ашвинг", kind: "combat", sides: 100, result: 31, actionName: "Стандартная атака", checkLabel: "НР", threshold: 87 }, true);
  assert.equal(combatPayload.embeds[0].title, "Боевое действие «Стандартная атака» — НР");
  assert.match(combatPayload.embeds[0].description, /Порог — 87/);
  assert.equal(rules.validDiscordRoll({ kind: "combat", sides: 100, result: 31, actionName: "Стандартная атака", checkLabel: "НР", threshold: 87 }), true);
  const damage = { weaponName: "Клинок", expression: "d8", diceCount: 3, sides: 8, rolls: [2, 5, 7], characteristic: "agility", characteristicModifier: 5, fixedModifier: 0, total: 19 };
  const damagePayload = rules.discordMessagePayload({ characterName: "Лиза Ашвинг", kind: "combat", sides: 100, result: 13, actionName: "Стандартная атака", checkLabel: "НР", threshold: 89, damage }, true);
  assert.match(damagePayload.embeds[0].description, /Урон — Клинок/);
  assert.match(damagePayload.embeds[0].description, /3d8: 2 \+ 5 \+ 7 \+ 5 = \*\*19\*\*/);
  assert.equal(rules.validDiscordRoll({ kind: "combat", sides: 100, result: 13, actionName: "Стандартная атака", checkLabel: "НР", threshold: 89, damage }), true);
  const characteristicPayload = rules.discordMessagePayload({ characterName: "Лиза Ашвинг", kind: "characteristic", sides: 100, result: 31, characteristicName: "Сила", threshold: 47 }, true);
  assert.equal(characteristicPayload.embeds[0].title, "Проверка характеристики «Сила» d100");
  assert.match(characteristicPayload.embeds[0].description, /Порог — 47/);
  assert.equal(rules.validDiscordRoll({ kind: "characteristic", sides: 100, result: 31, characteristicName: "Сила", threshold: 47 }), true);
  assert.equal(rules.validDiscordRoll({ kind: "characteristic", sides: 100, result: 31, characteristicName: "", threshold: 47 }), false);
  const hitLocation = { roll: 24, location: "Левая рука" };
  const hitPayload = rules.discordMessagePayload({ characterName: "Лиза Ашвинг", kind: "hit-location", sides: 100, result: 24, hitLocation, embedColor: "#123abc" }, true);
  assert.match(hitPayload.embeds[0].description, /Попадание в левую руку/);
  assert.equal(hitPayload.embeds[0].color, 0x123abc);
  assert.equal(rules.validDiscordRoll({ kind: "hit-location", sides: 100, result: 24, hitLocation }), true);
  const combatHitPayload = rules.discordMessagePayload({ characterName: "Лиза Ашвинг", kind: "combat", sides: 100, result: 13, actionName: "Стандартная атака", checkLabel: "НР", threshold: 89, hitLocation }, true);
  assert.match(combatHitPayload.embeds[0].description, /Атака попала в левую руку/);
  assert.equal(rules.validDiscordRoll({ kind: "combat", sides: 100, result: 13, actionName: "Стандартная атака", checkLabel: "НР", threshold: 89, hitLocation }), true);
  const attackResults = [
    { damage, hitLocation },
    { damage: { ...damage, rolls: [1, 2, 3], total: 11 }, hitLocation: { roll: 42, location: "Корпус" } },
  ];
  const seriesRequest = { characterName: "Лиза Ашвинг", kind: "combat", sides: 100, result: 13, actionName: "Быстрая атака", checkLabel: "НР", threshold: 89, attackCount: 2, attackResults };
  assert.equal(rules.validDiscordRoll(seriesRequest), true);
  const seriesPayload = rules.discordMessagePayload(seriesRequest, true);
  assert.match(seriesPayload.embeds[0].description, /Всего атак: 2/);
  assert.match(seriesPayload.embeds[0].description, /Для защиты требуется 2 успеха/);
  assert.match(seriesPayload.embeds[0].description, /Удар 1/);
  assert.match(seriesPayload.embeds[0].description, /Удар 1:.*урон \*\*19\*\*/);
  assert.match(seriesPayload.embeds[0].description, /Удар 2/);
  assert.match(seriesPayload.embeds[0].description, /Удар 2:.*урон \*\*11\*\*/);
  const initiativePayload = rules.discordMessagePayload({ characterName: "Лиза Ашвинг", kind: "initiative", sides: 10, result: 6, initiativeModifier: 8, initiativeTotal: 14, initiativeDoubled: true }, true);
  assert.match(initiativePayload.embeds[0].description, /удвоен талантом/);
  assert.equal(rules.validDiscordRoll({ kind: "initiative", sides: 10, result: 6, initiativeModifier: 8, initiativeTotal: 14 }), true);
  const directDamagePayload = rules.discordMessagePayload({ characterName: "Лиза Ашвинг", kind: "damage", damage }, true);
  assert.match(directDamagePayload.embeds[0].title, /Бросок урона/);
  assert.equal(rules.validDiscordRoll({ kind: "damage", damage }), true);
  const criticalDamage = { ...damage, criticalCount: 2 };
  const criticalDamagePayload = rules.discordMessagePayload({ characterName: "Лиза Ашвинг", kind: "damage", damage: criticalDamage }, true);
  assert.match(criticalDamagePayload.embeds[0].description, /Критов: \*\*2\*\*/);
  assert.equal(rules.validDiscordRoll({ kind: "damage", damage: criticalDamage }), true);
});

test("maps every d100 hit-location boundary", async () => {
  const rules = await loadRules();
  assert.equal(rules.hitLocationForRoll(1), "Голова");
  assert.equal(rules.hitLocationForRoll(10), "Голова");
  assert.equal(rules.hitLocationForRoll(11), "Правая рука");
  assert.equal(rules.hitLocationForRoll(20), "Правая рука");
  assert.equal(rules.hitLocationForRoll(21), "Левая рука");
  assert.equal(rules.hitLocationForRoll(30), "Левая рука");
  assert.equal(rules.hitLocationForRoll(31), "Корпус");
  assert.equal(rules.hitLocationForRoll(70), "Корпус");
  assert.equal(rules.hitLocationForRoll(71), "Правая нога");
  assert.equal(rules.hitLocationForRoll(85), "Правая нога");
  assert.equal(rules.hitLocationForRoll(86), "Левая нога");
  assert.equal(rules.hitLocationForRoll(100), "Левая нога");
});

test("calculates d100 skill successes, failures and critical results", async () => {
  const rules = await loadRules();
  assert.deepEqual(rules.evaluateSkillCheck(89, 13), {
    roll: 13, threshold: 89, passed: true, critical: null, successes: 7, failures: 0, text: "Проверка пройдена на 7 успехов",
  });
  assert.equal(rules.evaluateSkillCheck(89, 80).text, "Проверка пройдена без успехов");
  assert.equal(rules.evaluateSkillCheck(89, 99).text, "Проверка не пройдена: 1 провал");
  assert.deepEqual(rules.evaluateSkillCheck(55, 84), {
    roll: 84, threshold: 55, passed: false, critical: null, successes: 0, failures: 2, text: "Проверка не пройдена: 2 провала",
  });
  assert.equal(rules.evaluateSkillCheck(55, 56).text, "Проверка не пройдена без дополнительных провалов");
  assert.equal(rules.evaluateSkillCheck(79, 99).text, "Проверка не пройдена: 2 провала");
  assert.equal(rules.evaluateSkillCheck(49, 99).text, "Проверка не пройдена: 5 провалов");
  assert.equal(rules.evaluateSkillCheck(89, 100).text, "Проверка не пройдена: критический провал!");
  assert.deepEqual(rules.evaluateSkillCheck(89, 1), {
    roll: 1, threshold: 89, passed: true, critical: "success", successes: 9, failures: 0, text: "Проверка пройдена, критические 9 успехов!",
  });
});

test("rolls every supported polyhedral die inside its range", async () => {
  const rules = await loadRules();
  assert.deepEqual([...rules.DICE_SIDES], [4, 6, 8, 10, 12, 20, 100]);
  for (const sides of rules.DICE_SIDES) {
    for (let index = 0; index < 100; index += 1) {
      const result = rules.rollDie(sides);
      assert.equal(Number.isInteger(result), true);
      assert.ok(result >= 1 && result <= sides, `d${sides} returned ${result}`);
    }
  }
});
