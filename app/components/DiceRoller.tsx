"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Dices, Eye, EyeOff, LoaderCircle, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DICE_SIDES, rollDie } from "@/lib/character/dice";
import { parseDiscordWebhookUrl } from "@/lib/character/discord";
import type { Character } from "@/lib/character/types";

type DiscordSettings = { enabled: boolean; webhookUrl: string };
type DeliveryState = "idle" | "sending" | "sent" | "error";

const EMPTY_DISCORD: DiscordSettings = { enabled: false, webhookUrl: "" };
const discordStorageKey = (characterId: string) => `d100-discord-webhook:${characterId}`;

function avatarForDiscord(avatar: string) {
  return avatar.startsWith("data:image/") && avatar.length <= 4_800_000 ? avatar : "";
}

async function sendToDiscord(body: Record<string, unknown>) {
  const response = await fetch("/api/discord-roll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const message = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(message.error || "Не удалось отправить сообщение в Discord.");
}

function DiscordConnectionDialog({ open, settings, character, onOpenChange, onSave }: {
  open: boolean;
  settings: DiscordSettings;
  character: Pick<Character, "name" | "avatar">;
  onOpenChange: (open: boolean) => void;
  onSave: (settings: DiscordSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [visible, setVisible] = useState(false);
  const [testState, setTestState] = useState<DeliveryState>("idle");
  const [testError, setTestError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(settings);
    setVisible(false);
    setTestState("idle");
    setTestError("");
  }, [open, settings]);

  const validUrl = Boolean(parseDiscordWebhookUrl(draft.webhookUrl));
  const testConnection = async () => {
    if (!validUrl) return;
    setTestState("sending");
    setTestError("");
    try {
      await sendToDiscord({
        webhookUrl: draft.webhookUrl.trim(),
        characterName: character.name.trim() || "Безымянный персонаж",
        avatar: avatarForDiscord(character.avatar),
        test: true,
      });
      setTestState("sent");
    } catch (error) {
      setTestState("error");
      setTestError(error instanceof Error ? error.message : "Не удалось проверить подключение.");
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="paper-dialog discord-dialog">
      <DialogHeader>
        <DialogTitle>Подключение бросков к Discord</DialogTitle>
        <DialogDescription>Вставьте URL вебхука нужного канала. Он хранится только в этом браузере и не попадает в JSON персонажа.</DialogDescription>
      </DialogHeader>
      <label className="discord-url-field">
        <span>URL вебхука Discord</span>
        <span className="discord-url-input"><input type={visible ? "text" : "password"} value={draft.webhookUrl} placeholder="https://discord.com/api/webhooks/…" autoComplete="off" spellCheck={false} onChange={(event) => { setDraft({ ...draft, webhookUrl: event.target.value }); setTestState("idle"); }} /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Скрыть URL" : "Показать URL"}>{visible ? <EyeOff /> : <Eye />}</button></span>
      </label>
      {draft.webhookUrl && !validUrl && <p className="discord-warning"><AlertTriangle /> Нужна полная ссылка вида https://discord.com/api/webhooks/…</p>}
      <label className="discord-enable"><Checkbox checked={draft.enabled} onCheckedChange={(checked) => setDraft({ ...draft, enabled: checked === true })} /> Дублировать новые броски в этот канал</label>
      <div className="discord-test-row">
        <Button type="button" variant="outline" disabled={!validUrl || testState === "sending"} onClick={testConnection}>{testState === "sending" ? <LoaderCircle className="spin" /> : <Send />} Проверить подключение</Button>
        {testState === "sent" && <span className="discord-success"><CheckCircle2 /> Проверочное сообщение отправлено</span>}
        {testState === "error" && <span className="discord-warning"><AlertTriangle /> {testError}</span>}
      </div>
      <p className="discord-secret-note"><strong>Важно:</strong> URL вебхука — секретный ключ канала. Не публикуйте его в Git, сообщениях или скриншотах. При утечке удалите вебхук в Discord и создайте новый.</p>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button><Button className="fantasy-button" disabled={!validUrl} onClick={() => onSave({ enabled: draft.enabled, webhookUrl: draft.webhookUrl.trim() })}>Сохранить</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function DieIcon({ sides }: { sides: typeof DICE_SIDES[number] }) {
  const polygons: Record<number, string> = {
    4: "24,4 45,42 3,42",
    6: "7,7 41,7 41,41 7,41",
    8: "24,3 44,24 24,45 4,24",
    10: "24,3 44,18 36,44 12,44 4,18",
    12: "13,5 35,5 45,24 35,43 13,43 3,24",
    20: "24,2 44,14 39,38 24,46 9,38 4,14",
  };
  return <svg viewBox="0 0 48 48" aria-hidden="true">
    {sides === 100 ? <circle cx="24" cy="24" r="20" /> : <polygon points={polygons[sides]} />}
    {sides === 4 && <path d="M24 4v38M3 42l21-13 21 13" />}
    {sides === 8 && <path d="M4 24h40M24 3l-10 21 10 21 10-21z" />}
    {sides === 10 && <path d="M4 18h40M24 3l-8 15 8 26 8-26z" />}
    {sides === 12 && <path d="M13 5l5 13-15 6m32-19-5 13 15 6M13 43l5-13-15-6m32 19-5-13 15-6M18 18h12l6 12-12 8-12-8z" />}
    {sides === 20 && <path d="M4 14l20 10 20-10M9 38l15-14 15 14M24 2v44" />}
    <text x="24" y={sides === 4 ? "36" : "28"}>d{sides}</text>
  </svg>;
}

export default function DiceRoller({ character }: { character: Character }) {
  const [open, setOpen] = useState(false);
  const [discordOpen, setDiscordOpen] = useState(false);
  const [settings, setSettings] = useState<DiscordSettings>(EMPTY_DISCORD);
  const [delivery, setDelivery] = useState<DeliveryState>("idle");
  const [result, setResult] = useState<{ sides: number; value: number; serial: number } | null>(null);
  const latestRoll = useRef(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(discordStorageKey(character.characterId));
      const parsed = stored ? JSON.parse(stored) as Partial<DiscordSettings> : null;
      setSettings(parsed && typeof parsed.webhookUrl === "string"
        ? { enabled: parsed.enabled === true, webhookUrl: parsed.webhookUrl }
        : EMPTY_DISCORD);
    } catch {
      setSettings(EMPTY_DISCORD);
    }
    setDelivery("idle");
  }, [character.characterId]);

  const saveSettings = (next: DiscordSettings) => {
    setSettings(next);
    try { localStorage.setItem(discordStorageKey(character.characterId), JSON.stringify(next)); } catch { /* Browser storage may be unavailable. */ }
    setDiscordOpen(false);
  };

  const throwDie = (sides: number) => {
    const value = rollDie(sides);
    const serial = Date.now() + Math.random();
    latestRoll.current = serial;
    setResult({ sides, value, serial });
    setDelivery("idle");
    if (!settings.enabled || !parseDiscordWebhookUrl(settings.webhookUrl)) return;
    setDelivery("sending");
    void sendToDiscord({
      webhookUrl: settings.webhookUrl,
      characterName: character.name.trim() || "Безымянный персонаж",
      avatar: avatarForDiscord(character.avatar),
      sides,
      result: value,
    }).then(() => {
      if (latestRoll.current === serial) setDelivery("sent");
    }).catch(() => {
      if (latestRoll.current === serial) setDelivery("error");
    });
  };

  const connected = settings.enabled && Boolean(parseDiscordWebhookUrl(settings.webhookUrl));
  return <div className={`dice-widget ${open ? "open" : ""}`}>
    {!open ? <button className={`dice-launch ${connected ? "discord-connected" : ""}`} onClick={() => setOpen(true)} aria-label="Открыть бросок кубиков" title="Бросить кубик"><Dices /></button> : <div className="dice-table" role="group" aria-label="Выбор игрового кубика">
      {result && <output key={result.serial} className="dice-result" aria-live="polite"><span><small>d{result.sides}</small><strong>{result.value}</strong></span>{delivery !== "idle" && <em className={`dice-delivery ${delivery}`}>{delivery === "sending" && <><LoaderCircle className="spin" /> Discord…</>}{delivery === "sent" && <><CheckCircle2 /> Отправлено</>}{delivery === "error" && <><AlertTriangle /> Не отправлено</>}</em>}</output>}
      {DICE_SIDES.map((sides) => <button key={sides} className={`polyhedral-die die-d${sides}`} onClick={() => throwDie(sides)} aria-label={`Бросить d${sides}`} title={`Бросить d${sides}`}><DieIcon sides={sides} /></button>)}
      <div className="dice-center-controls"><button className="dice-close" onClick={() => setOpen(false)} aria-label="Закрыть кубики"><X /></button><button className={`dice-discord-open ${connected ? "connected" : ""}`} onClick={() => setDiscordOpen(true)} aria-label="Настроить Discord" title="Подключить броски к Discord"><MessageCircle /><span>Discord</span></button></div>
    </div>}
    <DiscordConnectionDialog open={discordOpen} settings={settings} character={character} onOpenChange={setDiscordOpen} onSave={saveSettings} />
  </div>;
}
