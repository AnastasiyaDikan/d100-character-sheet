"use client";

import { useState } from "react";
import { Dices, X } from "lucide-react";
import { DICE_SIDES, rollDie } from "@/lib/character/dice";

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

export default function DiceRoller() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ sides: number; value: number; serial: number } | null>(null);
  const throwDie = (sides: number) => setResult({ sides, value: rollDie(sides), serial: Date.now() });

  return <div className={`dice-widget ${open ? "open" : ""}`}>
    {!open ? <button className="dice-launch" onClick={() => setOpen(true)} aria-label="Открыть бросок кубиков" title="Бросить кубик"><Dices /></button> : <div className="dice-table" role="group" aria-label="Выбор игрового кубика">
      {result && <output key={result.serial} className="dice-result" aria-live="polite"><small>d{result.sides}</small><strong>{result.value}</strong></output>}
      {DICE_SIDES.map((sides) => <button key={sides} className={`polyhedral-die die-d${sides}`} onClick={() => throwDie(sides)} aria-label={`Бросить d${sides}`} title={`Бросить d${sides}`}><DieIcon sides={sides} /></button>)}
      <button className="dice-close" onClick={() => setOpen(false)} aria-label="Закрыть кубики"><X /></button>
    </div>}
  </div>;
}
