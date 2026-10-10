export type HitLocationName = "Голова" | "Правая рука" | "Левая рука" | "Корпус" | "Правая нога" | "Левая нога";

export type HitLocationResult = {
  roll: number;
  location: HitLocationName;
};

export function hitLocationForRoll(roll: number): HitLocationName {
  const value = Math.max(1, Math.min(100, Math.trunc(roll)));
  if (value <= 10) return "Голова";
  if (value <= 20) return "Правая рука";
  if (value <= 30) return "Левая рука";
  if (value <= 70) return "Корпус";
  if (value <= 85) return "Правая нога";
  return "Левая нога";
}

export function rollHitLocation(roller: () => number): HitLocationResult {
  const roll = roller();
  return { roll, location: hitLocationForRoll(roll) };
}

export function hitLocationAccusative(location: HitLocationName) {
  const forms: Record<HitLocationName, string> = {
    "Голова": "голову",
    "Правая рука": "правую руку",
    "Левая рука": "левую руку",
    "Корпус": "корпус",
    "Правая нога": "правую ногу",
    "Левая нога": "левую ногу",
  };
  return forms[location];
}
