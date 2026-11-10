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
 * Every ten recorded training marks permanently add +1 and start a new track.
 * Values over ten are supported for imported saves and pasted numbers.
 */
export function normalizeTrainingState(progress: unknown, bonus: unknown): TrainingState {
  const marks = wholeNonNegative(progress);
  const completed = Math.floor(marks / TRAINING_GOAL);
  const remainder = marks % TRAINING_GOAL;
  return {
    trainingProgress: remainder === 0 ? null : remainder,
    trainingBonus: wholeNonNegative(bonus) + completed,
  };
}

export function applyTrainingProgress(currentBonus: unknown, nextProgress: number | null): TrainingState {
  if (nextProgress === null) {
    return { trainingProgress: null, trainingBonus: wholeNonNegative(currentBonus) };
  }
  return normalizeTrainingState(nextProgress, currentBonus);
}
