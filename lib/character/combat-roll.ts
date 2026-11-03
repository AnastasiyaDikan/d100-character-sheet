import { combatActionRollsHitLocation, combatAttackCount, type CombatAction } from "./combat";
import { rollDie } from "./dice";
import { rollHitLocation, type HitLocationResult } from "./hit-location";
import type { SkillCheckOutcome } from "./skill-check";
import type { Character } from "./types";
import { rollWeaponDamage, type WeaponDamageResult } from "./weapon-damage";

export type CombatStrikeRoll = {
  number: number;
  damage: WeaponDamageResult | null;
  damageError: boolean;
  hitLocation: HitLocationResult | null;
};

export function rollCombatStrikes(
  character: Character,
  action: CombatAction,
  outcome: SkillCheckOutcome,
  damageRoller: (sides: number) => number = rollDie,
  hitLocationRoller: () => number = () => rollDie(100),
): CombatStrikeRoll[] {
  if (!action.dealsDamage || !outcome.passed) return [];
  const activeWeapon = character.weapons.find((weapon) => weapon.active);
  const count = combatAttackCount(character, action, outcome);
  return Array.from({ length: count }, (_, index) => {
    const damage = activeWeapon ? rollWeaponDamage(character, activeWeapon, outcome, damageRoller) : null;
    return {
      number: index + 1,
      damage,
      damageError: Boolean(activeWeapon && !damage),
      hitLocation: combatActionRollsHitLocation(action) ? rollHitLocation(hitLocationRoller) : null,
    };
  });
}
