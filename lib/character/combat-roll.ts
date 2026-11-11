import { combatActionRollsHitLocation, combatAttackCount, type CombatAction } from "./combat";
import { rollDie } from "./dice";
import { rollHitLocation, type HitLocationResult } from "./hit-location";
import type { SkillCheckOutcome } from "./skill-check";
import type { Character, Weapon } from "./types";

export type CombatStrikeRoll = {
  number: number;
  hitLocation: HitLocationResult | null;
};

export function activeCombatWeapon(character: Character): Weapon | null {
  return character.weapons.find((weapon) => weapon.active) ?? null;
}

export function selectCombatWeapon(character: Character, weaponId: string): Character {
  if (!character.weapons.some((weapon) => weapon.id === weaponId)) return character;
  return {
    ...character,
    weapons: character.weapons.map((weapon) => ({ ...weapon, active: weapon.id === weaponId })),
  };
}

export function rollCombatStrikes(
  character: Character,
  action: CombatAction,
  outcome: SkillCheckOutcome,
  hitLocationRoller: () => number = () => rollDie(100),
): CombatStrikeRoll[] {
  if (!action.dealsDamage || !outcome.passed) return [];
  const count = combatAttackCount(character, action, outcome);
  return Array.from({ length: count }, (_, index) => {
    return {
      number: index + 1,
      hitLocation: combatActionRollsHitLocation(action) ? rollHitLocation(hitLocationRoller) : null,
    };
  });
}
