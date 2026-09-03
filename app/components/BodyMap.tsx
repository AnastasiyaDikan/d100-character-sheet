"use client";

import { Shield } from "lucide-react";
import { bonus, zoneDefense } from "@/lib/character/calculations";
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
  return <section className="panel hit-map" data-tutorial="hit-map">
    <div className="section-heading"><h2>Карта попаданий</h2><span>{character.gender === "female" ? "Женщина" : "Мужчина"} · БВ {bonus(character, "endurance")}</span></div>
    <div className="hit-map-stage">
      <img className="body-silhouette" src={character.gender === "female" ? "/silhouette-female.png" : "/silhouette-male.png"} alt={character.gender === "female" ? "Женский силуэт" : "Мужской силуэт"} />
      {ZONES.map((zone) => <div className={`zone-chip zone-${zone.id}`} key={zone.id}><span>{zone.short}</span><strong>{zoneDefense(character, zone.id)}</strong><small>{zone.label}</small></div>)}
    </div>
    <p className="formula-note"><Shield /> доспехи + естественная броня + Бонус Выносливости</p>
  </section>;
}
