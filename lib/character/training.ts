export const TRAINING_GOAL = 10;

export type TrainingState = {
  trainingProgress: number | null;
  trainingBonus: number;
};

function wholeNonNegative(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
}

/**
 * Every ten recorded marks complete one training cycle and start a new track.
 * `reward` decides what the cycle grants: +5 for a characteristic or one rank
 * for a skill. Values over ten are supported for imported saves and pasted
 * numbers, so 17 always becomes one reward and 7/10.
 */
export function normalizeTrainingState(progress: unknown, bonus: unknown, reward = 1, maximumBonus = Number.MAX_SAFE_INTEGER): TrainingState {
  const marks = wholeNonNegative(progress);
  const completed = Math.floor(marks / TRAINING_GOAL);
  const remainder = marks % TRAINING_GOAL;
  return {
    trainingProgress: remainder === 0 ? null : remainder,
    trainingBonus: Math.min(wholeNonNegative(maximumBonus), wholeNonNegative(bonus) + completed * wholeNonNegative(reward)),
  };
}

export function applyTrainingProgress(currentBonus: unknown, nextProgress: number | null, reward = 1, maximumBonus = Number.MAX_SAFE_INTEGER): TrainingState {
  if (nextProgress === null) {
    return { trainingProgress: null, trainingBonus: Math.min(wholeNonNegative(maximumBonus), wholeNonNegative(currentBonus)) };
  }
  return normalizeTrainingState(nextProgress, currentBonus, reward, maximumBonus);
}
