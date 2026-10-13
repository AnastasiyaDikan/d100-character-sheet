export const FEEDBACK_KINDS = ["Ошибка", "Предложение"] as const;
export const FEEDBACK_FORM_ENDPOINT = "https://formsubmit.co/ajax/Nastych@mail.ru";

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

export type FeedbackProviderResult = {
  ok: boolean;
  activationRequired: boolean;
  message: string;
};

/** FormSubmit returns string flags ("true"/"false") on its legacy AJAX API. */
export function feedbackProviderResult(value: unknown, responseOk: boolean): FeedbackProviderResult {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const success = input.success;
  const modernOk = input.ok;
  const message = typeof input.message === "string"
    ? input.message.trim()
    : typeof (input.error as { message?: unknown } | undefined)?.message === "string"
      ? String((input.error as { message: string }).message).trim()
      : "";
  const explicitSuccess = success === true || success === "true" || modernOk === true;
  const explicitFailure = success === false || success === "false" || modernOk === false;
  const activationRequired = /activat/i.test(message);
  return {
    ok: responseOk && (explicitSuccess || !explicitFailure && !message),
    activationRequired,
    message,
  };
}

export function feedbackProviderErrorText(result: FeedbackProviderResult): string {
  if (result.activationRequired) {
    return "Отправка почти готова: откройте письмо от FormSubmit на Nastych@mail.ru и один раз нажмите «Activate Form», затем повторите отправку.";
  }
  if (/web server|referer/i.test(result.message)) {
    return "Почтовый сервис отклонил запрос сайта. Обновите страницу и повторите отправку.";
  }
  return result.message
    ? `Почтовый сервис ответил: ${result.message}`
    : "Сервис отправки сейчас недоступен. Попробуйте немного позже.";
}
