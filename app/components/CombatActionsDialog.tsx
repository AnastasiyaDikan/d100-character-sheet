"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Dices, Info, LoaderCircle, RotateCcw, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COMBAT_ACTIONS, COMBAT_RANK_LABELS, combatActionValues, mainSkillRank, selectedCombatRank } from "@/lib/character/combat";
import { rollDie } from "@/lib/character/dice";
import { createCharacterThumbnail, discordIsConnected, loadDiscordSettings, sendDiscordRoll } from "@/lib/character/discord-client";
import { evaluateSkillCheck, type SkillCheckOutcome } from "@/lib/character/skill-check";
import type { Character, CombatSettings, CombatSkillRank } from "@/lib/character/types";

type CombatRoll = SkillCheckOutcome & {
  actionId: string;
  label: string;
  serial: number;
  delivery: "idle" | "sending" | "sent" | "error";
};

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return <label className="combat-toggle"><Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} /><span>{children}</span></label>;
}

function RankSelector({ title, skillId, character, onChange }: {
  title: string;
  skillId: "parry" | "dodge";
  character: Character;
  onChange: (rank: CombatSkillRank | null) => void;
}) {
  const mainRank = mainSkillRank(character, skillId);
  const selected = selectedCombatRank(character, skillId);
  const override = skillId === "parry" ? character.combatSettings.parryRank : character.combatSettings.dodgeRank;
  return <fieldset className="combat-rank-selector">
    <legend>{title}</legend>
    <div className="combat-rank-options">{COMBAT_RANK_LABELS.map((label, index) => {
      const rank = (index + 1) as CombatSkillRank;
      return <label key={label}><Checkbox checked={selected === rank} onCheckedChange={(checked) => onChange(checked === true ? rank : null)} /><span>{label}</span></label>;
    })}</div>
    <div className="combat-rank-source"><span>В чарнике: {mainRank === 0 ? "не изучено" : COMBAT_RANK_LABELS[mainRank - 1]}</span>{override !== null && <button onClick={() => onChange(null)} title="Снова брать значение из основного чарника"><RotateCcw /> Из чарника</button>}</div>
  </fieldset>;
}

export default function CombatActionsDialog({ character, onChange }: { character: Character; onChange: (character: Character) => void }) {
  const [open, setOpen] = useState(false);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [combatRoll, setCombatRoll] = useState<CombatRoll | null>(null);
  const settings = character.combatSettings;
  const actions = COMBAT_ACTIONS.filter((action) => !action.requiresCounterattack || settings.counterattack);
  const update = (patch: Partial<CombatSettings>) => onChange({ ...character, combatSettings: { ...settings, ...patch } });
  const showDescription = (event: MouseEvent, text: string) => setTooltip({
    text,
    x: Math.max(12, event.clientX - 350),
    y: Math.max(12, Math.min(window.innerHeight - 150, event.clientY - 18)),
  });
  const rollCombatCheck = (actionId: string, actionName: string, label: string, threshold: number) => {
    const result = rollDie(100);
    const serial = Date.now() + Math.random();
    const outcome = evaluateSkillCheck(threshold, result);
    const discord = loadDiscordSettings(character.characterId);
    setCombatRoll({ ...outcome, actionId, label, serial, delivery: discordIsConnected(discord) ? "sending" : "idle" });
    if (!discordIsConnected(discord)) return;
    void createCharacterThumbnail(character).then((avatar) => sendDiscordRoll({
      webhookUrl: discord.webhookUrl,
      characterName: character.name.trim() || "Безымянный персонаж",
      avatar,
      kind: "combat",
      sides: 100,
      result,
      actionName,
      checkLabel: label,
      threshold,
    })).then(() => {
      setCombatRoll((current) => current?.serial === serial ? { ...current, delivery: "sent" } : current);
    }).catch(() => {
      setCombatRoll((current) => current?.serial === serial ? { ...current, delivery: "error" } : current);
    });
  };
  const rollIcon = (label: string) => label === "НР" ? <Swords /> : label === "НС" ? <ArrowUpRight /> : <Dices />;

  return <>
    <Button className="combat-actions-button fantasy-button" onClick={() => setOpen(true)}><Swords /> Боевые действия</Button>
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setTooltip(null); }}>
      <DialogContent className="paper-dialog combat-actions-dialog">
        <DialogHeader><DialogTitle><Swords /> Значения для Боевых действий</DialogTitle><DialogDescription>Выберите действующие таланты и снаряжение. Значения пересчитываются сразу и сохраняются вместе с персонажем.</DialogDescription></DialogHeader>
        <div className="combat-dialog-body">
          <section className="combat-options" aria-label="Боевые модификаторы">
            <div className="aim-setting">
              <span><strong>Прицелиться</strong><small>бонус ко всем действиям с подтипом «Атака»</small></span>
              <div><button className={settings.aimBonus === 10 ? "active" : ""} onClick={() => update({ aimBonus: settings.aimBonus === 10 ? 0 : 10 })}>Полудействие <b>+10</b></button><button className={settings.aimBonus === 20 ? "active" : ""} onClick={() => update({ aimBonus: settings.aimBonus === 20 ? 0 : 20 })}>Полное действие <b>+20</b></button></div>
            </div>
            <Toggle checked={settings.expert} onChange={(expert) => update({ expert })}><strong>Эксперт</strong><small>+10 к любой атаке и парированию оружием</small></Toggle>
            <Toggle checked={settings.shoulderToShoulder === 10} onChange={(checked) => update({ shoulderToShoulder: checked ? 10 : 0 })}><strong>Плечом к Плечу / 2</strong><small>+10: рядом соратник без этого таланта</small></Toggle>
            <Toggle checked={settings.shoulderToShoulder === 20} onChange={(checked) => update({ shoulderToShoulder: checked ? 20 : 0 })}><strong>Плечом к Плечу</strong><small>+20: рядом соратник с этим талантом</small></Toggle>
            <Toggle checked={settings.berserkerCharge} onChange={(berserkerCharge) => update({ berserkerCharge })}><strong>Натиск Берсерка</strong><small>+30 к значению Натиска</small></Toggle>
            <Toggle checked={settings.frenzy} onChange={(frenzy) => update({ frenzy })}><strong>Неистовство</strong><small>+10 к любой атаке и парированию оружием</small></Toggle>
            <Toggle checked={settings.counterattack} onChange={(counterattack) => update({ counterattack })}><strong>Контратака</strong><small>показать реакцию после успешного Парирования</small></Toggle>
            <label className="weapon-modifier-setting"><span><strong>Модификатор оружия</strong><small>к атакам, контратаке и парированию оружием</small></span><input type="number" value={settings.weaponModifier === 0 ? "" : settings.weaponModifier} placeholder="0" onFocus={(event) => event.currentTarget.select()} onChange={(event) => update({ weaponModifier: event.target.value === "" ? 0 : Number(event.target.value) })} /></label>
            <div className="shield-setting"><Toggle checked={settings.shieldEnabled} onChange={(shieldEnabled) => update({ shieldEnabled })}><strong>Щит</strong><small>добавить его бонус к Парированию</small></Toggle><label><span>Бонус</span><input type="number" min="0" value={settings.shieldBonus === 0 ? "" : settings.shieldBonus} placeholder="0" disabled={!settings.shieldEnabled} onFocus={(event) => event.currentTarget.select()} onChange={(event) => update({ shieldBonus: event.target.value === "" ? 0 : Number(event.target.value) })} /></label></div>
            <RankSelector title="Парирование" skillId="parry" character={character} onChange={(parryRank) => update({ parryRank })} />
            <RankSelector title="Уклонение" skillId="dodge" character={character} onChange={(dodgeRank) => update({ dodgeRank })} />
          </section>

          <section className="combat-table-wrap" aria-label="Таблица боевых действий">
            <table className="combat-actions-table"><thead><tr><th>Действие</th><th>Тип</th><th>Подтип</th><th>Характеристика</th></tr></thead><tbody>{actions.map((action) => {
              const values = combatActionValues(character, action);
              const currentRoll = combatRoll?.actionId === action.id ? combatRoll : null;
              return <tr key={action.id} onMouseMove={(event) => showDescription(event, action.description)} onMouseLeave={() => setTooltip(null)}>
                <th><span>{action.action}</span><Info aria-hidden="true" /></th><td>{action.type}</td><td>{action.subtype}</td><td><div className="combat-values">{values.map((item) => item.value === null ? <span key={item.label} className="combat-value empty" title={item.explanation}>{item.label}</span> : <span key={item.label} className="combat-value" title={item.explanation}><small>{item.label}</small><strong>{item.value}</strong><button className={`combat-roll-button ${item.label === "НР" ? "melee" : item.label === "НС" ? "shooting" : ""}`} aria-label={`Бросить d100: ${action.action}, ${item.label}`} title={`Бросить d100 против ${item.value}`} onClick={(event) => { event.stopPropagation(); rollCombatCheck(action.id, action.action, item.label, item.value!); }}>{rollIcon(item.label)}</button></span>)}</div>{currentRoll && <output className={`combat-roll-result ${currentRoll.passed ? "passed" : "failed"}`} aria-live="polite"><strong>{currentRoll.roll}</strong><span>{currentRoll.text}</span>{currentRoll.delivery !== "idle" && <small className={currentRoll.delivery}>{currentRoll.delivery === "sending" && <><LoaderCircle className="spin" /> Discord…</>}{currentRoll.delivery === "sent" && <><CheckCircle2 /> Отправлено</>}{currentRoll.delivery === "error" && <><AlertTriangle /> Не отправлено</>}</small>}</output>}</td>
              </tr>;
            })}</tbody></table>
          </section>
        </div>
        <DialogFooter className="combat-dialog-footer"><span>Наведите на действие, чтобы прочитать описание. Формула значения видна при наведении на число.</span><Button className="negative-button" onClick={() => setOpen(false)}>Закрыть</Button></DialogFooter>
      </DialogContent>
      {tooltip && createPortal(<div className="combat-description-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.text}</div>, document.body)}
    </Dialog>
  </>;
}
