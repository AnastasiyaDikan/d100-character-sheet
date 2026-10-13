export const FEEDBACK_KINDS = ["Ошибка", "Предложение"] as const;

export type FeedbackKind = typeof FEEDBACK_KINDS[number];

export type FeedbackRequest = {
  sender: string;
  kind: FeedbackKind;
  description: string;
  website?: string;
  version?: string;
  page?: string;
};

export function parseFeedbackRequest(value: unknown): FeedbackRequest | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const sender = typeof input.sender === "string" ? input.sender.trim() : "";
  const kind = typeof input.kind === "string" && FEEDBACK_KINDS.includes(input.kind as FeedbackKind)
    ? input.kind as FeedbackKind
    : null;
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const website = typeof input.website === "string" ? input.website.trim() : "";
  const version = typeof input.version === "string" ? input.version.trim().slice(0, 20) : "";
  const page = typeof input.page === "string" ? input.page.trim().slice(0, 300) : "";

  if (sender.length < 2 || sender.length > 80 || !kind || description.length < 10 || description.length > 4_000) return null;
  return { sender, kind, description, website, version, page };
}

export function feedbackEmailPayload(feedback: FeedbackRequest) {
  return {
    _subject: `[Чарник D100][${feedback.kind}] ${feedback.sender}`,
    _template: "table",
    _captcha: "false",
    "Имя отправителя": feedback.sender,
    "Тип сообщения": feedback.kind,
    Описание: feedback.description,
    Версия: feedback.version || "не указана",
    Страница: feedback.page || "не указана",
  };
}
