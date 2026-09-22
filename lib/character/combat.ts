import { fatiguedCharacteristicValue, fatiguedEffectiveBonus } from "./calculations";
import type { Character, CharacteristicId, CombatSkillRank } from "./types";

export type CombatCheckKind = "none" | "melee" | "shooting" | "both" | "parry-weapon" | "parry-shield" | "dodge" | "strength" | "skill" | "counterattack";

export type CombatAction = {
  id: string;
  action: string;
  type: string;
  subtype: string;
  description: string;
  check: CombatCheckKind;
  usesWeapon?: boolean;
  dealsDamage?: boolean;
  requiresCounterattack?: boolean;
};

export type CombatActionValue = {
  label: string;
  value: number | null;
  explanation: string;
};

export const COMBAT_ACTIONS: CombatAction[] = [
  { id: "all-out-attack", action: "Атака всеми силами", type: "Полное", subtype: "Атака, Рукопашная", description: "Не использовать в этом раунде реакцию Избегания и получить +30 НР.", check: "melee", usesWeapon: true, dealsDamage: true },
  { id: "stand-mount", action: "Встать / Оседлать / Спешиться", type: "Полу", subtype: "Движение", description: "Встать, будучи Упавшим, оседлать ездового зверя или спешиться, войти или покинуть транспорт.", check: "none" },
  { id: "delay", action: "Выжидание", type: "Полное", subtype: "Смешанный", description: "Можно сделать любое полудействие до начала своего следующего хода.", check: "none" },
  { id: "disengage", action: "Выход из боя", type: "Полное", subtype: "Движение", description: "Уйти от ближнего боя не подставляясь под свободную атаку.", check: "none" },
  { id: "grapple", action: "Захват", type: "Разный", subtype: "Атака, Рукопашная", description: "Манипуляции с Захваченным персонажем или уйти от Захвата.", check: "melee" },
  { id: "defensive-stance", action: "Защитная стойка", type: "Полное", subtype: "Концентрация, Рукопашная", description: "Получить дополнительную Реакцию. Оппонент получает -20 НР.", check: "none" },
  { id: "parry-weapon", action: "Парирование (оружием)", type: "Реакция", subtype: "Рукопашная", description: "Парирование оружием. Учитывает умение Парирование, боевые таланты и общий модификатор оружия.", check: "parry-weapon", usesWeapon: true },
  { id: "parry-shield", action: "Парирование щитом", type: "Реакция", subtype: "Рукопашная", description: "Парирование щитом. Учитывает умение Парирование и указанный бонус щита, но не Эксперта во владении оружием.", check: "parry-shield" },
  { id: "dodge", action: "Уклонение", type: "Реакция", subtype: "Движение", description: "Используется с умением Уклонение (Ловкость) для избежания входящей атаки.", check: "dodge" },
  { id: "use-skill", action: "Использовать умение", type: "Разный", subtype: "Концентрация, Разный", description: "Персонаж может использовать умение.", check: "skill" },
  { id: "manoeuvre", action: "Манёвр", type: "Полу", subtype: "Рукопашная, Движение", description: "Встречная проверка НР; при успехе враг передвигается на 1 метр.", check: "melee" },
  { id: "called-shot", action: "Меткая атака", type: "Полное", subtype: "Атака любая, Концентрация", description: "Атаковать определённую зону цели с -20 НР или НС.", check: "both", usesWeapon: true, dealsDamage: true },
  { id: "overwatch", action: "Наблюдение", type: "Полное", subtype: "Атака, Концентрация, Стрельба", description: "Стреляет в цели, зашедшие в зону поражения. Если персонаж во время Наблюдения исполнит любое действие или реакцию, например Избегание, его Наблюдение немедленно прекращается.", check: "shooting", usesWeapon: true, dealsDamage: true },
  { id: "charge", action: "Натиск", type: "Полное", subtype: "Атака, Рукопашная, Движение", description: "Должен продвинуться хотя бы на 4 метра, +20 к НР.", check: "melee", usesWeapon: true, dealsDamage: true },
  { id: "stun", action: "Оглушение", type: "Полное", subtype: "Атака, Рукопашная", description: "Попытка Оглушить оппонента. Проверка НР с -20; при успехе бросается 1к10 + БС атакующего. Если значение больше либо равно БВын и значению брони на голове атакуемого, цель оглушается на количество раундов, равное разнице между двумя значениями.", check: "melee", usesWeapon: true, dealsDamage: true },
  { id: "cautious-attack", action: "Осторожная атака", type: "Полное", subtype: "Атака любая, Концентрация", description: "-10 к НС или НР, +10 ко всем проверкам Избегания до начала следующего раунда.", check: "both", usesWeapon: true, dealsDamage: true },
  { id: "knock-down", action: "Сбить с ног", type: "Полу", subtype: "Атака, Рукопашная", description: "Используется как часть Натиска или сразу после полудействия движения. Встречная проверка Силы с +10; при успехе цель сбита с ног. Две и более степени успеха наносят цели урон 1к5-3 + БС и один уровень Усталости; при провале с разницей в две и более степени успеха атакующий сбит с ног.", check: "strength" },
  { id: "standard-attack", action: "Стандартная атака", type: "Полу", subtype: "Атака любая", description: "+10 НР или НС; сделать одну атаку в ближнем или дальнем бою.", check: "both", usesWeapon: true, dealsDamage: true },
  { id: "feint", action: "Финт", type: "Полу", subtype: "Рукопашная", description: "Встречная проверка НР; если персонаж выиграл, от его следующей атаки нельзя увернуться или парировать её.", check: "melee", usesWeapon: true },
  { id: "counterattack", action: "Контратака", type: "Реакция при удачном парировании", subtype: "Рукопашная", description: "После успешного Парирования персонаж немедленно совершает ответную рукопашную атаку со штрафом -20.", check: "counterattack", usesWeapon: true, dealsDamage: true, requiresCounterattack: true },
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

function actionBonus(character: Character, action: CombatAction) {
  const fixed = action.id === "all-out-attack" ? 30 : action.id === "standard-attack" ? 10 : 0;
  const aimed = action.subtype.toLocaleLowerCase("ru").includes("атака") ? character.combatSettings.aimBonus : 0;
  return { fixed, aimed };
}

function attackValue(character: Character, id: "melee" | "shooting", action: CombatAction): CombatActionValue {
  const base = characteristicBase(character, id);
  const settings = character.combatSettings;
  const bonus = actionBonus(character, action);
  const additions = [
    settings.expert ? "Эксперт +10" : "",
    settings.shoulderToShoulder ? `Плечом к Плечу +${settings.shoulderToShoulder}` : "",
    settings.frenzy ? "Неистовство +10" : "",
    action.id === "charge" && settings.berserkerCharge ? "Натиск Берсерка +30" : "",
    bonus.fixed ? `${action.action} +${bonus.fixed}` : "",
    bonus.aimed ? `Прицеливание +${bonus.aimed}` : "",
    action.usesWeapon && settings.weaponModifier ? `Оружие ${settings.weaponModifier >= 0 ? "+" : ""}${settings.weaponModifier}` : "",
  ].filter(Boolean);
  const extra = sharedWeaponBonus(character)
    + (action.id === "charge" && settings.berserkerCharge ? 30 : 0)
    + bonus.fixed
    + bonus.aimed
    + (action.usesWeapon ? settings.weaponModifier : 0);
  return {
    label: id === "melee" ? "НР" : "НС",
    value: base.value + extra,
    explanation: [base.explanation, ...additions].join("; "),
  };
}

export function combatActionValues(character: Character, action: CombatAction): CombatActionValue[] {
  if (action.check === "counterattack") {
    const characteristic = fatiguedCharacteristicValue(character, "melee");
    const modifier = fatiguedEffectiveBonus(character, "melee");
    const expert = character.combatSettings.expert ? 10 : 0;
    const shoulder = character.combatSettings.shoulderToShoulder;
    const weaponModifier = character.combatSettings.weaponModifier;
    return [{
      label: "НР",
      value: characteristic + modifier + expert + shoulder + weaponModifier - 20,
      explanation: [`НР ${characteristic}`, `модификатор ${modifier}`, expert ? "Эксперт +10" : "", shoulder ? `Плечом к Плечу +${shoulder}` : "", weaponModifier ? `Оружие ${weaponModifier >= 0 ? "+" : ""}${weaponModifier}` : "", "Контратака -20"].filter(Boolean).join("; "),
    }];
  }
  if (action.check === "melee") return [attackValue(character, "melee", action)];
  if (action.check === "shooting") return [attackValue(character, "shooting", action)];
  if (action.check === "both") return [attackValue(character, "melee", action), attackValue(character, "shooting", action)];
  if (action.check === "strength") {
    const base = characteristicBase(character, "strength");
    const knockDownBonus = action.id === "knock-down" ? 10 : 0;
    return [{ label: "С", value: base.value + knockDownBonus, explanation: `${base.explanation}${knockDownBonus ? "; Сбить с ног +10" : ""}` }];
  }
  if (action.check === "parry-weapon" || action.check === "parry-shield") {
    const base = characteristicBase(character, "melee");
    const rank = selectedCombatRank(character, "parry");
    const training = rankModifier(rank);
    const weaponBonus = action.check === "parry-weapon"
      ? sharedWeaponBonus(character)
      : character.combatSettings.shoulderToShoulder;
    const weaponModifier = action.check === "parry-weapon" ? character.combatSettings.weaponModifier : 0;
    const shield = action.check === "parry-shield" && character.combatSettings.shieldEnabled ? Math.max(0, character.combatSettings.shieldBonus) : 0;
    return [{
      label: "Пар",
      value: base.value + training + weaponBonus + weaponModifier + shield,
      explanation: `${base.explanation}; ${rank === 0 ? "не изучено -20" : `Парирование ${COMBAT_RANK_LABELS[rank - 1]} ${training >= 0 ? "+" : ""}${training}`}${shield ? `; Щит +${shield}` : ""}${weaponBonus ? `; боевые таланты +${weaponBonus}` : ""}${weaponModifier ? `; Оружие ${weaponModifier >= 0 ? "+" : ""}${weaponModifier}` : ""}`,
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
