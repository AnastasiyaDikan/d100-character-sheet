import { CHARACTERISTICS } from "./data";
import type { Character, CharacteristicId, Race, RaceEffect, Talent } from "./types";

const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}-${Math.random().toString(36).slice(2)}`;

function selectedEffects(race: Race, choices: Record<string, string>) {
  return Object.entries(choices)
    .map(([choiceId, option]) => race.choiceEffects?.[choiceId]?.[option])
    .filter((effect): effect is RaceEffect => Boolean(effect));
}

function mergeNumbers(
  base: Partial<Record<CharacteristicId, number>>,
  additions: Array<Partial<Record<CharacteristicId, number>> | undefined>,
  mode: "replace" | "add",
) {
  const result = { ...base };
  for (const addition of additions) {
    if (!addition) continue;
    for (const [key, value] of Object.entries(addition) as Array<[CharacteristicId, number]>) {
      result[key] = mode === "add" ? (result[key] ?? 0) + value : value;
    }
  }
  return result;
}

export function calculateRaceWounds(character: Character, race: Race) {
  if (!race.woundFactors) return race.wounds ?? character.woundsTotal;
  const total = Object.entries(race.woundFactors).reduce((sum, [id, multiplier]) => {
    return sum + Math.floor(character.characteristics[id as CharacteristicId].value / 10) * (multiplier ?? 0);
  }, race.woundFlat ?? 0);
  return race.woundCap === undefined ? total : Math.min(total, race.woundCap);
}

export function calculateNaturalArmor(character: Character, race: Race) {
  if (!race.naturalArmorFormula) return character.naturalArmor;
  const raw = race.naturalArmorFormula.base
    + Math.floor(character.characteristics.endurance.value / 10) * race.naturalArmorFormula.enduranceMultiplier;
  return race.naturalArmorFormula.round === "ceil" ? Math.ceil(raw) : Math.floor(raw);
}

export function independentAptitudeBudget(race: Race) {
  return Math.max(0, race.aptitudeBudget - 1);
}

export function beginIndependentAptitudeDistribution(character: Character): Character {
  const aptitudes = Object.fromEntries(CHARACTERISTICS.map(({ id }) => [id, 0])) as Character["aptitudes"];
  return { ...character, freeAptitudes: true, aptitudes };
}

export function applyAptitudeCharacteristics(character: Character, race: Race): Character {
  const effects = selectedEffects(race, character.raceChoices ?? {});
  const characteristicBonuses = mergeNumbers({}, effects.map((effect) => effect.characteristicBonuses), "add");
  const scale = race.characteristicScale ?? [15, 20, 25];
  const previousAptitudes = character.appliedAptitudes ?? character.racialAptitudes;
  const characteristics = Object.fromEntries(CHARACTERISTICS.map(({ id }) => {
    const previousLevel = Math.max(0, Math.min(2, previousAptitudes[id] ?? 0));
    const nextLevel = Math.max(0, Math.min(2, character.aptitudes[id] ?? 0));
    const choiceBonus = characteristicBonuses[id] ?? 0;
    const previousStartingValue = scale[previousLevel] + choiceBonus;
    const nextStartingValue = scale[nextLevel] + choiceBonus;
    const personalProgress = character.characteristics[id].value - previousStartingValue;
    return [id, { ...character.characteristics[id], value: Math.max(0, nextStartingValue + personalProgress) }];
  })) as Character["characteristics"];
  let next: Character = { ...character, characteristics, appliedAptitudes: { ...character.aptitudes } };
  if (race.naturalArmorFormula) next = { ...next, naturalArmor: calculateNaturalArmor(next, race) };
  const woundsTotal = calculateRaceWounds(next, race);
  const woundsCurrent = character.woundsCurrent === character.woundsTotal
    ? woundsTotal
    : Math.min(character.woundsCurrent, woundsTotal);
  return { ...next, woundsTotal, woundsCurrent };
}

export function applyRace(character: Character, race: Race, choices: Record<string, string>): Character {
  const effects = selectedEffects(race, choices);
  const aptitudeValues = mergeNumbers(race.aptitudes, effects.map((effect) => effect.aptitudes), "add");
  const characteristicBonuses = mergeNumbers({}, effects.map((effect) => effect.characteristicBonuses), "add");
  const scale = race.characteristicScale ?? [15, 20, 25];
  const racialAptitudes = Object.fromEntries(CHARACTERISTICS.map(({ id }) => [id, Math.max(0, Math.min(2, aptitudeValues[id] ?? 0))])) as Character["aptitudes"];
  const characteristics = Object.fromEntries(CHARACTERISTICS.map(({ id }) => [id, {
    ...character.characteristics[id],
    value: scale[racialAptitudes[id]] + (characteristicBonuses[id] ?? 0),
    advances: 0,
  }])) as Character["characteristics"];
  const traitDefinitions = [...(race.traits ?? []), ...effects.flatMap((effect) => effect.traits ?? [])];
  const uniqueTraits = [...new Map(traitDefinitions.map((trait) => [trait.name, trait])).values()];
  const racialTraits: Talent[] = uniqueTraits.map((trait) => ({ ...trait, id: uid("race"), source: "race" }));
  const corruptionFromChoice = effects.findLast((effect) => effect.corruption !== undefined)?.corruption;
  let next: Character = {
    ...character,
    raceId: race.id,
    raceChoices: choices,
    characteristics,
    aptitudes: { ...racialAptitudes },
    racialAptitudes,
    appliedAptitudes: { ...racialAptitudes },
    freeAptitudes: false,
    corruption: corruptionFromChoice !== undefined ? corruptionFromChoice : (race.corruption ?? null),
    naturalArmor: effects.findLast((effect) => effect.naturalArmor !== undefined)?.naturalArmor ?? race.naturalArmor ?? 0,
    talents: [...character.talents.filter((talent) => talent.source !== "race"), ...racialTraits],
  };
  if (race.naturalArmorFormula) next = { ...next, naturalArmor: calculateNaturalArmor(next, race) };
  const woundsTotal = calculateRaceWounds(next, race);
  return { ...next, woundsTotal, woundsCurrent: woundsTotal };
}
