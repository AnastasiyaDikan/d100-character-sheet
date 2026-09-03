import type { Character, CharacteristicId, HitZone } from "./types";

const characteristicCosts = [100, 200, 400, 800, 1600];

export function characteristicValue(character: Character, id: CharacteristicId) {
  return Math.max(0, character.characteristics[id].value);
}

export function bonus(character: Character, id: CharacteristicId) {
  return Math.floor(characteristicValue(character, id) / 10);
}

export function skillModifier(level: number) {
  return [-20, 0, 10, 20, 30][Math.max(0, Math.min(4, level))];
}

export function skillThreshold(character: Character, skillId: string) {
  const skill = character.skills.find((item) => item.id === skillId);
  if (!skill) return 0;
  return characteristicValue(character, skill.characteristic) + bonus(character, skill.characteristic) + skillModifier(skill.level);
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
  return armor + character.naturalArmor + bonus(character, "endurance");
}

export function movement(character: Character) {
  const agilityBonus = Math.max(0, Math.min(10, bonus(character, "agility")));
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
  const index = Math.max(0, Math.min(20, bonus(character, "strength") + bonus(character, "endurance")));
  const [carry, lift, push] = carryTable[index];
  return { index, carry, lift, push };
}

export function fatigueThreshold(character: Character) {
  return bonus(character, "endurance") + bonus(character, "willpower");
}
