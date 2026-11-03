"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FEEDBACK_KINDS, FEEDBACK_NATIVE_FORM_ENDPOINT, feedbackMailtoUrl, type FeedbackKind, type FeedbackRequest } from "@/lib/character/feedback";

type Delivery = "idle" | "sending" | "sent" | "error";

export default function FeedbackDialog({ open, defaultSender, onOpenChange }: {
  open: boolean;
  defaultSender: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [sender, setSender] = useState("");
  const [kind, setKind] = useState<FeedbackKind>("Ошибка");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("idle");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const submittedRef = useRef(false);
  const confirmationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const feedback: FeedbackRequest = {
    sender: sender.trim(),
    kind,
    description: description.trim(),
    website,
    version: "0.19.2",
    page: typeof window === "undefined" ? "" : window.location.href,
  };

  useEffect(() => {
    if (confirmationTimerRef.current) {
      clearTimeout(confirmationTimerRef.current);
      confirmationTimerRef.current = null;
    }
    submittedRef.current = false;
    if (!open) return;
    setSender(defaultSender);
    setKind("Ошибка");
    setDescription("");
    setWebsite("");
    setDelivery("idle");
    setDeliveryMessage("");
  }, [defaultSender, open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    if (delivery === "sending") {
      event.preventDefault();
      return;
    }
    setDelivery("sending");
    setDeliveryMessage("");
    if (website.trim()) {
      event.preventDefault();
      setDelivery("sent");
      return;
    }
    submittedRef.current = true;
    confirmationTimerRef.current = setTimeout(() => {
      if (!submittedRef.current) return;
      submittedRef.current = false;
      setDeliveryMessage("Почтовый сервис не подтвердил отправку. Попробуйте ещё раз или откройте готовое письмо вручную.");
      setDelivery("error");
    }, 20_000);
  };

  const confirmNativeSubmission = () => {
    if (!submittedRef.current) return;
    submittedRef.current = false;
    if (confirmationTimerRef.current) clearTimeout(confirmationTimerRef.current);
    confirmationTimerRef.current = null;
    setDelivery("sent");
    setDeliveryMessage("");
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="paper-dialog feedback-dialog">
    <DialogHeader><DialogTitle>Сообщить о проблеме/предложении</DialogTitle><DialogDescription>Сообщение будет отправлено автору чарника на почту.</DialogDescription></DialogHeader>
    <form className="feedback-form" action={FEEDBACK_NATIVE_FORM_ENDPOINT} method="POST" target="feedback-submit-frame" onSubmit={submit}>
      <input type="hidden" name="_subject" value={`[Чарник D100][${kind}] ${sender.trim()}`} />
      <input type="hidden" name="_template" value="table" />
      <input type="hidden" name="_captcha" value="false" />
      <input type="hidden" name="Тип сообщения" value={kind} />
      <input type="hidden" name="Версия" value={feedback.version} />
      <input type="hidden" name="Страница" value={feedback.page} />
      <input type="hidden" name="_url" value={feedback.page} />
      <label><span>Имя отправителя</span><input name="Имя отправителя" required minLength={2} maxLength={80} value={sender} onChange={(event) => setSender(event.target.value)} placeholder="Как к вам обращаться" /></label>
      <label><span>Тип сообщения</span><Select value={kind} onValueChange={(value) => setKind(value as FeedbackKind)}><SelectTrigger aria-label="Тип сообщения"><SelectValue /></SelectTrigger><SelectContent>{FEEDBACK_KINDS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label>
      <label><span>Описание</span><textarea name="Описание" required minLength={10} maxLength={4_000} rows={7} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что произошло или что вы предлагаете добавить?" /></label>
      <label className="feedback-honeypot" aria-hidden="true">Сайт<input name="_honey" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
      {delivery === "sent" && <p className="feedback-status sent"><CheckCircle2 /> Сообщение передано. Спасибо! При первой отправке подтвердите FormSubmit в письме на почте.</p>}
      {delivery === "error" && <div className="feedback-status error"><AlertTriangle /><span>{deliveryMessage || "Не удалось отправить сообщение."}</span><a href={feedbackMailtoUrl(feedback)}><Mail /> Открыть письмо вручную</a></div>}
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{delivery === "sent" ? "Готово" : "Отмена"}</Button>{delivery !== "sent" && <Button type="submit" disabled={delivery === "sending" || sender.trim().length < 2 || description.trim().length < 10}>{delivery === "sending" ? <><LoaderCircle className="spin" /> Отправка…</> : <><Send /> Отправить</>}</Button>}</DialogFooter>
    </form>
    <iframe name="feedback-submit-frame" title="Отправка сообщения" hidden onLoad={confirmNativeSubmission} />
  </DialogContent></Dialog>;
}
