import { DICE_SIDES } from "./dice";
import { evaluateSkillCheck } from "./skill-check";
import { formatWeaponDamage, type WeaponDamageResult } from "./weapon-damage";

export type DiscordRollRequest = {
  webhookUrl: string;
  characterName: string;
  avatar?: string;
  test?: boolean;
  kind?: "simple" | "skill" | "combat" | "characteristic";
  sides?: number;
  result?: number;
  skillName?: string;
  characteristicName?: string;
  threshold?: number;
  actionName?: string;
  checkLabel?: string;
  damage?: WeaponDamageResult;
};

export function parseDiscordWebhookUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const path = url.pathname.replace(/\/+$/, "");
    if (url.protocol !== "https:" || url.hostname !== "discord.com") return null;
    if (!/^\/api(?:\/v\d+)?\/webhooks\/\d+\/[A-Za-z0-9._-]+$/.test(path)) return null;
    url.pathname = path;
    url.search = "";
    url.hash = "";
    url.searchParams.set("wait", "true");
    return url;
  } catch {
    return null;
  }
}

export function validDiscordRoll(request: DiscordRollRequest) {
  if (request.test === true) return true;
  const validDie = DICE_SIDES.includes(request.sides as typeof DICE_SIDES[number])
    && Number.isInteger(request.result)
    && Number(request.result) >= 1
    && Number(request.result) <= Number(request.sides);
  if (!validDie) return false;
  if (request.kind !== "skill" && request.kind !== "combat" && request.kind !== "characteristic") return true;
  const validThreshold = request.sides === 100
    && Number.isInteger(request.threshold)
    && Number(request.threshold) >= -100
    && Number(request.threshold) <= 500;
  if (!validThreshold) return false;
  if (request.kind === "skill") return typeof request.skillName === "string"
    && request.skillName.trim().length >= 1
    && request.skillName.trim().length <= 120;
  if (request.kind === "characteristic") return typeof request.characteristicName === "string"
    && request.characteristicName.trim().length >= 1
    && request.characteristicName.trim().length <= 120;
  const validCombat = typeof request.actionName === "string"
    && request.actionName.trim().length >= 1
    && request.actionName.trim().length <= 120
    && typeof request.checkLabel === "string"
    && request.checkLabel.trim().length >= 1
    && request.checkLabel.trim().length <= 40;
  if (!validCombat || request.damage === undefined) return validCombat;
  const damage = request.damage;
  const validLegacyRolls = Number.isInteger(damage.sides) && damage.sides >= 2 && damage.sides <= 1000
    && Array.isArray(damage.rolls) && damage.rolls.length === damage.diceCount
    && damage.rolls.every((roll) => Number.isInteger(roll) && roll >= 1 && roll <= damage.sides);
  const validDetailedRolls = Array.isArray(damage.rollDetails)
    && damage.rollDetails.length === damage.diceCount
    && damage.rollDetails.every((roll) => Number.isInteger(roll.sides) && roll.sides >= 2 && roll.sides <= 1000 && Number.isInteger(roll.value) && roll.value >= 1 && roll.value <= roll.sides);
  return typeof damage.weaponName === "string"
    && damage.weaponName.trim().length >= 1
    && damage.weaponName.trim().length <= 120
    && Number.isInteger(damage.diceCount) && damage.diceCount >= 1 && damage.diceCount <= 150
    && (validDetailedRolls || validLegacyRolls)
    && Number.isFinite(damage.characteristicModifier)
    && Number.isFinite(damage.fixedModifier)
    && Number.isFinite(damage.total);
}

export function discordMessagePayload(request: DiscordRollRequest, hasAvatar: boolean) {
  const characterName = request.characterName.trim().slice(0, 80) || "Безымянный персонаж";
  const username = /discord|clyde/i.test(characterName) ? "Красивый чарник D100" : characterName;
  const embed: Record<string, unknown> = request.test
    ? {
        title: "Подключение установлено",
        description: `Броски персонажа **${characterName}** будут появляться в этом канале.`,
        color: 0x6d281f,
      }
    : request.kind === "skill" || request.kind === "combat" || request.kind === "characteristic"
      ? (() => {
          const outcome = evaluateSkillCheck(Number(request.threshold), Number(request.result));
          const damageText = request.kind === "combat" && request.damage
            ? `\n\n**Урон — ${request.damage.weaponName}**\n${Array.isArray(request.damage.rollDetails) ? formatWeaponDamage(request.damage) : `${request.damage.diceCount}d${request.damage.sides}: ${request.damage.rolls.join(" + ")} ${request.damage.characteristicModifier >= 0 ? "+" : "−"} ${Math.abs(request.damage.characteristicModifier)}${request.damage.fixedModifier ? ` ${request.damage.fixedModifier >= 0 ? "+" : "−"} ${Math.abs(request.damage.fixedModifier)}` : ""} = **${request.damage.total}**`}`
            : "";
          return {
            author: { name: characterName },
            title: request.kind === "skill"
              ? `Бросок навыка «${request.skillName?.trim()}» d100`
              : request.kind === "characteristic"
                ? `Проверка характеристики «${request.characteristicName?.trim()}» d100`
                : `Боевое действие «${request.actionName?.trim()}» — ${request.checkLabel?.trim()}`,
            description: `Порог — ${request.threshold}\n# ${request.result}\n**${outcome.text}**${damageText}`,
            color: outcome.passed ? 0x477a45 : 0x8f3028,
          };
        })()
    : {
        author: { name: characterName },
        title: `Бросок d${request.sides}`,
        description: `# ${request.result}`,
        color: 0x6d281f,
      };

  if (hasAvatar) Object.assign(embed, { thumbnail: { url: "attachment://character-avatar.png" } });

  return {
    username,
    allowed_mentions: { parse: [] as string[] },
    embeds: [embed],
    ...(hasAvatar ? { attachments: [{ id: 0, filename: "character-avatar.png" }] } : {}),
  };
}
