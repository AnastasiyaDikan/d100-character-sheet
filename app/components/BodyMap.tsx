"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Dices, LoaderCircle, Shield } from "lucide-react";
import { adjustedEffectiveBonus, bonus, effectiveBonus, supernaturalBonus, supernaturalMultiplier, zoneDefense } from "@/lib/character/calculations";
import { rollDie } from "@/lib/character/dice";
import { createCharacterThumbnail, discordIsConnected, loadDiscordSettings, sendDiscordRoll } from "@/lib/character/discord-client";
import { hitLocationAccusative, rollHitLocation, type HitLocationResult } from "@/lib/character/hit-location";
import type { Character, HitZone } from "@/lib/character/types";

const ZONES: Array<{ id: HitZone; short: string; label: string }> = [
  { id: "head", short: "Г", label: "Голова" },
  { id: "rightArm", short: "ПР", label: "Правая рука" },
  { id: "leftArm", short: "ЛР", label: "Левая рука" },
  { id: "body", short: "К", label: "Корпус" },
  { id: "rightLeg", short: "ПН", label: "Правая нога" },
  { id: "leftLeg", short: "ЛН", label: "Левая нога" },
];

export default function BodyMap({ character }: { character: Character }) {
  const [result, setResult] = useState<(HitLocationResult & { serial: number; delivery: "idle" | "sending" | "sent" | "error" }) | null>(null);
  const baseEnduranceBonus = bonus(character, "endurance");
  const enduranceMultiplier = supernaturalMultiplier(character, "endurance");
  const enduranceAdditive = supernaturalBonus(character, "endurance");
  const normalEnduranceBonus = effectiveBonus(character, "endurance");
  const currentEnduranceBonus = adjustedEffectiveBonus(character, "endurance");
  const throwHitLocation = () => {
    const hit = rollHitLocation(() => rollDie(100));
    const serial = Date.now() + Math.random();
    const discord = loadDiscordSettings(character.characterId);
    setResult({ ...hit, serial, delivery: discordIsConnected(discord) ? "sending" : "idle" });
    if (!discordIsConnected(discord)) return;
    void createCharacterThumbnail(character).then((avatar) => sendDiscordRoll({
      webhookUrl: discord.webhookUrl,
      characterName: character.name.trim() || "Безымянный персонаж",
      avatar,
      kind: "hit-location",
      sides: 100,
      result: hit.roll,
      hitLocation: hit,
      embedColor: discord.color,
    })).then(() => setResult((current) => current?.serial === serial ? { ...current, delivery: "sent" } : current))
      .catch(() => setResult((current) => current?.serial === serial ? { ...current, delivery: "error" } : current));
  };
  return <section className="panel hit-map" data-tutorial="hit-map">
    <div className="section-heading hit-map-heading"><h2>Карта попаданий <button className="hit-location-roll-button" onClick={throwHitLocation} aria-label="Бросить карту попаданий" title="Бросить d100 по Карте попаданий"><Dices /></button></h2><span>{character.gender === "female" ? "Женщина" : "Мужчина"} · БВ {currentEnduranceBonus}{currentEnduranceBonus !== normalEnduranceBonus ? ` (обычно ${normalEnduranceBonus})` : enduranceMultiplier > 1 && baseEnduranceBonus * enduranceMultiplier >= baseEnduranceBonus + enduranceAdditive ? ` (${baseEnduranceBonus}×${enduranceMultiplier})` : enduranceAdditive > 0 ? ` (${baseEnduranceBonus}+${enduranceAdditive})` : ""}</span></div>
    {result && <output className="hit-location-result" aria-live="polite"><strong>{result.roll}</strong><span>Попадание в {hitLocationAccusative(result.location)}</span>{result.delivery !== "idle" && <small className={result.delivery}>{result.delivery === "sending" && <><LoaderCircle className="spin" /> Discord…</>}{result.delivery === "sent" && <><CheckCircle2 /> Отправлено</>}{result.delivery === "error" && <><AlertTriangle /> Не отправлено</>}</small>}</output>}
    <div className="hit-map-stage">
      <img className="body-silhouette" src={character.gender === "female" ? "/silhouette-female.png" : "/silhouette-male.png"} alt={character.gender === "female" ? "Женский силуэт" : "Мужской силуэт"} />
      {ZONES.map((zone) => <div className={`zone-chip zone-${zone.id}`} key={zone.id}><span>{zone.short}</span><strong>{zoneDefense(character, zone.id)}</strong><small>{zone.label}</small></div>)}
    </div>
    <p className="formula-note"><Shield /> доспехи + естественная броня + Бонус Выносливости с учётом усталости</p>
  </section>;
}
