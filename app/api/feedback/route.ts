import { FEEDBACK_FORM_ENDPOINT, feedbackEmailPayload, feedbackProviderErrorText, feedbackProviderResult, parseFeedbackRequest } from "@/lib/character/feedback";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const feedback = parseFeedbackRequest(body);
  if (!feedback) return Response.json({ error: "Проверьте имя, тип и описание сообщения." }, { status: 400 });

  // A filled hidden field is treated as a bot submission without exposing that decision.
  if (feedback.website) return Response.json({ ok: true });

  try {
    let origin = "https://d100-character-sheet.nastych.workers.dev";
    try {
      if (feedback.page) origin = new URL(feedback.page).origin;
    } catch {
      // Keep the production origin when an old or hand-edited save supplies an invalid page.
    }
    const response = await fetch(FEEDBACK_FORM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: origin,
        Referer: `${origin}/`,
      },
      body: JSON.stringify(feedbackEmailPayload(feedback)),
    });
    const provider = feedbackProviderResult(await response.json().catch(() => null), response.ok);
    if (!provider.ok) {
      return Response.json({ error: feedbackProviderErrorText(provider), activationRequired: provider.activationRequired }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Не удалось отправить сообщение. Попробуйте немного позже." }, { status: 502 });
  }
}
