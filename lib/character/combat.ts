import { fatiguedCharacteristicValue, fatiguedEffectiveBonus } from "./calculations";
import type { Character, CharacteristicId, CombatSkillRank } from "./types";

export type CombatCheckKind = "none" | "melee" | "shooting" | "both" | "parry" | "dodge" | "strength" | "skill";

export type CombatAction = {
  id: string;
  action: string;
  type: string;
  subtype: string;
  description: string;
  check: CombatCheckKind;
};

export type CombatActionValue = {
  label: string;
  value: number | null;
  explanation: string;
};

export const COMBAT_ACTIONS: CombatAction[] = [
  { id: "all-out-attack", action: "Атака всеми силами", type: "Полное", subtype: "Атака, Рукопашная", description: "Не использовать в этом раунде реакцию Избегания и получить +30 НР.", check: "melee" },
  { id: "stand-mount", action: "Встать / Оседлать / Спешиться", type: "Полу", subtype: "Движение", description: "Встать, будучи Упавшим, оседлать ездового зверя или спешиться, войти или покинуть транспорт.", check: "none" },
  { id: "delay", action: "Выжидание", type: "Полное", subtype: "Смешанный", description: "Можно сделать любое полудействие до начала своего следующего хода.", check: "none" },
  { id: "disengage", action: "Выход из боя", type: "Полное", subtype: "Движение", description: "Уйти от ближнего боя не подставляясь под свободную атаку.", check: "none" },
  { id: "grapple", action: "Захват", type: "Разный", subtype: "Атака, Рукопашная", description: "Манипуляции с Захваченным персонажем или уйти от Захвата.", check: "melee" },
  { id: "defensive-stance", action: "Защитная стойка", type: "Полное", subtype: "Концентрация, Рукопашная", description: "Получить дополнительную Реакцию. Оппонент получает -20 НР.", check: "none" },
  { id: "parry", action: "Парирование", type: "Реакция", subtype: "Рукопашная", description: "Используется с умением Парирование (Рукопашная) для избежания входящей атаки.", check: "parry" },
  { id: "dodge", action: "Уклонение", type: "Реакция", subtype: "Движение", description: "Используется с умением Уклонение (Ловкость) для избежания входящей атаки.", check: "dodge" },
  { id: "use-skill", action: "Использовать умение", type: "Разный", subtype: "Концентрация, Разный", description: "Персонаж может использовать умение.", check: "skill" },
  { id: "manoeuvre", action: "Манёвр", type: "Полу", subtype: "Рукопашная, Движение", description: "Встречная проверка НР; при успехе враг передвигается на 1 метр.", check: "melee" },
  { id: "called-shot", action: "Меткая атака", type: "Полное", subtype: "Атака любая, Концентрация", description: "Атаковать определённую зону цели с -20 НР или НС.", check: "both" },
  { id: "overwatch", action: "Наблюдение", type: "Полное", subtype: "Атака, Концентрация, Стрельба", description: "Стреляет в цели, зашедшие в зону поражения. Если персонаж во время Наблюдения исполнит любое действие или реакцию, например Избегание, его Наблюдение немедленно прекращается.", check: "shooting" },
  { id: "charge", action: "Натиск", type: "Полное", subtype: "Атака, Рукопашная, Движение", description: "Должен продвинуться хотя бы на 4 метра, +20 к НР.", check: "melee" },
  { id: "stun", action: "Оглушение", type: "Полное", subtype: "Атака, Рукопашная", description: "Попытка Оглушить оппонента. Проверка НР с -20; при успехе бросается 1к10 + БС атакующего. Если значение больше либо равно БВын и значению брони на голове атакуемого, цель оглушается на количество раундов, равное разнице между двумя значениями.", check: "melee" },
  { id: "cautious-attack", action: "Осторожная атака", type: "Полное", subtype: "Атака любая, Концентрация", description: "-10 к НС или НР, +10 ко всем проверкам Избегания до начала следующего раунда.", check: "both" },
  { id: "aim", action: "Прицелиться", type: "Разный", subtype: "Концентрация", description: "+10 за полудействие или +20 за полное действие к следующей атаке персонажа.", check: "none" },
  { id: "knock-down", action: "Сбить с ног", type: "Полу", subtype: "Атака, Рукопашная", description: "Используется как часть Натиска или сразу после полудействия движения. Встречная проверка Силы с +10; при успехе цель сбита с ног. Две и более степени успеха наносят цели урон 1к5-3 + БС и один уровень Усталости; при провале с разницей в две и более степени успеха атакующий сбит с ног.", check: "strength" },
  { id: "standard-attack", action: "Стандартная атака", type: "Полу", subtype: "Атака любая", description: "+10 НР или НС; сделать одну атаку в ближнем или дальнем бою.", check: "both" },
  { id: "feint", action: "Финт", type: "Полу", subtype: "Рукопашная", description: "Встречная проверка НР; если персонаж выиграл, от его следующей атаки нельзя увернуться или парировать её.", check: "melee" },
];

export const COMBAT_RANK_LABELS = ["Know", "+10", "+20", "+30", "+40"] as const;

export function mainSkillRank(character: Character, skillId: "parry" | "dodge"): CombatSkillRank {
  const level = character.skills.find((skill) => skill.id === skillId)?.level ?? 0;
  return Math.max(0, Math.min(5, level)) as CombatSkillRank;
}

export function selectedCombatRank(character: Character, skillId: "parry" | "dodge"): CombatSkillRank {
  const override = skillId === "parry" ? character.combatSettings.parryRank : character.combatSettings.dodgeRank;
  return override ?? mainSkillRank(character, skillId);
}

function rankModifier(rank: CombatSkillRank) {
  return [-20, 0, 10, 20, 30, 40][rank];
}

function characteristicBase(character: Character, id: CharacteristicId) {
  const value = fatiguedCharacteristicValue(character, id);
  const bonus = fatiguedEffectiveBonus(character, id);
  return { value: value + bonus, explanation: `${character.characteristics[id].short} ${value} + модификатор ${bonus}` };
}

export function sharedWeaponBonus(character: Character) {
  const settings = character.combatSettings;
  return (settings.expert ? 10 : 0) + settings.shoulderToShoulder + (settings.frenzy ? 10 : 0);
}

function attackValue(character: Character, id: "melee" | "shooting", charge = false): CombatActionValue {
  const base = characteristicBase(character, id);
  const settings = character.combatSettings;
  const additions = [
    settings.expert ? "Эксперт +10" : "",
    settings.shoulderToShoulder ? `Плечом к Плечу +${settings.shoulderToShoulder}` : "",
    settings.frenzy ? "Неистовство +10" : "",
    charge && settings.berserkerCharge ? "Натиск Берсерка +30" : "",
  ].filter(Boolean);
  const extra = sharedWeaponBonus(character) + (charge && settings.berserkerCharge ? 30 : 0);
  return {
    label: id === "melee" ? "НР" : "НС",
    value: base.value + extra,
    explanation: [base.explanation, ...additions].join("; "),
  };
}

export function combatActionValues(character: Character, action: CombatAction): CombatActionValue[] {
  if (action.check === "melee") return [attackValue(character, "melee", action.id === "charge")];
  if (action.check === "shooting") return [attackValue(character, "shooting")];
  if (action.check === "both") return [attackValue(character, "melee"), attackValue(character, "shooting")];
  if (action.check === "strength") {
    const base = characteristicBase(character, "strength");
    return [{ label: "С", value: base.value, explanation: base.explanation }];
  }
  if (action.check === "parry") {
    const base = characteristicBase(character, "melee");
    const rank = selectedCombatRank(character, "parry");
    const training = rankModifier(rank);
    const shield = character.combatSettings.shieldEnabled ? Math.max(0, character.combatSettings.shieldBonus) : 0;
    return [{
      label: "Пар",
      value: base.value + training + sharedWeaponBonus(character) + shield,
      explanation: `${base.explanation}; ${rank === 0 ? "не изучено -20" : `Парирование ${COMBAT_RANK_LABELS[rank - 1]} ${training >= 0 ? "+" : ""}${training}`}${shield ? `; Щит +${shield}` : ""}${sharedWeaponBonus(character) ? `; боевые таланты +${sharedWeaponBonus(character)}` : ""}`,
    }];
  }
  if (action.check === "dodge") {
    const base = characteristicBase(character, "agility");
    const rank = selectedCombatRank(character, "dodge");
    const training = rankModifier(rank);
    return [{
      label: "Укл",
      value: base.value + training,
      explanation: `${base.explanation}; ${rank === 0 ? "не изучено -20" : `Уклонение ${COMBAT_RANK_LABELS[rank - 1]} ${training >= 0 ? "+" : ""}${training}`}`,
    }];
  }
  if (action.check === "skill") return [{ label: "Навык", value: null, explanation: "Выберите соответствующее умение в основном чарнике." }];
  return [{ label: "—", value: null, explanation: "Проверка характеристики для этого действия не требуется." }];
}
