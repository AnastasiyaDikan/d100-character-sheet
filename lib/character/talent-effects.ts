import type { Character, CharacteristicId } from "./types";

const normalizeTalentName = (value: string) => value
  .toLocaleLowerCase("ru")
  .replace(/ё/g, "е")
  .replace(/\s+/g, " ")
  .trim();

/** Совпадение учитывает варианты вида «Талант (уточнение)» и «Талант: уточнение». */
export function hasTalent(character: Character, talentName: string) {
  const expected = normalizeTalentName(talentName);
  return character.talents.some((talent) => {
    const actual = normalizeTalentName(talent.name);
    return actual === expected || actual.startsWith(`${expected} (`) || actual.startsWith(`${expected}:`);
  });
}

export function hasParanoia(character: Character) {
  return hasTalent(character, "Паранойя");
}

/** Неистовство действует только при наличии таланта и включённой галочке в Боевых действиях. */
export function frenzyActive(character: Character) {
  return character.combatSettings?.frenzy === true && hasTalent(character, "Неистовство");
}

const FRENZY_ADJUSTMENTS: Partial<Record<CharacteristicId, number>> = {
  melee: 10,
  strength: 10,
  endurance: 10,
  willpower: 10,
  shooting: -20,
  intelligence: -20,
};

export function frenzyCharacteristicAdjustment(character: Character, id: CharacteristicId) {
  return frenzyActive(character) ? FRENZY_ADJUSTMENTS[id] ?? 0 : 0;
}
