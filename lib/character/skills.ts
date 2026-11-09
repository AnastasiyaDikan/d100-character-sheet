import type { CharacteristicId, Skill } from "./types";

/** Только Ремесло позволяет выбрать собственную характеристику; остальные специализации наследуют родительскую. */
export function specializationCharacteristic(parent: Skill, selected: CharacteristicId) {
  return parent.id === "trade" ? selected : parent.characteristic;
}
