import { feedbackEmailPayload, parseFeedbackRequest } from "@/lib/character/feedback";

const FORM_ENDPOINT = "https://formsubmit.co/ajax/Nastych@mail.ru";

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
    const response = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(feedbackEmailPayload(feedback)),
    });
    if (!response.ok) throw new Error("feedback service rejected request");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Не удалось отправить сообщение. Попробуйте немного позже." }, { status: 502 });
  }
}
