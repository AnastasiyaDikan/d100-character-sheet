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

export function feedbackDiscordPayload(feedback: FeedbackRequest) {
  const isError = feedback.kind === "Ошибка";
  const fields = [
    { name: "Отправитель", value: feedback.sender, inline: true },
    { name: "Версия", value: feedback.version || "не указана", inline: true },
  ];
  if (feedback.page) fields.push({ name: "Страница", value: feedback.page, inline: false });

  return {
    username: "Красивый чарник D100 — обратная связь",
    allowed_mentions: { parse: [] },
    embeds: [{
      title: isError ? "Ошибка в чарнике" : "Предложение для чарника",
      description: feedback.description,
      color: isError ? 0xa33a32 : 0x3f6f8f,
      fields,
      footer: { text: "Красивый чарник D100" },
      timestamp: new Date().toISOString(),
    }],
  };
}
