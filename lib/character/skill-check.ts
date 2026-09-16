export type SkillCheckOutcome = {
  roll: number;
  threshold: number;
  passed: boolean;
  critical: "success" | "failure" | null;
  successes: number;
  failures: number;
  text: string;
};

function successWord(value: number) {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "успехов";
  if (last === 1) return "успех";
  if (last >= 2 && last <= 4) return "успеха";
  return "успехов";
}

function failureWord(value: number) {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "провалов";
  if (last === 1) return "провал";
  if (last >= 2 && last <= 4) return "провала";
  return "провалов";
}

export function evaluateSkillCheck(threshold: number, roll: number): SkillCheckOutcome {
  const safeThreshold = Math.trunc(threshold);
  const safeRoll = Math.max(1, Math.min(100, Math.trunc(roll)));

  if (safeRoll === 100) {
    return { roll: safeRoll, threshold: safeThreshold, passed: false, critical: "failure", successes: 0, failures: 1, text: "Проверка не пройдена: критический провал!" };
  }
  if (safeRoll === 1) {
    const successes = Math.max(0, Math.floor(safeThreshold / 10)) + 1;
    return { roll: safeRoll, threshold: safeThreshold, passed: true, critical: "success", successes, failures: 0, text: `Проверка пройдена, критические ${successes} ${successWord(successes)}!` };
  }

  const difference = safeThreshold - safeRoll;
  if (difference >= 0) {
    const successes = Math.floor(difference / 10);
    return {
      roll: safeRoll,
      threshold: safeThreshold,
      passed: true,
      critical: null,
      successes,
      failures: 0,
      text: successes === 0 ? "Проверка пройдена без успехов" : `Проверка пройдена на ${successes} ${successWord(successes)}`,
    };
  }

  const failures = Math.ceil(Math.abs(difference) / 10);
  return {
    roll: safeRoll,
    threshold: safeThreshold,
    passed: false,
    critical: null,
    successes: 0,
    failures,
    text: `Проверка не пройдена: ${failures} ${failureWord(failures)}`,
  };
}
