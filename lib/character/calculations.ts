import type { Character, CharacteristicId, HitZone } from "./types";

export const EXPERIENCE_COSTS = {
  twoAptitudes: [100, 200, 400, 800, 1600],
  oneAptitude: [250, 500, 1000, 2000, 4000],
  noAptitudes: [500, 1000, 2000, 4000, 8000],
} as const;

export function characteristicValue(character: Character, id: CharacteristicId) {
  return Math.max(0, character.characteristics[id].value);
}

export function bonus(character: Character, id: CharacteristicId) {
  return Math.floor(characteristicValue(character, id) / 10);
}

function descriptorIncludesCharacteristic(descriptor: string, id: CharacteristicId) {
  const aliases: Record<CharacteristicId, string[]> = {
    melee: ["навык рукопашной", "рукопаш"],
    agility: ["ловкость"],
    fellowship: ["общительность", "обаяние"],
    shooting: ["навык стрельбы", "стрельб"],
    endurance: ["выносливость", "телосложение", "стойкость"],
    intelligence: ["интеллект"],
    strength: ["сила"],
    perception: ["восприятие"],
    willpower: ["сила воли", "воля"],
  };
  const normalized = descriptor.toLocaleLowerCase("ru").replace(/ё/g, "е");
  if (id === "strength") {
    const withoutWillpower = normalized.replace(/сил[аы]\s+воли/g, "");
    return aliases.strength.some((alias) => withoutWillpower.includes(alias));
  }
  return aliases[id].some((alias) => normalized.includes(alias));
}

function supernaturalEffects(character: Character, id: CharacteristicId) {
  let multiplier = 1;
  let additive = 0;
  for (const talent of character.talents) {
    for (const text of [talent.name, talent.properties]) {
      const matches = text.matchAll(/(?:сверхъ?естественн[а-я]*|сверхчеловеческ[а-я]*)\s+([^().;:\n]{1,100}?)\s*\(\s*([xх×])?\s*(\d+(?:[.,]\d+)?)\s*\)/giu);
      for (const match of matches) {
        if (!descriptorIncludesCharacteristic(match[1], id)) continue;
        const value = Math.floor(Number(match[3].replace(",", ".")));
        if (!Number.isFinite(value)) continue;
        if (match[2]) multiplier = Math.max(multiplier, value);
        else additive = Math.max(additive, value);
      }
    }
  }
  return { multiplier, additive };
}

/** Запись (x3)/(×3) умножает бонус; обычная запись (3) даёт +3. */
export function supernaturalMultiplier(character: Character, id: CharacteristicId) {
  return supernaturalEffects(character, id).multiplier;
}

export function supernaturalBonus(character: Character, id: CharacteristicId) {
  return supernaturalEffects(character, id).additive;
}

function applySupernatural(character: Character, id: CharacteristicId, ordinaryBonus: number) {
  const { multiplier, additive } = supernaturalEffects(character, id);
  // Несколько вариантов одной и той же сверхъестественной характеристики не складываются:
  // применяется наиболее сильный итоговый вариант.
  return Math.max(ordinaryBonus, ordinaryBonus + additive, ordinaryBonus * multiplier);
}

export function effectiveBonus(character: Character, id: CharacteristicId) {
  return applySupernatural(character, id, bonus(character, id));
}

export type FatigueEffect = "none" | "halved" | "zero";

/**
 * Fatigue is compared with the ordinary characteristic bonus. Supernatural
 * multipliers deliberately do not delay the penalty.
 */
export function fatigueEffect(character: Character, id: CharacteristicId): FatigueEffect {
  const fatigue = Math.max(0, character.fatigueCurrent ?? 0);
  if (fatigue === 0) return "none";
  const ordinaryBonus = bonus(character, id);
  if (ordinaryBonus <= 0 || fatigue >= ordinaryBonus * 2) return "zero";
  if (fatigue >= ordinaryBonus) return "halved";
  return "none";
}

export function fatiguedCharacteristicValue(character: Character, id: CharacteristicId) {
  const value = characteristicValue(character, id);
  const effect = fatigueEffect(character, id);
  if (effect === "zero") return 0;
  if (effect === "halved") return Math.floor(value / 2);
  return value;
}

export function fatiguedBonus(character: Character, id: CharacteristicId) {
  return Math.floor(fatiguedCharacteristicValue(character, id) / 10);
}

export function fatiguedEffectiveBonus(character: Character, id: CharacteristicId) {
  if (fatigueEffect(character, id) === "zero") return 0;
  return applySupernatural(character, id, fatiguedBonus(character, id));
}

export function skillModifier(level: number) {
  return [-20, 0, 10, 20, 30, 40][Math.max(0, Math.min(5, level))];
}

export function skillThreshold(character: Character, skillId: string) {
  const skill = character.skills.find((item) => item.id === skillId);
  if (!skill) return 0;
  return fatiguedCharacteristicValue(character, skill.characteristic)
    + fatiguedEffectiveBonus(character, skill.characteristic)
    + skillModifier(skill.level);
}

export function experienceCost(aptitudes: number, step: number) {
  const costs = aptitudes >= 2
    ? EXPERIENCE_COSTS.twoAptitudes
    : aptitudes === 1
      ? EXPERIENCE_COSTS.oneAptitude
      : EXPERIENCE_COSTS.noAptitudes;
  return costs[Math.max(0, Math.min(4, step - 1))];
}

export function spentExperience(character: Character) {
  const characteristicXp = Object.values(character.characteristics).reduce((sum, item) => {
    return sum + Array.from({ length: item.advances }, (_, index) => experienceCost(character.aptitudes[item.id], index + 1))
      .reduce((acc, cost) => acc + cost, 0);
  }, 0);

  const skillXp = character.skills.reduce((sum, skill) => {
    return sum + Array.from({ length: skill.level }, (_, index) => experienceCost(character.aptitudes[skill.characteristic], index === 4 ? 1 : index + 1))
      .reduce((acc, cost) => acc + cost, 0);
  }, 0);

  return Math.round(characteristicXp + skillXp);
}

export function recordedSpentExperience(character: Character) {
  return character.experienceSpentOverride ?? spentExperience(character);
}

export function zoneDefense(character: Character, zone: HitZone) {
  const armor = character.armor.filter((item) => item.zones.includes(zone)).reduce((sum, item) => sum + item.armor, 0);
  return armor + character.naturalArmor + fatiguedEffectiveBonus(character, "endurance");
}

export function movement(character: Character) {
  const agilityBonus = applySupernatural(character, "agility", Math.max(0, Math.min(10, fatiguedBonus(character, "agility"))));
  return {
    free: agilityBonus === 0 ? 0.5 : agilityBonus,
    halfAction: agilityBonus === 0 ? 1 : agilityBonus * 2,
    charge: agilityBonus === 0 ? 2 : agilityBonus * 3,
    run: agilityBonus === 0 ? 3 : agilityBonus * 6,
  };
}

const carryTable = [
  [0.9, 2.25, 4.5], [2.25, 4.5, 9], [4.5, 9, 18], [9, 18, 36], [18, 36, 72],
  [27, 54, 108], [36, 72, 144], [45, 90, 180], [56, 112, 224], [67, 134, 268],
  [78, 156, 312], [90, 180, 360], [112, 224, 448], [225, 450, 900], [337, 674, 1348],
  [450, 900, 1800], [675, 1350, 2700], [900, 1800, 3600], [1350, 2700, 5400], [1800, 3600, 7200], [2250, 4500, 9000],
];

export function carrying(character: Character) {
  const index = Math.max(0, Math.min(20, fatiguedEffectiveBonus(character, "strength") + fatiguedEffectiveBonus(character, "endurance")));
  const [carry, lift, push] = carryTable[index];
  return { index, carry, lift, push };
}

export function fatigueThreshold(character: Character) {
  return effectiveBonus(character, "endurance") + effectiveBonus(character, "willpower");
}
