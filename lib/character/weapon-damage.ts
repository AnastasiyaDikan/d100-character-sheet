import { fatiguedEffectiveBonus } from "./calculations";
import { rollDie } from "./dice";
import type { SkillCheckOutcome } from "./skill-check";
import type { Character, Weapon } from "./types";

export type DamageDieRoll = {
  kind: "main" | "critical" | "explosion" | "extra";
  sides: number;
  value: number;
};

export type WeaponDamageResult = {
  weaponName: string;
  /** Выбранный основной урон для одной или двух рук. */
  expression: string;
  extraExpression: string;
  diceCount: number;
  /** Грани первой основной кости, оставлены для совместимости. */
  sides: number;
  /** Все результаты в том же порядке, что и rollDetails. */
  rolls: number[];
  rollDetails: DamageDieRoll[];
  characteristic: "strength" | "agility";
  characteristicModifier: number;
  fixedModifier: number;
  criticalDice: number;
  explosionRank: 0 | 1 | 2;
  total: number;
};

export type ParsedDamageExpression = {
  dice: Array<{ diceCount: number; sides: number }>;
  fixedModifier: number;
};

export function weaponDamageModes(value: string) {
  return value.split("/").map((item) => item.trim()).filter(Boolean).slice(0, 2);
}

/** Разбирает d8, 2к8+3 и суммы разных костей вроде к12+к10+к4. */
export function parseDamageExpression(value: string): ParsedDamageExpression | null {
  const normalized = value.trim().toLocaleLowerCase("ru").replace(/[кkд]/g, "d").replace(/\s+/g, "");
  if (!normalized || !/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/i.test(normalized)) return null;
  const tokens = normalized.match(/[+-]?(?:\d*d\d+|\d+)/gi) ?? [];
  const dice: ParsedDamageExpression["dice"] = [];
  let fixedModifier = 0;
  for (const token of tokens) {
    const negative = token.startsWith("-");
    const body = token.replace(/^[+-]/, "");
    if (body.includes("d")) {
      if (negative) return null;
      const [countText, sidesText] = body.split("d");
      const diceCount = countText ? Number(countText) : 1;
      const sides = Number(sidesText);
      if (!Number.isInteger(diceCount) || diceCount < 1 || diceCount > 20 || !Number.isInteger(sides) || sides < 2 || sides > 1000) return null;
      dice.push({ diceCount, sides });
    } else {
      const value = Number(body);
      if (!Number.isFinite(value) || value > 10000) return null;
      fixedModifier += negative ? -value : value;
    }
  }
  const totalDice = dice.reduce((sum, item) => sum + item.diceCount, 0);
  return dice.length > 0 && totalDice <= 50 ? { dice, fixedModifier } : null;
}

/** Старый одногрупповой разбор сохранён для совместимости с тестами и импортами. */
export function parseWeaponDamage(value: string) {
  const parsed = parseDamageExpression(value);
  if (!parsed || parsed.dice.length !== 1) return null;
  return { ...parsed.dice[0], fixedModifier: parsed.fixedModifier };
}

export function selectedWeaponDamage(weapon: Weapon) {
  const stored = weapon as Partial<Weapon>;
  if (typeof stored.damageOneHand === "string" || typeof stored.damageTwoHands === "string") {
    const oneHand = stored.damageOneHand?.trim() ?? "";
    const twoHands = stored.damageTwoHands?.trim() ?? "";
    return weapon.damageMode === 1 ? (twoHands || oneHand) : oneHand;
  }
  const modes = weaponDamageModes(weapon.damage ?? "");
  return modes[Math.min(weapon.damageMode, Math.max(0, modes.length - 1))] ?? "";
}

const normalize = (value: string) => value.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^а-яa-z0-9()]+/g, " ").trim();

function talentAppliesToWeapon(talentName: string, weapon: Weapon) {
  const qualifier = talentName.match(/\(([^)]+)\)/)?.[1];
  if (!qualifier) return true;
  const normalizedQualifier = normalize(qualifier);
  if (/конкретн|выбранн|категор|соответствующ/.test(normalizedQualifier)) return true;
  const weaponWords = normalize(`${weapon.name} ${weapon.weaponClass}`).split(/\s+/).filter((word) => word.length >= 3);
  const qualifierWords = normalizedQualifier.split(/\s+/).filter((word) => word.length >= 3 && !/оружи/.test(word));
  return qualifierWords.some((word) => weaponWords.some((weaponWord) => weaponWord.slice(0, 4) === word.slice(0, 4)));
}

/** 1 — один дополнительный бросок; 2 — все максимумы взрываются цепочкой. */
export function weaponExplosionRank(character: Character, weapon: Weapon): 0 | 1 | 2 {
  let rank: 0 | 1 | 2 = 0;
  for (const talent of character.talents) {
    const name = normalize(talent.name);
    if (!talentAppliesToWeapon(talent.name, weapon)) continue;
    if (name.startsWith("мастер") || name.includes(" мастер")) rank = 2;
    else if (rank < 1 && name.includes("специализац")) rank = 1;
  }
  return rank;
}

function expandDice(parsed: ParsedDamageExpression) {
  return parsed.dice.flatMap(({ diceCount, sides }) => Array.from({ length: diceCount }, () => sides));
}

export function formatWeaponDamage(result: WeaponDamageResult) {
  const group = (kinds: DamageDieRoll["kind"][], label: string) => {
    const values = result.rollDetails.filter((roll) => kinds.includes(roll.kind));
    return values.length ? `${label}: ${values.map((roll) => `d${roll.sides}[${roll.value}]`).join(" + ")}` : "";
  };
  const pieces = [
    group(["main", "critical"], "Основной"),
    group(["explosion"], "Взрыв"),
    group(["extra"], "Доп."),
    `${result.characteristic === "agility" ? "Ловкость" : "Сила"} ${result.characteristicModifier >= 0 ? "+" : "−"}${Math.abs(result.characteristicModifier)}`,
    result.fixedModifier ? `постоянный ${result.fixedModifier >= 0 ? "+" : "−"}${Math.abs(result.fixedModifier)}` : "",
  ].filter(Boolean);
  return `${pieces.join("; ")} = ${result.total}`;
}

export function rollWeaponDamage(
  character: Character,
  weapon: Weapon,
  outcome: SkillCheckOutcome,
  roller: (sides: number) => number = rollDie,
): WeaponDamageResult | null {
  if (!outcome.passed) return null;
  const expression = selectedWeaponDamage(weapon);
  const parsed = parseDamageExpression(expression);
  if (!parsed) return null;
  const extraExpression = (weapon.extraDamage ?? "").trim();
  const extra = extraExpression ? parseDamageExpression(extraExpression) : { dice: [], fixedModifier: 0 };
  if (!extra) return null;

  const criticalDice = Math.floor(outcome.successes / 5) + (outcome.critical === "success" ? 1 : 0);
  const primarySides = parsed.dice[0].sides;
  const mainKinds: DamageDieRoll["kind"][] = [
    ...expandDice(parsed).map(() => "main" as const),
    ...Array.from({ length: criticalDice }, () => "critical" as const),
  ];
  const mainSides = [...expandDice(parsed), ...Array.from({ length: criticalDice }, () => primarySides)];
  const rollDetails: DamageDieRoll[] = mainSides.map((sides, index) => ({ kind: mainKinds[index], sides, value: roller(sides) }));

  const explosionRank = weaponExplosionRank(character, weapon);
  if (explosionRank === 1) {
    const maximum = rollDetails.find((roll) => roll.value === roll.sides);
    if (maximum) rollDetails.push({ kind: "explosion", sides: maximum.sides, value: roller(maximum.sides) });
  } else if (explosionRank === 2) {
    for (let index = 0; index < rollDetails.length && rollDetails.length < 150; index += 1) {
      const current = rollDetails[index];
      if (current.kind !== "extra" && current.value === current.sides) {
        rollDetails.push({ kind: "explosion", sides: current.sides, value: roller(current.sides) });
      }
    }
  }

  for (const sides of expandDice(extra)) rollDetails.push({ kind: "extra", sides, value: roller(sides) });
  const characteristicModifier = fatiguedEffectiveBonus(character, weapon.damageCharacteristic);
  const fixedModifier = parsed.fixedModifier + extra.fixedModifier;
  const rolls = rollDetails.map((roll) => roll.value);
  return {
    weaponName: weapon.name.trim() || "Оружие",
    expression,
    extraExpression,
    diceCount: rolls.length,
    sides: primarySides,
    rolls,
    rollDetails,
    characteristic: weapon.damageCharacteristic,
    characteristicModifier,
    fixedModifier,
    criticalDice,
    explosionRank,
    total: rolls.reduce((sum, value) => sum + value, 0) + characteristicModifier + fixedModifier,
  };
}
