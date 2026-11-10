"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Dices, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { experienceCost, fatigueEffect, skillBaseThreshold, skillEffectiveLevel, skillThreshold, skillTrainingBonus } from "@/lib/character/calculations";
import { CHARACTERISTICS } from "@/lib/character/data";
import { rollDie } from "@/lib/character/dice";
import { createCharacterThumbnail, discordIsConnected, loadDiscordSettings, sendDiscordRoll } from "@/lib/character/discord-client";
import { evaluateSkillCheck, type SkillCheckOutcome } from "@/lib/character/skill-check";
import { specializationCharacteristic as selectedSpecializationCharacteristic } from "@/lib/character/skills";
import { applyTrainingProgress, TRAINING_GOAL } from "@/lib/character/training";
import type { Character, CharacteristicId, Skill } from "@/lib/character/types";

const LEVELS = ["Know", "+10", "+20", "+30", "+40"];
const EXPANDABLE = new Set(["common-lore", "forbidden-lore", "linguistics", "scholastic-lore", "trade"]);
type SkillRoll = SkillCheckOutcome & { skillId: string; serial: number; delivery: "idle" | "sending" | "sent" | "error" };

export default function SkillsPanel({ character, onChange }: { character: Character; onChange: (character: Character) => void }) {
  const [query, setQuery] = useState("");
  const [parent, setParent] = useState<Skill | null>(null);
  const [specialization, setSpecialization] = useState("");
  const [specializationCharacteristic, setSpecializationCharacteristic] = useState<CharacteristicId>("intelligence");
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [skillRoll, setSkillRoll] = useState<SkillRoll | null>(null);
  const orderedSkills = useMemo(() => {
    const children = new Map<string, Skill[]>();
    for (const skill of character.skills) {
      if (!skill.parentId) continue;
      children.set(skill.parentId, [...(children.get(skill.parentId) ?? []), skill]);
    }
    const included = new Set<string>();
    const result: Skill[] = [];
    for (const skill of character.skills) {
      if (skill.parentId) continue;
      result.push(skill);
      included.add(skill.id);
      for (const child of children.get(skill.id) ?? []) {
        result.push(child);
        included.add(child.id);
      }
    }
    for (const skill of character.skills) if (!included.has(skill.id)) result.push(skill);
    return result;
  }, [character.skills]);
  const filtered = useMemo(() => orderedSkills.filter((skill) => skill.label.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))), [orderedSkills, query]);

  const setLevel = (skillId: string, level: number) => onChange({
    ...character,
    skills: character.skills.map((skill) => {
      if (skill.id !== skillId) return skill;
      const inGameLevels = skillTrainingBonus(character, skill.id);
      const effectiveLevel = skillEffectiveLevel(character, skill.id);
      const requestedTotal = effectiveLevel === level ? level - 1 : level;
      return { ...skill, level: Math.max(0, Math.min(5 - inGameLevels, requestedTotal - inGameLevels)) };
    }),
  });

  const saveEditedLabel = (skillId: string) => {
    const label = editingLabel.trim();
    if (label) onChange({ ...character, skills: character.skills.map((skill) => skill.id === skillId ? { ...skill, label } : skill) });
    setEditingSkillId(null);
  };

  const openSpecializationDialog = (skill: Skill) => {
    setParent(skill);
    setSpecialization("");
    setSpecializationCharacteristic(skill.characteristic);
  };

  const closeSpecializationDialog = () => {
    setParent(null);
    setSpecialization("");
    setSpecializationCharacteristic("intelligence");
  };

  const addSpecialization = () => {
    if (!parent || !specialization.trim()) return;
    const next: Skill = {
      id: `${parent.id}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      label: `${parent.label}: ${specialization.trim()}`,
      characteristic: selectedSpecializationCharacteristic(parent, specializationCharacteristic),
      level: 0,
      custom: true,
      parentId: parent.id,
      trainingProgress: null,
      trainingBonus: 0,
    };
    const skills = [...character.skills];
    const insertAfter = skills.reduce((last, skill, index) => skill.id === parent.id || skill.parentId === parent.id ? index : last, -1);
    skills.splice(insertAfter + 1, 0, next);
    onChange({ ...character, skills });
    closeSpecializationDialog();
  };

  const updateTraining = (skill: Skill, rawValue: string) => {
    const next = rawValue === "" ? null : Number(rawValue);
    const training = applyTrainingProgress(skill.trainingBonus, next, 1, Math.max(0, 5 - skill.level));
    onChange({
      ...character,
      skills: character.skills.map((item) => item.id === skill.id ? { ...item, ...training } : item),
    });
  };

  const updateTrainingBonus = (skill: Skill, rawValue: string) => {
    const parsed = rawValue === "" ? 0 : Number(rawValue);
    const trainingBonus = Number.isFinite(parsed)
      ? Math.max(0, Math.min(5 - skill.level, Math.trunc(parsed)))
      : 0;
    onChange({
      ...character,
      skills: character.skills.map((item) => item.id === skill.id ? { ...item, trainingBonus } : item),
    });
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
      embedColor: settings.color,
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
          const baseThreshold = skillBaseThreshold(character, skill.id);
          const inGameTraining = skillTrainingBonus(character, skill.id);
          const effectiveLevel = skillEffectiveLevel(character, skill.id);
          const currentRoll = skillRoll?.skillId === skill.id ? skillRoll : null;
          return <tr key={skill.id} className={`${skill.custom ? "custom-skill" : ""} ${fatigueEffect(character, skill.characteristic) !== "none" ? "fatigue-affected-skill" : ""}`}>
            <td>
              <div className="skill-name-cell">
                {editingSkillId === skill.id
                  ? <input className="skill-name-edit" autoFocus value={editingLabel} onChange={(event) => setEditingLabel(event.target.value)} onBlur={() => saveEditedLabel(skill.id)} onKeyDown={(event) => { if (event.key === "Enter") saveEditedLabel(skill.id); if (event.key === "Escape") setEditingSkillId(null); }} />
                  : <Popover open={activeSkillId === skill.id} onOpenChange={(open) => setActiveSkillId(open ? skill.id : null)}>
                    <PopoverTrigger asChild><button className="skill-name" onDoubleClick={() => { if (skill.custom) { setEditingSkillId(skill.id); setEditingLabel(skill.label); setActiveSkillId(null); } }}>{skill.label} <small>({character.characteristics[skill.characteristic].short})</small></button></PopoverTrigger>
                    <PopoverContent side="left" align="center" sideOffset={8} className="skill-threshold-popup">
                      <div className="skill-threshold-summary"><span>{fatigueEffect(character, skill.characteristic) !== "none" ? "Порог с усталостью" : "Порог проверки"}</span><strong>{threshold}</strong><small>{skill.label}</small><button className="skill-roll-button" onClick={() => rollSkillCheck(skill, threshold)} aria-label={`Проверить навык ${skill.label}`} title={`Бросить d100 на ${skill.label}`}><Dices /><em>d100</em></button></div>
                      <dl className="skill-training-breakdown">
                        <div><dt>Базовый порог</dt><dd>{baseThreshold}</dd></div>
                        <div><dt>Куплено точек</dt><dd>{skill.level}</dd></div>
                        <div className="training-bonus-edit"><dt>Ингейм-точки</dt><dd><input type="number" min="0" max={Math.max(0, 5 - skill.level)} value={inGameTraining || ""} placeholder="0" aria-label={`Ингеймовые точки: ${skill.label}`} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateTrainingBonus(skill, event.target.value)} /></dd></div>
                        <div><dt>Всего точек</dt><dd>{effectiveLevel}</dd></div>
                      </dl>
                      <small className="skill-training-hint">Каждые 10 отметок открывают следующую точку навыка. Ингейм-точки можно исправить или удалить вручную.</small>
                      {currentRoll && <output className={`skill-roll-result ${currentRoll.passed ? "passed" : "failed"}`} aria-live="polite"><strong>{currentRoll.roll}</strong><span>{currentRoll.text}</span>{currentRoll.delivery !== "idle" && <small className={`skill-roll-delivery ${currentRoll.delivery}`}>{currentRoll.delivery === "sending" && <><LoaderCircle className="spin" /> Discord…</>}{currentRoll.delivery === "sent" && <><CheckCircle2 /> Отправлено</>}{currentRoll.delivery === "error" && <><AlertTriangle /> Не отправлено</>}</small>}</output>}
                    </PopoverContent>
                  </Popover>}
                <label className={`skill-training-control ${(skill.trainingProgress ?? 0) > 0 ? "active" : ""}`} title="Можно ввести число больше 10: новая точка добавится автоматически, остаток сохранится"><span className="sr-only">Прокачка {skill.label}</span><input type="number" min="0" value={skill.trainingProgress ?? ""} placeholder="—" aria-label={`Прогресс прокачки: ${skill.label}`} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateTraining(skill, event.target.value)} /><i>/</i><b>{TRAINING_GOAL}</b></label>
                {EXPANDABLE.has(skill.id) && <button className="skill-add" title="Добавить специализацию" onClick={() => openSpecializationDialog(skill)}><Plus /></button>}
                {skill.custom && <button className="skill-delete" title="Удалить навык" onClick={() => onChange({ ...character, skills: character.skills.filter((item) => item.id !== skill.id) })}><Trash2 /></button>}
              </div>
            </td>
            {LEVELS.map((level, index) => <td key={level}><button className={`skill-box ${effectiveLevel >= index + 1 ? "active" : ""} ${skill.level < index + 1 && effectiveLevel >= index + 1 ? "ingame" : ""}`} aria-label={`${skill.label}: ${level}`} title={index === 4 ? `Стоимость +40: ${experienceCost(character.aptitudes[skill.characteristic], 1)} опыта` : undefined} onClick={() => setLevel(skill.id, index + 1)} /></td>)}
          </tr>;
        })}</tbody>
      </table>
      {filtered.length === 0 && <p className="empty-copy">Навык не найден.</p>}
    </div>
    <Dialog open={Boolean(parent)} onOpenChange={(open) => !open && closeSpecializationDialog()}>
      <DialogContent className="paper-dialog">
        <DialogHeader><DialogTitle>Новая специализация</DialogTitle><DialogDescription>{parent?.label}: укажите конкретное знание, язык или ремесло.</DialogDescription></DialogHeader>
        <label className="dialog-text-field"><span>Название</span><input autoFocus value={specialization} onChange={(event) => setSpecialization(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addSpecialization()} placeholder="Например: Кузнечное дело" /></label>
        {parent?.id === "trade" && <label className="dialog-select-field"><span>Характеристика ремесла</span><select value={specializationCharacteristic} onChange={(event) => setSpecializationCharacteristic(event.target.value as CharacteristicId)}>{CHARACTERISTICS.map((characteristic) => <option key={characteristic.id} value={characteristic.id}>{characteristic.label} ({characteristic.short})</option>)}</select><small>Порог нового ремесла и стоимость его развития будут рассчитываться от выбранной характеристики.</small></label>}
        <DialogFooter><Button className="negative-button" onClick={closeSpecializationDialog}>Отмена</Button><Button onClick={addSpecialization}>Добавить</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
