"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FEEDBACK_KINDS, type FeedbackKind, type FeedbackRequest } from "@/lib/character/feedback";

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

  useEffect(() => {
    if (!open) return;
    setSender(defaultSender);
    setKind("Ошибка");
    setDescription("");
    setWebsite("");
    setDelivery("idle");
    setDeliveryMessage("");
  }, [defaultSender, open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (delivery === "sending") return;

    const feedback: FeedbackRequest = {
      sender: sender.trim(),
      kind,
      description: description.trim(),
      website,
      version: "0.21.2",
      page: window.location.href,
    };

    setDelivery("sending");
    setDeliveryMessage("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedback),
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Не удалось отправить сообщение.");
      }
      setDelivery("sent");
    } catch (error) {
      setDeliveryMessage(error instanceof Error ? error.message : "Не удалось отправить сообщение.");
      setDelivery("error");
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="paper-dialog feedback-dialog">
    <DialogHeader><DialogTitle>Сообщить о проблеме/предложении</DialogTitle><DialogDescription>Сообщение будет отправлено автору чарника в Discord.</DialogDescription></DialogHeader>
    <form className="feedback-form" onSubmit={submit}>
      <label><span>Имя отправителя</span><input required minLength={2} maxLength={80} value={sender} onChange={(event) => setSender(event.target.value)} placeholder="Как к вам обращаться" /></label>
      <label><span>Тип сообщения</span><Select value={kind} onValueChange={(value) => setKind(value as FeedbackKind)}><SelectTrigger aria-label="Тип сообщения"><SelectValue /></SelectTrigger><SelectContent>{FEEDBACK_KINDS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label>
      <label><span>Описание</span><textarea required minLength={10} maxLength={4_000} rows={7} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что произошло или что вы предлагаете добавить?" /></label>
      <label className="feedback-honeypot" aria-hidden="true">Сайт<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
      {delivery === "sent" && <p className="feedback-status sent"><CheckCircle2 /> Сообщение доставлено в Discord. Спасибо!</p>}
      {delivery === "error" && <div className="feedback-status error"><AlertTriangle /><span>{deliveryMessage || "Не удалось отправить сообщение."}</span></div>}
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{delivery === "sent" ? "Готово" : "Отмена"}</Button>{delivery !== "sent" && <Button type="submit" disabled={delivery === "sending" || sender.trim().length < 2 || description.trim().length < 10}>{delivery === "sending" ? <><LoaderCircle className="spin" /> Отправка…</> : <><Send /> Отправить</>}</Button>}</DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
