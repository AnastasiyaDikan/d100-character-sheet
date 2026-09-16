import { DICE_SIDES } from "./dice";

export type DiscordRollRequest = {
  webhookUrl: string;
  characterName: string;
  avatar?: string;
  test?: boolean;
  sides?: number;
  result?: number;
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
  return DICE_SIDES.includes(request.sides as typeof DICE_SIDES[number])
    && Number.isInteger(request.result)
    && Number(request.result) >= 1
    && Number(request.result) <= Number(request.sides);
}

export function discordMessagePayload(request: DiscordRollRequest, hasAvatar: boolean) {
  const characterName = request.characterName.trim().slice(0, 80) || "Безымянный персонаж";
  const username = /discord|clyde/i.test(characterName) ? "Красивый чарник D100" : characterName;
  const embed = request.test
    ? {
        title: "Подключение установлено",
        description: `Броски персонажа **${characterName}** будут появляться в этом канале.`,
        color: 0x6d281f,
      }
    : {
        author: { name: characterName },
        title: `Бросок d${request.sides}`,
        description: `# ${request.result}`,
        fields: [
          { name: "Результат", value: `**${request.result}**`, inline: true },
          { name: "Формула", value: `1к${request.sides}`, inline: true },
        ],
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
