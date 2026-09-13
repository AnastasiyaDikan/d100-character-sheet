import type { Character, CharacteristicId, HitZone } from "./types";

const characteristicCosts = [100, 200, 400, 800, 1600];

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

/**
 * Reads multipliers from talents such as "Сверхъестественная сила (3)".
 * Both spelling variants (сверхъестественная/сверхестественная), grouped
 * characteristics and the endurance synonyms are supported. Equal effects do
 * not stack: the greatest multiplier wins.
 */
export function supernaturalMultiplier(character: Character, id: CharacteristicId) {
  let multiplier = 1;
  for (const talent of character.talents) {
    for (const text of [talent.name, talent.properties]) {
      const matches = text.matchAll(/(?:сверхъ?естественн[а-я]*|сверхчеловеческ[а-я]*)\s+([^().;:\n]{1,100}?)\s*\(\s*(\d+(?:[.,]\d+)?)\s*\)/giu);
      for (const match of matches) {
        if (!descriptorIncludesCharacteristic(match[1], id)) continue;
        const value = Math.floor(Number(match[2].replace(",", ".")));
        if (Number.isFinite(value)) multiplier = Math.max(multiplier, value);
      }
    }
  }
  return multiplier;
}

export function effectiveBonus(character: Character, id: CharacteristicId) {
  return bonus(character, id) * supernaturalMultiplier(character, id);
}

export function skillModifier(level: number) {
  return [-20, 0, 10, 20, 30][Math.max(0, Math.min(4, level))];
}

export function skillThreshold(character: Character, skillId: string) {
  const skill = character.skills.find((item) => item.id === skillId);
  if (!skill) return 0;
  return characteristicValue(character, skill.characteristic) + effectiveBonus(character, skill.characteristic) + skillModifier(skill.level);
}

function priceMultiplier(aptitudes: number) {
  return aptitudes >= 2 ? 1 : aptitudes === 1 ? 2.5 : 5;
}

export function spentExperience(character: Character) {
  const characteristicXp = Object.values(character.characteristics).reduce((sum, item) => {
    const steps = characteristicCosts.slice(0, item.advances);
    return sum + steps.reduce((acc, cost) => acc + cost * priceMultiplier(character.aptitudes[item.id]), 0);
  }, 0);

  const skillXp = character.skills.reduce((sum, skill) => {
    const steps = characteristicCosts.slice(0, skill.level);
    return sum + steps.reduce((acc, cost) => acc + cost * priceMultiplier(character.aptitudes[skill.characteristic]), 0);
  }, 0);

  return Math.round(characteristicXp + skillXp);
}

export function zoneDefense(character: Character, zone: HitZone) {
  const armor = character.armor.filter((item) => item.zones.includes(zone)).reduce((sum, item) => sum + item.armor, 0);
  return armor + character.naturalArmor + effectiveBonus(character, "endurance");
}

export function movement(character: Character) {
  const agilityBonus = Math.max(0, Math.min(10, bonus(character, "agility"))) * supernaturalMultiplier(character, "agility");
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
  const index = Math.max(0, Math.min(20, effectiveBonus(character, "strength") + effectiveBonus(character, "endurance")));
  const [carry, lift, push] = carryTable[index];
  return { index, carry, lift, push };
}

export function fatigueThreshold(character: Character) {
  return effectiveBonus(character, "endurance") + effectiveBonus(character, "willpower");
}
