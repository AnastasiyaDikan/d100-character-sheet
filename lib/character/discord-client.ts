import { parseDiscordWebhookUrl, type DiscordRollRequest } from "./discord";
import type { Character } from "./types";

export type DiscordSettings = { enabled: boolean; webhookUrl: string };
export const EMPTY_DISCORD_SETTINGS: DiscordSettings = { enabled: false, webhookUrl: "" };

const storageKey = (characterId: string) => `d100-discord-webhook:${characterId}`;

export function loadDiscordSettings(characterId: string): DiscordSettings {
  try {
    const stored = localStorage.getItem(storageKey(characterId));
    const parsed = stored ? JSON.parse(stored) as Partial<DiscordSettings> : null;
    return parsed && typeof parsed.webhookUrl === "string"
      ? { enabled: parsed.enabled === true, webhookUrl: parsed.webhookUrl }
      : EMPTY_DISCORD_SETTINGS;
  } catch {
    return EMPTY_DISCORD_SETTINGS;
  }
}

export function saveDiscordSettings(characterId: string, settings: DiscordSettings) {
  try { localStorage.setItem(storageKey(characterId), JSON.stringify(settings)); } catch { /* Browser storage may be unavailable. */ }
}

export function discordIsConnected(settings: DiscordSettings) {
  return settings.enabled && Boolean(parseDiscordWebhookUrl(settings.webhookUrl));
}

export async function createCharacterThumbnail(character: Pick<Character, "avatar" | "avatarCrop">) {
  if (!character.avatar) return "";
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = character.avatar;
    });
    const size = 160;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return "";
    context.fillStyle = "#191511";
    context.fillRect(0, 0, size, size);

    const containScale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
    const zoom = Math.max(1, character.avatarCrop.zoom || 1);
    const width = image.naturalWidth * containScale * zoom;
    const height = image.naturalHeight * containScale * zoom;
    const x = (size - width) / 2 + size * (character.avatarCrop.x || 0) / 100;
    const y = (size - height) / 2 + size * (character.avatarCrop.y || 0) / 100;
    context.drawImage(image, x, y, width, height);
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

export async function sendDiscordRoll(request: DiscordRollRequest) {
  const response = await fetch("/api/discord-roll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const message = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(message.error || "Не удалось отправить сообщение в Discord.");
}
