import { fatiguedEffectiveBonus } from "./calculations";
import { rollDie } from "./dice";
import type { SkillCheckOutcome } from "./skill-check";
import type { Character, Weapon } from "./types";

export type WeaponDamageResult = {
  weaponName: string;
  expression: string;
  diceCount: number;
  sides: number;
  rolls: number[];
  characteristic: "strength" | "agility";
  characteristicModifier: number;
  fixedModifier: number;
  total: number;
};

export function weaponDamageModes(value: string) {
  return value.split("/").map((item) => item.trim()).filter(Boolean).slice(0, 2);
}

export function parseWeaponDamage(value: string) {
  const normalized = value.trim().toLocaleLowerCase("ru").replace(/[кkд]/g, "d");
  const match = normalized.match(/^(\d*)\s*d\s*(\d+)\s*([+-]\s*\d+)?$/i);
  if (!match) return null;
  const diceCount = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  const fixedModifier = match[3] ? Number(match[3].replace(/\s/g, "")) : 0;
  if (!Number.isInteger(diceCount) || diceCount < 1 || diceCount > 20 || !Number.isInteger(sides) || sides < 2 || sides > 1000) return null;
  return { diceCount, sides, fixedModifier };
}

export function selectedWeaponDamage(weapon: Weapon) {
  const modes = weaponDamageModes(weapon.damage);
  return modes[Math.min(weapon.damageMode, Math.max(0, modes.length - 1))] ?? "";
}

export function rollWeaponDamage(character: Character, weapon: Weapon, outcome: SkillCheckOutcome): WeaponDamageResult | null {
  if (!outcome.passed) return null;
  const expression = selectedWeaponDamage(weapon);
  const parsed = parseWeaponDamage(expression);
  if (!parsed) return null;
  const criticalDice = Math.floor(outcome.successes / 5) + (outcome.critical === "success" ? 1 : 0);
  const diceCount = parsed.diceCount + criticalDice;
  const rolls = Array.from({ length: diceCount }, () => rollDie(parsed.sides));
  const characteristicModifier = fatiguedEffectiveBonus(character, weapon.damageCharacteristic);
  return {
    weaponName: weapon.name.trim() || "Оружие",
    expression,
    diceCount,
    sides: parsed.sides,
    rolls,
    characteristic: weapon.damageCharacteristic,
    characteristicModifier,
    fixedModifier: parsed.fixedModifier,
    total: rolls.reduce((sum, value) => sum + value, 0) + characteristicModifier + parsed.fixedModifier,
  };
}
