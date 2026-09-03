import type { Character } from "./types";
import { createCharacter, RACES } from "./data";
import { applyRace, calculateRaceWounds } from "./race-engine";

const DB_NAME = "d100-character-sheet";
const STORE = "characters";
const LATEST_KEY = "latest";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAutosave(character: Character) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(character, LATEST_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function loadAutosave(): Promise<Character | null> {
  const db = await openDatabase();
  const value = await new Promise<Character | undefined>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(LATEST_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value ? normalizeCharacter(value) : null;
}

export function normalizeCharacter(raw: Character & { fate?: number }): Character {
  const base = createCharacter();
  const legacyFate = typeof raw.fate === "number" ? raw.fate : base.fateCurrent;
  const raceId = raw.raceId === "kobold" ? "kobold-hunter" : raw.raceId;
  const raceChoices = raw.raceId === "kobold"
    ? { aptitude: "Навык стрельбы" }
    : (raw.raceChoices ?? {});
  const merged: Character = {
    ...base,
    ...raw,
    raceId,
    raceChoices,
    dataRevision: 4,
    avatarCrop: raw.avatarCrop ?? base.avatarCrop,
    characteristics: { ...base.characteristics, ...(raw.characteristics ?? {}) },
    aptitudes: { ...base.aptitudes, ...(raw.aptitudes ?? {}) },
    racialAptitudes: { ...base.racialAptitudes, ...(raw.racialAptitudes ?? {}) },
    appliedAptitudes: {
      ...base.appliedAptitudes,
      ...(raw.appliedAptitudes ?? raw.racialAptitudes ?? raw.aptitudes ?? {}),
    },
    fateCurrent: raw.fateCurrent ?? legacyFate,
    fateMax: raw.fateMax ?? legacyFate,
    corruption: raw.corruption ?? null,
    weapons: raw.weapons ?? [],
  };
  if ((raw.dataRevision ?? 0) >= 3) return merged;

  const race = RACES.find((item) => item.id === merged.raceId);
  if (!race) return merged;
  const migrated = applyRace(merged, race, merged.raceChoices ?? {});
  const characteristics = Object.fromEntries(Object.entries(migrated.characteristics).map(([id, value]) => {
    const legacy = raw.characteristics?.[id as keyof Character["characteristics"]] as unknown as { advances?: number } | undefined;
    const advances = legacy?.advances ?? 0;
    return [id, { ...value, advances, value: value.value + advances * 5 }];
  })) as Character["characteristics"];
  const withProgress = { ...migrated, characteristics, dataRevision: 4 as const };
  const woundsTotal = calculateRaceWounds(withProgress, race);
  return { ...withProgress, woundsTotal, woundsCurrent: woundsTotal };
}

export async function deleteAutosave() {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(LATEST_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export function downloadCharacter(character: Character) {
  const payload = { ...character, savedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${(character.name || "character").replace(/[^a-zA-Zа-яА-ЯёЁ0-9-_ ]/g, "").trim() || "character"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
