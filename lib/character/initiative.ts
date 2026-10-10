import { adjustedEffectiveBonus } from "./calculations";
import type { Character } from "./types";

const normalize = (value: string) => value.toLocaleLowerCase("ru").replace(/ё/g, "е");

export function hasLightningReflexes(character: Character) {
  return character.talents.some((talent) => normalize(talent.name).includes("молниеносные рефлексы"));
}

export function initiativeModifier(character: Character) {
  const agilityModifier = adjustedEffectiveBonus(character, "agility");
  return agilityModifier * (hasLightningReflexes(character) ? 2 : 1);
}
