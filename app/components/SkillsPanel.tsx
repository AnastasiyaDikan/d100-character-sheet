"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Dices, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { experienceCost, fatigueEffect, skillThreshold } from "@/lib/character/calculations";
import { rollDie } from "@/lib/character/dice";
import { createCharacterThumbnail, discordIsConnected, loadDiscordSettings, sendDiscordRoll } from "@/lib/character/discord-client";
import { evaluateSkillCheck, type SkillCheckOutcome } from "@/lib/character/skill-check";
import type { Character, Skill } from "@/lib/character/types";

const LEVELS = ["Know", "+10", "+20", "+30", "+40"];
const EXPANDABLE = new Set(["common-lore", "forbidden-lore", "linguistics", "scholastic-lore", "trade"]);
type SkillRoll = SkillCheckOutcome & { skillId: string; serial: number; delivery: "idle" | "sending" | "sent" | "error" };

export default function SkillsPanel({ character, onChange }: { character: Character; onChange: (character: Character) => void }) {
  const [query, setQuery] = useState("");
  const [parent, setParent] = useState<Skill | null>(null);
  const [specialization, setSpecialization] = useState("");
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [skillRoll, setSkillRoll] = useState<SkillRoll | null>(null);
  const filtered = useMemo(() => character.skills.filter((skill) => skill.label.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))), [character.skills, query]);

  const setLevel = (skillId: string, level: number) => onChange({
    ...character,
    skills: character.skills.map((skill) => skill.id === skillId ? { ...skill, level: skill.level === level ? level - 1 : level } : skill),
  });

  const saveEditedLabel = (skillId: string) => {
    const label = editingLabel.trim();
    if (label) onChange({ ...character, skills: character.skills.map((skill) => skill.id === skillId ? { ...skill, label } : skill) });
    setEditingSkillId(null);
  };

  const addSpecialization = () => {
    if (!parent || !specialization.trim()) return;
    const next: Skill = {
      id: `${parent.id}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      label: `${parent.label}: ${specialization.trim()}`,
      characteristic: parent.characteristic,
      level: 0,
      custom: true,
      parentId: parent.id,
    };
    const skills = [...character.skills];
    const insertAfter = skills.reduce((last, skill, index) => skill.id === parent.id || skill.parentId === parent.id ? index : last, -1);
    skills.splice(insertAfter + 1, 0, next);
    onChange({ ...character, skills });
    setParent(null);
    setSpecialization("");
  };

  const rollSkillCheck = (skill: Skill, threshold: number) => {
    const result = rollDie(100);
    const serial = Date.now() + Math.random();
    const outcome = evaluateSkillCheck(threshold, result);
    const settings = loadDiscordSettings(character.characterId);
    setSkillRoll({ ...outcome, skillId: skill.id, serial, delivery: discordIsConnected(settings) ? "sending" : "idle" });
    if (!discordIsConnected(settings)) return;

    void createCharacterThumbnail(character).then((avatar) => sendDiscordRoll({
      webhookUrl: settings.webhookUrl,
      characterName: character.name.trim() || "Безымянный персонаж",
      avatar,
      kind: "skill",
      sides: 100,
      result,
      skillName: skill.label,
      threshold,
    })).then(() => {
      setSkillRoll((current) => current?.serial === serial ? { ...current, delivery: "sent" } : current);
    }).catch(() => {
      setSkillRoll((current) => current?.serial === serial ? { ...current, delivery: "error" } : current);
    });
  };

  return <section className="panel skills-panel" data-tutorial="skills">
    <div className="section-heading skills-heading">
      <h2>Навыки</h2>
      <label className="skills-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти навык…" aria-label="Поиск навыка" /></label>
    </div>
    <div className="skills-wrap">
      <table className="skills-table">
        <thead><tr><th>Навык</th>{LEVELS.map((level) => <th key={level}>{level}</th>)}</tr></thead>
        <tbody>{filtered.map((skill) => {
          const threshold = skillThreshold(character, skill.id);
          const currentRoll = skillRoll?.skillId === skill.id ? skillRoll : null;
          return <tr key={skill.id} className={`${skill.custom ? "custom-skill" : ""} ${fatigueEffect(character, skill.characteristic) !== "none" ? "fatigue-affected-skill" : ""}`}>
            <td><div className="skill-name-cell">{editingSkillId === skill.id ? <input className="skill-name-edit" autoFocus value={editingLabel} onChange={(event) => setEditingLabel(event.target.value)} onBlur={() => saveEditedLabel(skill.id)} onKeyDown={(event) => { if (event.key === "Enter") saveEditedLabel(skill.id); if (event.key === "Escape") setEditingSkillId(null); }} /> : <Popover open={activeSkillId === skill.id} onOpenChange={(open) => setActiveSkillId(open ? skill.id : null)}><PopoverTrigger asChild><button className="skill-name" onDoubleClick={() => { if (skill.custom) { setEditingSkillId(skill.id); setEditingLabel(skill.label); setActiveSkillId(null); } }}>{skill.label} <small>({character.characteristics[skill.characteristic].short})</small></button></PopoverTrigger><PopoverContent side="left" align="center" sideOffset={8} className="skill-threshold-popup"><div className="skill-threshold-summary"><span>{fatigueEffect(character, skill.characteristic) !== "none" ? "Порог с усталостью" : "Порог проверки"}</span><strong>{threshold}</strong><small>{skill.label}</small><button className="skill-roll-button" onClick={() => rollSkillCheck(skill, threshold)} aria-label={`Проверить навык ${skill.label}`} title={`Бросить d100 на ${skill.label}`}><Dices /><em>d100</em></button></div>{currentRoll && <output className={`skill-roll-result ${currentRoll.passed ? "passed" : "failed"}`} aria-live="polite"><strong>{currentRoll.roll}</strong><span>{currentRoll.text}</span>{currentRoll.delivery !== "idle" && <small className={`skill-roll-delivery ${currentRoll.delivery}`}>{currentRoll.delivery === "sending" && <><LoaderCircle className="spin" /> Discord…</>}{currentRoll.delivery === "sent" && <><CheckCircle2 /> Отправлено</>}{currentRoll.delivery === "error" && <><AlertTriangle /> Не отправлено</>}</small>}</output>}</PopoverContent></Popover>}{EXPANDABLE.has(skill.id) && <button className="skill-add" title="Добавить специализацию" onClick={() => setParent(skill)}><Plus /></button>}{skill.custom && <button className="skill-delete" title="Удалить навык" onClick={() => onChange({ ...character, skills: character.skills.filter((item) => item.id !== skill.id) })}><Trash2 /></button>}</div></td>
            {LEVELS.map((level, index) => <td key={level}><button className={`skill-box ${skill.level >= index + 1 ? "active" : ""}`} aria-label={`${skill.label}: ${level}`} title={index === 4 ? `Стоимость +40: ${experienceCost(character.aptitudes[skill.characteristic], 1)} опыта` : undefined} onClick={() => setLevel(skill.id, index + 1)} /></td>)}
          </tr>;
        })}</tbody>
      </table>
      {filtered.length === 0 && <p className="empty-copy">Навык не найден.</p>}
    </div>
    <Dialog open={Boolean(parent)} onOpenChange={(open) => !open && setParent(null)}>
      <DialogContent className="paper-dialog">
        <DialogHeader><DialogTitle>Новая специализация</DialogTitle><DialogDescription>{parent?.label}: укажите конкретное знание, язык или ремесло.</DialogDescription></DialogHeader>
        <label className="dialog-text-field"><span>Название</span><input autoFocus value={specialization} onChange={(event) => setSpecialization(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addSpecialization()} placeholder="Например: Кузнечное дело" /></label>
        <DialogFooter><Button className="negative-button" onClick={() => setParent(null)}>Отмена</Button><Button onClick={addSpecialization}>Добавить</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
