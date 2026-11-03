import { parseDiscordWebhookUrl } from "@/lib/character/discord";
import { feedbackDiscordPayload, parseFeedbackRequest } from "@/lib/character/feedback";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const feedback = parseFeedbackRequest(body);
  if (!feedback) return Response.json({ error: "Проверьте имя, тип и описание сообщения." }, { status: 400 });

  // Заполненное скрытое поле считается отправкой бота. Для него возвращается
  // обычный успешный ответ, но сообщение в Discord не уходит.
  if (feedback.website) return Response.json({ ok: true });

  const webhook = parseDiscordWebhookUrl(process.env.FEEDBACK_DISCORD_WEBHOOK_URL ?? "");
  if (!webhook) {
    return Response.json({ error: "Канал обратной связи ещё не подключён. Сообщите владельцу чарника." }, { status: 503 });
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feedbackDiscordPayload(feedback)),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const configurationError = [401, 403, 404].includes(response.status);
      return Response.json({
        error: configurationError
          ? "Discord отклонил канал обратной связи. Вебхук нужно обновить."
          : "Discord временно не принял сообщение. Попробуйте немного позже.",
      }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Не удалось связаться с Discord. Попробуйте немного позже." }, { status: 502 });
  }
}
