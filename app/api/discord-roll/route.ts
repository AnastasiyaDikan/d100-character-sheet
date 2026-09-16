import { discordMessagePayload, parseDiscordWebhookUrl, validDiscordRoll, type DiscordRollRequest } from "@/lib/character/discord";

const MAX_AVATAR_BYTES = 3_500_000;
const IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/;

function avatarBlob(value?: string) {
  const match = value?.match(IMAGE_DATA_URL);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    if (binary.length > MAX_AVATAR_BYTES) return null;
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: match[1] === "image/jpg" ? "image/jpeg" : match[1] });
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: DiscordRollRequest;
  try {
    body = await request.json() as DiscordRollRequest;
  } catch {
    return Response.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const webhookUrl = parseDiscordWebhookUrl(body.webhookUrl ?? "");
  const characterName = typeof body.characterName === "string" ? body.characterName.trim() : "";
  if (!webhookUrl || !characterName || characterName.length > 80 || !validDiscordRoll(body)) {
    return Response.json({ error: "Проверьте адрес вебхука и данные броска." }, { status: 400 });
  }

  const avatar = avatarBlob(body.avatar);
  const form = new FormData();
  form.append("payload_json", JSON.stringify(discordMessagePayload(body, Boolean(avatar))));
  if (avatar) form.append("files[0]", avatar, "character-avatar.png");

  try {
    const response = await fetch(webhookUrl, { method: "POST", body: form });
    if (!response.ok) {
      return Response.json({ error: "Discord отклонил вебхук. Проверьте, что он ещё существует." }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Не удалось связаться с Discord." }, { status: 502 });
  }
}
