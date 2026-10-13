"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FEEDBACK_KINDS, type FeedbackKind } from "@/lib/character/feedback";

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

  useEffect(() => {
    if (!open) return;
    setSender(defaultSender);
    setKind("Ошибка");
    setDescription("");
    setWebsite("");
    setDelivery("idle");
  }, [defaultSender, open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (delivery === "sending") return;
    setDelivery("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender,
          kind,
          description,
          website,
          version: "0.17.0",
          page: window.location.href,
        }),
      });
      if (!response.ok) throw new Error("feedback failed");
      setDelivery("sent");
    } catch {
      setDelivery("error");
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="paper-dialog feedback-dialog">
    <DialogHeader><DialogTitle>Сообщить о проблеме/предложении</DialogTitle><DialogDescription>Сообщение будет отправлено автору чарника на почту.</DialogDescription></DialogHeader>
    <form className="feedback-form" onSubmit={submit}>
      <label><span>Имя отправителя</span><input required minLength={2} maxLength={80} value={sender} onChange={(event) => setSender(event.target.value)} placeholder="Как к вам обращаться" /></label>
      <label><span>Тип сообщения</span><Select value={kind} onValueChange={(value) => setKind(value as FeedbackKind)}><SelectTrigger aria-label="Тип сообщения"><SelectValue /></SelectTrigger><SelectContent>{FEEDBACK_KINDS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label>
      <label><span>Описание</span><textarea required minLength={10} maxLength={4_000} rows={7} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что произошло или что вы предлагаете добавить?" /></label>
      <label className="feedback-honeypot" aria-hidden="true">Сайт<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
      {delivery === "sent" && <p className="feedback-status sent"><CheckCircle2 /> Сообщение отправлено. Спасибо!</p>}
      {delivery === "error" && <p className="feedback-status error"><AlertTriangle /> Не удалось отправить. Проверьте интернет и попробуйте ещё раз.</p>}
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{delivery === "sent" ? "Готово" : "Отмена"}</Button>{delivery !== "sent" && <Button type="submit" disabled={delivery === "sending" || sender.trim().length < 2 || description.trim().length < 10}>{delivery === "sending" ? <><LoaderCircle className="spin" /> Отправка…</> : <><Send /> Отправить</>}</Button>}</DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
