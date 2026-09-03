"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Download, Feather, FileUp,
  HeartPulse, ImagePlus, Moon, Plus, RotateCcw, Save, Search, Shield, Skull,
  Sparkles, Trash2, UserRound, X,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import AvatarEditor from "./AvatarEditor";
import BodyMap from "./BodyMap";
import SkillsPanel from "./SkillsPanel";
import TalentCatalogDialog from "./TalentCatalogDialog";
import TutorialGuide from "./TutorialGuide";
import { CHARACTERISTICS, createCharacter, RACES } from "@/lib/character/data";
import { bonus, carrying, characteristicValue, fatigueThreshold, movement, skillThreshold, spentExperience, zoneDefense } from "@/lib/character/calculations";
import { applyAptitudeCharacteristics, applyRace as applyRaceToCharacter, beginIndependentAptitudeDistribution, calculateNaturalArmor, calculateRaceWounds, independentAptitudeBudget } from "@/lib/character/race-engine";
import { deleteAutosave, downloadCharacter, loadAutosave, normalizeCharacter, saveAutosave } from "@/lib/character/storage";
import type { Armor, Character, CharacteristicId, HitZone, InventoryItem, Race, Talent, Weapon } from "@/lib/character/types";

const SKILL_LEVELS = ["Know", "+10", "+20", "+30"];
const ZONES: Array<{ id: HitZone; short: string; label: string }> = [
  { id: "head", short: "Г", label: "Голова" },
  { id: "rightArm", short: "ПР", label: "Правая рука" },
  { id: "leftArm", short: "ЛР", label: "Левая рука" },
  { id: "body", short: "К", label: "Корпус" },
  { id: "rightLeg", short: "ПН", label: "Правая нога" },
  { id: "leftLeg", short: "ЛН", label: "Левая нога" },
];

const TUTORIAL = [
  ["identity", "Основные сведения", "Здесь хранятся имя, игрок, роль, внешность и биография персонажа."],
  ["race", "Выбор расы", "Нажмите на расу: откроется справочник с описаниями, склонностями и расовыми выборами."],
  ["aptitudes", "Склонности", "Они определяют стоимость развития характеристик и связанных с ними навыков."],
  ["characteristics", "Характеристики", "Отображают развитие персонажа, каждый кружочек увеличивает характеристику на +5."],
  ["skills", "Навыки", "Ступени Know, +10, +20 и +30 описывают уровень владения навыком. Развитие всегда последовательное."],
  ["talents", "Таланты и черты", "Здесь можно внести таланты и черты персонажа."],
  ["hit-map", "Карта попаданий", "Защита зоны считается из доспехов, естественной брони и Бонуса Выносливости."],
  ["flip", "Оборотная сторона", "Переверните лист кнопкой у правого края, чтобы открыть снаряжение и расчёты."],
  ["save", "Сохранение", "Изменения сохраняются автоматически. Отдельный JSON можно скачать в любой момент."],
] as const;

type DraftTalent = Pick<Talent, "name" | "properties" | "requirements">;
const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
const createNewCharacter = () => applyRaceToCharacter(createCharacter(), RACES[0], {});

function Field({ label, value, onChange, multiline = false, className = "" }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; className?: string;
}) {
  const common = { value, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value), "aria-label": label };
  return <label className={`ink-field ${className}`}><span>{label}</span>{multiline ? <textarea {...common} rows={2} /> : <input {...common} />}</label>;
}

function NumberField({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (value: number) => void; min?: number }) {
  return <label className="number-field"><span>{label}</span><input type="number" min={min} value={value === 0 ? "" : value} placeholder="0" onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))} /></label>;
}

function OptionalNumberField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return <label className="number-field"><span>{label}</span><input type="number" min="0" value={value ?? ""} placeholder="—" onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} /></label>;
}

function CalculatedNumber({ label, value }: { label: string; value: number }) {
  return <div className="number-field calculated-number"><span>{label}</span><strong>{value}</strong></div>;
}

function StartScreen({ autosave, onNew, onLoad, onRestore, onDeleteAutosave }: {
  autosave: Character | null; onNew: () => void; onLoad: (event: ChangeEvent<HTMLInputElement>) => void; onRestore: () => void; onDeleteAutosave: () => void;
}) {
  return <main className="start-screen">
    <div className="start-vignette" />
    <section className="start-card" aria-labelledby="start-title">
      <Feather className="start-feather" aria-hidden="true" />
      <p className="eyebrow">Система D100</p><h1 id="start-title">Красивый чарник</h1>
      <div className="ornament" aria-hidden="true"><span>◆</span></div>
      <p className="start-copy">Создайте новый лист или продолжите историю уже знакомого персонажа.</p>
      <div className="start-actions">
        <Button className="fantasy-button" onClick={onNew}><Sparkles /> Новый персонаж</Button>
        <label className="load-button"><FileUp /> Загрузить персонажа<input type="file" accept="application/json,.json" onChange={onLoad} /></label>
      </div>
      {autosave && <div className="autosave-card"><div><span>Найдено автосохранение</span><strong>{autosave.name || "Безымянный персонаж"}</strong><time>{new Date(autosave.savedAt).toLocaleString("ru-RU")}</time></div><div className="autosave-actions"><Button size="sm" onClick={onRestore}><RotateCcw /> Восстановить</Button><Button size="icon-sm" variant="ghost" aria-label="Удалить автосохранение" onClick={onDeleteAutosave}><Trash2 /></Button></div></div>}
      <p className="version">Character Sheet v0.4.1</p>
    </section>
  </main>;
}

function RacePicker({ open, currentId, onOpenChange, onApply }: {
  open: boolean; currentId: string; onOpenChange: (open: boolean) => void; onApply: (race: Race, choices: Record<string, string>) => void;
}) {
  const [selectedId, setSelectedId] = useState(currentId);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [hover, setHover] = useState<{ race: Race; x: number; y: number } | null>(null);
  const race = RACES.find((item) => item.id === selectedId) ?? RACES[0];
  const families = [...new Set(RACES.map((item) => item.family))];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="race-dialog">
    <DialogHeader><DialogTitle>Выбор расы</DialogTitle><DialogDescription>Наведите курсор для краткой аннотации. Изменения применятся только после подтверждения.</DialogDescription></DialogHeader>
    <div className="race-layout">
      <nav className="race-list" aria-label="Список рас">{families.map((family) => <section key={family}><h3>{family}</h3>{RACES.filter((item) => item.family === family).map((item) => <button key={item.id} className={selectedId === item.id ? "selected" : ""} onClick={() => { setSelectedId(item.id); setChoices({}); }} onMouseMove={(event) => setHover({ race: item, x: event.clientX + 18, y: event.clientY + 18 })} onMouseLeave={() => setHover(null)}><span>{item.name}</span>{item.special && <em>особый</em>}</button>)}</section>)}</nav>
      <article className="race-details">
        {race.special && <div className="special-banner">Особый персонаж <small>требуется согласование с мастером</small></div>}
        <h2>{race.name}</h2>{race.subtitle && <p className="race-subtitle">{race.subtitle}</p>}<p>{race.description}</p>
        <div className="race-columns"><div><h4>Преимущества</h4><ul>{race.advantages.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h4>Недостатки</h4><ul>{race.disadvantages.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
        <p className="race-budget">Склонности: <strong>{race.aptitudeBudget} очков</strong>{Boolean(race.freeAptitudePoints) && <span> · свободно распределяются: {race.freeAptitudePoints}</span>}</p>
        {race.choices?.map((choice) => <div className="race-choice" key={choice.id}><span>{choice.label}</span><Select value={choices[choice.id] ?? ""} onValueChange={(value) => setChoices((current) => ({ ...current, [choice.id]: value }))}><SelectTrigger aria-label={choice.label}><SelectValue placeholder="Выберите…" /></SelectTrigger><SelectContent className="race-select-content">{choice.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>)}
      </article>
    </div>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button><Button className="fantasy-button" disabled={Boolean(race.choices?.some((choice) => !choices[choice.id]))} onClick={() => onApply(race, choices)}>Применить расу</Button></DialogFooter>
    {hover && <div className="race-hover" style={{ left: hover.x, top: hover.y }}><strong>{hover.race.name}</strong><span>{hover.race.subtitle}</span><p>{hover.race.summary}</p></div>}
  </DialogContent></Dialog>;
}

function CharacteristicCard({ character, id, onChange }: { character: Character; id: CharacteristicId; onChange: (character: Character) => void }) {
  const item = character.characteristics[id];
  const updateItem = (patch: Partial<typeof item>) => onChange({ ...character, characteristics: { ...character.characteristics, [id]: { ...item, ...patch } } });
  return <article className="characteristic-card"><header><span>{item.label}</span><abbr title={item.label}>{item.short}</abbr></header><div className="characteristic-body">
    <label className="characteristic-value"><span>Значение</span><input type="number" min="0" value={item.value === 0 ? "" : item.value} placeholder="0" onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateItem({ value: event.target.value === "" ? 0 : Number(event.target.value) })} /></label>
    <span className="bonus-pill">Бонус {bonus(character, id)}</span>
    <div className="advance-vertical" aria-label={`Развитие: ${item.advances} из 5`}>{[1, 2, 3, 4, 5].map((step) => <button key={step} className={step <= item.advances ? "active" : ""} aria-label={`${step} ступень развития`} onClick={() => { const next = item.advances === step ? step - 1 : step; updateItem({ advances: next, value: Math.max(0, item.value + (next - item.advances) * 5) }); }} />)}</div>
  </div></article>;
}

function SkillsTable({ character, onChange }: { character: Character; onChange: (character: Character) => void }) {
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const setLevel = (skillId: string, level: number) => onChange({ ...character, skills: character.skills.map((skill) => skill.id === skillId ? { ...skill, level: skill.level === level ? level - 1 : level } : skill) });
  return <div className="skills-wrap"><table className="skills-table"><thead><tr><th>Навык</th>{SKILL_LEVELS.map((level) => <th key={level}>{level}</th>)}</tr></thead><tbody>{character.skills.map((skill) => <tr key={skill.id}><td><button onClick={() => setActiveSkill(activeSkill === skill.id ? null : skill.id)}>{skill.label} <small>({character.characteristics[skill.characteristic].short})</small></button></td>{SKILL_LEVELS.map((_, index) => <td key={index}><button className={`skill-box ${skill.level >= index + 1 ? "active" : ""}`} aria-label={`${skill.label}: ${SKILL_LEVELS[index]}`} onClick={() => setLevel(skill.id, index + 1)} /></td>)}</tr>)}</tbody></table>{activeSkill && <div className="skill-result"><span>Порог проверки</span><strong>{skillThreshold(character, activeSkill)}</strong></div>}</div>;
}

function TalentPanel({ character, onChange }: { character: Character; onChange: (character: Character) => void }) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [draft, setDraft] = useState<DraftTalent>({ name: "", properties: "", requirements: "" });
  const filtered = character.talents.filter((talent) => talent.name.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")));
  const addTalent = () => { if (!draft.name.trim()) return; onChange({ ...character, talents: [...character.talents, { id: uid("talent"), ...draft, source: "talent" }] }); setDraft({ name: "", properties: "", requirements: "" }); setAdding(false); };
  return <section className="panel talents-panel" data-tutorial="talents">
    <div className="section-heading"><h2>Таланты и черты</h2><div className="talent-heading-actions"><Button size="xs" variant="ghost" onClick={() => setCatalogOpen(true)}><BookOpen /> Справочник</Button><Button size="icon-xs" variant="ghost" onClick={() => setAdding(true)} aria-label="Добавить талант вручную"><Plus /></Button></div></div>
    <label className="search-field"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию…" /></label>
    <div className="talent-scroll">{filtered.length === 0 ? <p className="empty-copy">Пока нет подходящих записей.</p> : <Accordion type="multiple">{filtered.map((talent) => <AccordionItem value={talent.id} key={talent.id} className="talent-card"><AccordionTrigger><span>{talent.name}<small>{talent.source === "race" ? "Расовая черта" : "Талант"}</small></span></AccordionTrigger><AccordionContent><p><strong>Свойства:</strong> {talent.properties || "—"}</p><p><strong>Требования:</strong> {talent.requirements || "—"}</p>{talent.source !== "race" && <Button size="xs" variant="ghost" onClick={() => onChange({ ...character, talents: character.talents.filter((item) => item.id !== talent.id) })}><Trash2 /> Удалить</Button>}</AccordionContent></AccordionItem>)}</Accordion>}</div>
    <Dialog open={adding} onOpenChange={setAdding}><DialogContent className="paper-dialog"><DialogHeader><DialogTitle>Новый талант</DialogTitle><DialogDescription>Добавьте свойства и требования — длинный текст будет скрыт в карточке.</DialogDescription></DialogHeader><Field label="Название" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} /><Field label="Свойства" value={draft.properties} onChange={(properties) => setDraft({ ...draft, properties })} multiline /><Field label="Требования" value={draft.requirements} onChange={(requirements) => setDraft({ ...draft, requirements })} multiline /><DialogFooter><Button variant="outline" onClick={() => setAdding(false)}>Отмена</Button><Button onClick={addTalent}>Сохранить</Button></DialogFooter></DialogContent></Dialog>
    <TalentCatalogDialog open={catalogOpen} onOpenChange={setCatalogOpen} existingTalents={character.talents} onImport={(talent) => {
      const normalizedName = talent.name.toLocaleLowerCase("ru").replace(/ё/g, "е");
      const existingTalent = character.talents.find((item) => item.source !== "race" && item.name.toLocaleLowerCase("ru").replace(/ё/g, "е") === normalizedName);
      onChange({
        ...character,
        talents: existingTalent
          ? character.talents.map((item) => item.id === existingTalent.id ? { ...item, ...talent } : item)
          : [...character.talents, { ...talent, id: uid("talent"), source: "talent" }],
      });
    }} />
  </section>;
}

function TextList({ title, values, onChange }: { title: string; values: string[]; onChange: (values: string[]) => void }) {
  return <section className="panel mini-list"><div className="section-heading"><h3>{title}</h3><Button size="icon-xs" variant="ghost" onClick={() => onChange([...values, ""])} aria-label={`Добавить: ${title}`}><Plus /></Button></div><div className="mini-list-scroll">
    {values.length === 0 && <p className="empty-copy">Нет записей</p>}
    {values.map((value, index) => <div className="mini-list-row" key={index}><input value={value} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><button aria-label="Удалить" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}><X /></button></div>)}
  </div></section>;
}

function HitMap({ character }: { character: Character }) {
  return <section className="panel hit-map" data-tutorial="hit-map"><div className="section-heading"><h2>Карта попаданий</h2><span>БВ {bonus(character, "endurance")}</span></div><div className="hit-map-stage">
    <UserRound className="body-silhouette" strokeWidth={1.1} aria-hidden="true" />
    {ZONES.map((zone) => <div className={`zone-chip zone-${zone.id}`} key={zone.id}><span>{zone.short}</span><strong>{zoneDefense(character, zone.id)}</strong><small>{zone.label}</small></div>)}
  </div><p className="formula-note"><Shield /> доспехи + естественная броня + Бонус Выносливости</p></section>;
}

function FrontPage({ character, onChange, onRaceOpen }: { character: Character; onChange: (character: Character) => void; onRaceOpen: () => void }) {
  const currentRace = RACES.find((race) => race.id === character.raceId) ?? RACES[0];
  const spent = spentExperience(character);
  const aptitudeSpent = Object.values(character.aptitudes).reduce((sum, value) => sum + value, 0);
  const aptitudeBudget = character.freeAptitudes
    ? independentAptitudeBudget(currentRace)
    : currentRace.aptitudeBudget;
  const aptitudesDirty = CHARACTERISTICS.some(({ id }) => character.aptitudes[id] !== (character.appliedAptitudes?.[id] ?? character.racialAptitudes[id]));
  const update = <K extends keyof Character>(key: K, value: Character[K]) => onChange({ ...character, [key]: value });
  return <div className="sheet-page front-page">
    <section className="identity-grid panel" data-tutorial="identity">
      <AvatarEditor avatar={character.avatar} crop={character.avatarCrop} name={character.name} onChange={(avatar, avatarCrop) => onChange({ ...character, avatar, avatarCrop })} onRemove={() => onChange({ ...character, avatar: "", avatarCrop: { x: 0, y: 0, zoom: 1 } })} />
      <div className="identity-main"><Field label="Имя персонажа" value={character.name} onChange={(value) => update("name", value)} /><button className="race-field" data-tutorial="race" onClick={onRaceOpen}><span>Раса</span><strong>{currentRace.name}</strong><ChevronRight /></button><div className="field-pair"><Field label="Предыстория" value={character.background} onChange={(value) => update("background", value)} /><Field label="Роль" value={character.role} onChange={(value) => update("role", value)} /></div><Field label="Заметки" value={character.notes} onChange={(value) => update("notes", value)} multiline /></div>
      <div className="identity-side"><Field label="Имя игрока" value={character.player} onChange={(value) => update("player", value)} /><div className="field-pair"><Field label="Возраст" value={character.age} onChange={(value) => update("age", value)} /><label className="ink-field gender-field"><span>Пол</span><Select value={character.gender} onValueChange={(value) => update("gender", value as Character["gender"])}><SelectTrigger aria-label="Пол"><SelectValue /></SelectTrigger><SelectContent className="gender-select-content"><SelectItem value="female">Женщина</SelectItem><SelectItem value="male">Мужчина</SelectItem></SelectContent></Select></label></div><div className="field-pair"><Field label="Глаза" value={character.eyes} onChange={(value) => update("eyes", value)} /><Field label="Волосы" value={character.hair} onChange={(value) => update("hair", value)} /></div><div className="field-pair"><Field label="Кожа" value={character.skin} onChange={(value) => update("skin", value)} /><Field label="Комплекция" value={character.build} onChange={(value) => update("build", value)} /></div><Field label="Союзники" value={character.allies} onChange={(value) => update("allies", value)} /><Field label="Враги" value={character.enemies} onChange={(value) => update("enemies", value)} /></div>
    </section>
    <div className="front-main-grid"><div className="front-left">
      <section className="panel aptitudes-panel" data-tutorial="aptitudes">
        <div className="section-heading aptitudes-heading"><h2>Склонности</h2><span>{aptitudeSpent} / {aptitudeBudget} · свободно {Math.max(0, aptitudeBudget - aptitudeSpent)}</span>{character.freeAptitudes && <Button size="xs" className="apply-aptitudes" disabled={!aptitudesDirty || aptitudeSpent !== aptitudeBudget} title={aptitudeSpent !== aptitudeBudget ? "Сначала распределите все очки склонностей" : "Пересчитать характеристики"} onClick={() => onChange(applyAptitudeCharacteristics(character, currentRace))}><Check /> Применить</Button>}</div>
        <label className="free-toggle"><Checkbox checked={character.freeAptitudes} onCheckedChange={(checked) => {
          const enabled = checked === true;
          if (enabled) onChange(beginIndependentAptitudeDistribution(character));
          else onChange(applyAptitudeCharacteristics({ ...character, freeAptitudes: false, aptitudes: { ...character.racialAptitudes } }, currentRace));
        }} /> Полностью самостоятельное распределение</label>
        {character.freeAptitudes && <p className="aptitude-hint">Расовые точки сняты, а общий запас уменьшен на 1. Распределите все очки; характеристики изменятся после кнопки «Применить».</p>}
        <div className="aptitudes-grid">{CHARACTERISTICS.map((item) => <div key={item.id}><span>{item.label}</span><div>{[1, 2].map((level) => {
          const locked = !character.freeAptitudes && level <= character.racialAptitudes[item.id];
          return <button key={level} className={`${character.aptitudes[item.id] >= level ? "active" : ""} ${locked ? "locked" : ""}`} title={locked ? "Расовая склонность" : "Свободное очко"} disabled={locked} onClick={() => {
            const current = character.aptitudes[item.id];
            const minimum = character.freeAptitudes ? 0 : character.racialAptitudes[item.id];
            const next = Math.max(minimum, current === level ? level - 1 : level);
            const proposed = aptitudeSpent - current + next;
            if (proposed <= aptitudeBudget) update("aptitudes", { ...character.aptitudes, [item.id]: next });
          }} />;
        })}</div></div>)}</div>
      </section>
      <section className="panel characteristics-panel" data-tutorial="characteristics"><div className="section-heading"><h2>Характеристики</h2><span>● = +5</span></div><div className="characteristics-grid">{CHARACTERISTICS.map(({ id }) => <CharacteristicCard key={id} id={id} character={character} onChange={onChange} />)}</div></section>
      <SkillsPanel character={character} onChange={onChange} />
    </div><div className="front-right">
      <TalentPanel character={character} onChange={onChange} />
      <div className="dual-mini"><TextList title="Ментальные расстройства" values={character.disorders} onChange={(values) => update("disorders", values)} /><TextList title="Рудименты и мутации" values={character.mutations} onChange={(values) => update("mutations", values)} /></div>
      <section className="panel counters-panel"><NumberField label="Безумие" value={character.insanity} onChange={(value) => update("insanity", value)} /><OptionalNumberField label="Порча" value={character.corruption} onChange={(value) => update("corruption", value)} /><div className="fate-pair"><NumberField label="Судьба" value={character.fateCurrent} onChange={(value) => update("fateCurrent", value)} /><span>/</span><NumberField label="Максимум" value={character.fateMax} onChange={(value) => update("fateMax", value)} /></div><NumberField label="Бездна" value={character.abyss} onChange={(value) => update("abyss", value)} /></section>
      <section className="panel front-derived-panel">
        <div className="front-stat-box"><h3>Раны</h3><div className="front-stat-fields"><NumberField label="Сейчас" value={character.woundsCurrent} onChange={(value) => update("woundsCurrent", value)} /><CalculatedNumber label="Всего" value={character.woundsTotal} /></div></div>
        <div className="front-stat-box"><h3>Опыт</h3><NumberField label="Получено" value={character.experienceEarned} onChange={(value) => update("experienceEarned", value)} /><dl><div><dt>Потрачено</dt><dd>{spent}</dd></div><div><dt>Доступно</dt><dd className={character.experienceEarned - spent < 0 ? "negative" : ""}>{character.experienceEarned - spent}</dd></div></dl></div>
        <div className="front-stat-box natural-armor-box"><h3>Естественная броня</h3><NumberField label="КД" value={character.naturalArmor} onChange={(value) => update("naturalArmor", value)} /><p className="formula-note"><Shield /> все зоны</p></div>
      </section>
      <BodyMap character={character} />
    </div></div>
  </div>;
}

function WeaponCard({ weapon, onChange, onDelete }: { weapon: Weapon; onChange: (weapon: Weapon) => void; onDelete: () => void }) {
  const field = (key: keyof Weapon, label: string) => <Field label={label} value={String(weapon[key])} onChange={(value) => onChange({ ...weapon, [key]: value })} />;
  return <article className="equipment-card"><header><input value={weapon.name} placeholder="Название оружия" onChange={(event) => onChange({ ...weapon, name: event.target.value })} /><button onClick={() => onChange({ ...weapon, collapsed: !weapon.collapsed })}>{weapon.collapsed ? <ChevronRight /> : <ChevronLeft />}</button><button onClick={onDelete}><Trash2 /></button></header>{!weapon.collapsed && <div className="weapon-grid">{field("weaponClass", "Класс")}{field("range", "Дальность")}{field("rate", "Скорострельность")}{field("damage", "Урон")}{field("penetration", "Проникновение")}{field("magazine", "Обойма")}{field("reload", "Перезарядка")}<div className="wide">{field("properties", "Свойства")}</div></div>}</article>;
}

function ArmorCard({ armor, onChange, onDelete }: { armor: Armor; onChange: (armor: Armor) => void; onDelete: () => void }) {
  return <article className="equipment-card armor-card"><header><input value={armor.name} placeholder="Название доспеха" onChange={(event) => onChange({ ...armor, name: event.target.value })} /><button onClick={onDelete}><Trash2 /></button></header><div className="armor-fields"><Field label="Тип" value={armor.type} onChange={(type) => onChange({ ...armor, type })} /><NumberField label="КД" value={armor.armor} onChange={(value) => onChange({ ...armor, armor: value })} /><Field label="Свойства" value={armor.properties} onChange={(properties) => onChange({ ...armor, properties })} /></div><div className="zone-checks"><span>Защищает:</span>{ZONES.map((zone) => <label key={zone.id}><Checkbox checked={armor.zones.includes(zone.id)} onCheckedChange={(checked) => onChange({ ...armor, zones: checked ? [...armor.zones, zone.id] : armor.zones.filter((item) => item !== zone.id) })} />{zone.short}</label>)}</div></article>;
}

function BackPage({ character, onChange }: { character: Character; onChange: (character: Character) => void }) {
  const move = movement(character), carry = carrying(character), fatigue = fatigueThreshold(character);
  const update = <K extends keyof Character>(key: K, value: Character[K]) => onChange({ ...character, [key]: value });
  const addWeapon = () => update("weapons", [...character.weapons, { id: uid("weapon"), name: "Новое оружие", weaponClass: "", range: "", rate: "", damage: "", penetration: "", magazine: "", reload: "", properties: "", collapsed: false }]);
  const addArmor = () => update("armor", [...character.armor, { id: uid("armor"), name: "Новый доспех", type: "", armor: 0, properties: "", zones: [] }]);
  const addInventory = () => update("inventory", [...character.inventory, { id: uid("item"), name: "", cost: "", properties: "" }]);
  return <div className="sheet-page back-page"><div className="back-grid"><div className="equipment-column">
    <section className="panel equipment-section"><div className="section-heading"><h2>Оружие</h2><Button size="xs" variant="ghost" onClick={addWeapon}><Plus /> Добавить</Button></div><div className="equipment-scroll">{character.weapons.length === 0 && <p className="empty-copy">Добавьте первое оружие.</p>}{character.weapons.map((weapon) => <WeaponCard key={weapon.id} weapon={weapon} onChange={(next) => update("weapons", character.weapons.map((item) => item.id === weapon.id ? next : item))} onDelete={() => update("weapons", character.weapons.filter((item) => item.id !== weapon.id))} />)}</div></section>
    <section className="panel equipment-section"><div className="section-heading"><h2>Броня</h2><Button size="xs" variant="ghost" onClick={addArmor}><Plus /> Добавить</Button></div><div className="equipment-scroll armor-scroll">{character.armor.length === 0 && <p className="empty-copy">Карта попаданий пока учитывает только Бонус Выносливости.</p>}{character.armor.map((armor) => <ArmorCard key={armor.id} armor={armor} onChange={(next) => update("armor", character.armor.map((item) => item.id === armor.id ? next : item))} onDelete={() => update("armor", character.armor.filter((item) => item.id !== armor.id))} />)}</div></section>
    <section className="panel derived-panel"><div><h3>Движение</h3><dl><div><dt>Свободное</dt><dd>{move.free}</dd></div><div><dt>Полудействие</dt><dd>{move.halfAction}</dd></div><div><dt>Натиск</dt><dd>{move.charge}</dd></div><div><dt>Бег</dt><dd>{move.run}</dd></div></dl></div><div><h3>Носить / поднимать</h3><dl><div><dt>Носить</dt><dd>{carry.carry} кг</dd></div><div><dt>Поднимать</dt><dd>{carry.lift} кг</dd></div><div><dt>Толкать</dt><dd>{carry.push} кг</dd></div></dl></div><div><h3>Усталость</h3><div className="threshold-display"><span>Порог</span><strong>{fatigue}</strong></div><NumberField label="Сейчас" value={character.fatigueCurrent} onChange={(value) => update("fatigueCurrent", value)} /></div></section>
  </div><section className="panel inventory-panel"><div className="section-heading"><h2>Инвентарь</h2><Button size="xs" variant="ghost" onClick={addInventory}><Plus /> Строка</Button></div><div className="inventory-head"><span>Название</span><span>Стоимость</span><span>Свойства</span><span /></div><div className="inventory-scroll">{character.inventory.map((item: InventoryItem) => <div className="inventory-row" key={item.id}><input value={item.name} onChange={(event) => update("inventory", character.inventory.map((current) => current.id === item.id ? { ...current, name: event.target.value } : current))} /><input value={item.cost} onChange={(event) => update("inventory", character.inventory.map((current) => current.id === item.id ? { ...current, cost: event.target.value } : current))} /><input value={item.properties} onChange={(event) => update("inventory", character.inventory.map((current) => current.id === item.id ? { ...current, properties: event.target.value } : current))} /><button onClick={() => update("inventory", character.inventory.filter((current) => current.id !== item.id))}><Trash2 /></button></div>)}</div></section></div></div>;
}

export default function CharacterSheetApp() {
  const [screen, setScreen] = useState<"start" | "sheet">("start");
  const [page, setPage] = useState<"front" | "back">("front");
  const [isTurning, setIsTurning] = useState(false);
  const [character, setCharacter] = useState<Character>(() => createNewCharacter());
  const [autosave, setAutosave] = useState<Character | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [raceOpen, setRaceOpen] = useState(false);
  const [tutorialPrompt, setTutorialPrompt] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [dontAskTutorial, setDontAskTutorial] = useState(false);
  const [breakthroughsOpen, setBreakthroughsOpen] = useState(false);
  const [fatigueState, setFatigueState] = useState<"unconscious" | "dead" | null>(null);
  const previousFatigue = useRef(0);

  useEffect(() => { loadAutosave().then(setAutosave).catch(() => setAutosave(null)); }, []);
  useEffect(() => {
    if (screen !== "sheet") return;
    const timer = window.setTimeout(async () => {
      const savedAt = new Date().toISOString();
      await saveAutosave({ ...character, savedAt });
      setLastSavedAt(savedAt);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [character, screen]);
  useEffect(() => {
    if (screen !== "sheet") return;
    const threshold = fatigueThreshold(character), before = previousFatigue.current, now = character.fatigueCurrent;
    if (threshold > 0 && before < threshold * 2 && now >= threshold * 2) setFatigueState("dead");
    else if (threshold > 0 && before < threshold && now >= threshold) setFatigueState("unconscious");
    previousFatigue.current = now;
  }, [character, screen]);
  useEffect(() => { if (!fatigueState) return; const timer = window.setTimeout(() => setFatigueState(null), 3800); return () => window.clearTimeout(timer); }, [fatigueState]);
  useEffect(() => {
    if (tutorialStep === null) return;
    const element = document.querySelector(`[data-tutorial="${TUTORIAL[tutorialStep][0]}"]`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [tutorialStep, page]);

  const currentRace = useMemo(() => RACES.find((race) => race.id === character.raceId) ?? RACES[0], [character.raceId]);
  useEffect(() => {
    const total = calculateRaceWounds(character, currentRace);
    const naturalArmor = calculateNaturalArmor(character, currentRace);
    // These values are persisted for export, so keep the stored snapshot in sync with its formula.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (total !== character.woundsTotal || naturalArmor !== character.naturalArmor) setCharacter((current) => ({ ...current, woundsTotal: total, naturalArmor }));
  }, [character.characteristics, character.raceId, character.woundsTotal, character.naturalArmor, currentRace]);
  const beginNew = () => {
    setCharacter(createNewCharacter()); setPage("front");
    if (localStorage.getItem("d100-skip-tutorial") === "true") setScreen("sheet"); else setTutorialPrompt(true);
  };
  const finishTutorialPrompt = (startTutorial: boolean) => {
    if (dontAskTutorial) localStorage.setItem("d100-skip-tutorial", "true");
    setTutorialPrompt(false); setScreen("sheet");
    if (startTutorial) window.setTimeout(() => setTutorialStep(0), 250);
  };
  const loadJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed = normalizeCharacter(JSON.parse(await file.text()) as Character & { fate?: number });
      if (parsed.formatVersion !== 1 || !parsed.characterId) throw new Error("invalid");
      setCharacter(parsed); previousFatigue.current = parsed.fatigueCurrent ?? 0; setScreen("sheet"); setPage("front");
    } catch { window.alert("Не удалось открыть JSON: файл не похож на сохранение чарника D100."); }
    finally { event.target.value = ""; }
  };
  const applyRace = (race: Race, raceChoices: Record<string, string>) => {
    setCharacter((current) => applyRaceToCharacter(current, race, raceChoices));
    setRaceOpen(false);
  };
  const tutorial = tutorialStep === null ? null : TUTORIAL[tutorialStep];
  const turnPage = () => {
    if (isTurning) return;
    setIsTurning(true);
    window.setTimeout(() => setPage((current) => current === "front" ? "back" : "front"), 270);
    window.setTimeout(() => setIsTurning(false), 620);
  };

  if (screen === "start") return <>
    <StartScreen autosave={autosave} onNew={beginNew} onLoad={loadJson} onRestore={() => { if (autosave) { setCharacter(autosave); setScreen("sheet"); } }} onDeleteAutosave={async () => { await deleteAutosave(); setAutosave(null); }} />
    <Dialog open={tutorialPrompt} onOpenChange={setTutorialPrompt}><DialogContent className="paper-dialog tutorial-question" showCloseButton={false}><DialogHeader><DialogTitle>Хотите пройти краткое обучение?</DialogTitle><DialogDescription>Мы покажем основные поля и расчёты. Обучение можно снова открыть через кнопку «?».</DialogDescription></DialogHeader><label className="dialog-checkbox"><Checkbox checked={dontAskTutorial} onCheckedChange={(checked) => setDontAskTutorial(Boolean(checked))} /> Больше не спрашивать</label><DialogFooter><Button variant="outline" onClick={() => finishTutorialPrompt(false)}>Нет</Button><Button className="fantasy-button" onClick={() => finishTutorialPrompt(true)}>Да, показать</Button></DialogFooter></DialogContent></Dialog>
  </>;

  return <main className="workspace-shell">
    <header className="toolbar"><Button variant="ghost" size="sm" onClick={() => setScreen("start")}><BookOpen /> Главное меню</Button><span className="toolbar-divider" /><span className="character-title">{character.name || "Безымянный персонаж"} <small>· {currentRace.name}</small></span><div className="toolbar-actions"><span className="save-status"><Save /> {lastSavedAt ? `Автосохранено ${new Date(lastSavedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "Сохранение…"}</span><Button data-tutorial="save" variant="outline" size="sm" onClick={() => downloadCharacter(character)}><Download /> Сохранить JSON</Button><label className="toolbar-load"><FileUp /><span>Загрузить</span><input type="file" accept="application/json,.json" onChange={loadJson} /></label><Button size="icon-sm" variant="ghost" aria-label="Открыть обучение" onClick={() => { setPage("front"); setTutorialStep(0); }}><CircleHelp /></Button></div></header>
    <div className={`sheet-scene book-scene ${page === "back" ? "show-back" : ""} ${isTurning ? "turning" : ""}`}><div className="book-cover" aria-hidden="true" /><div className="sheet-paper">{page === "front" ? <FrontPage character={character} onChange={setCharacter} onRaceOpen={() => setRaceOpen(true)} /> : <BackPage character={character} onChange={setCharacter} />}<button className="page-turn" data-tutorial="flip" onClick={turnPage} aria-label={page === "front" ? "Открыть оборотную сторону" : "Вернуться на лицевую сторону"}>{page === "front" ? <ChevronRight /> : <ChevronLeft />}<span>{page === "front" ? "Оборот" : "Лицевая"}</span></button>{isTurning && <div className="turning-leaf" aria-hidden="true"><div className="leaf-front" /><div className="leaf-back" /></div>}</div></div>
    <button className="breakthrough-button" onClick={() => setBreakthroughsOpen(true)}><Moon /><span>Прорывы</span><strong>{character.breakthroughs.length}</strong></button>
    <RacePicker key={`${character.raceId}-${raceOpen}`} open={raceOpen} currentId={character.raceId} onOpenChange={setRaceOpen} onApply={applyRace} />
    <Sheet open={breakthroughsOpen} onOpenChange={setBreakthroughsOpen}><SheetContent className="breakthrough-sheet"><SheetHeader><SheetTitle>Прорывы</SheetTitle><SheetDescription>Краткие записи о каждом прорыве персонажа.</SheetDescription></SheetHeader><div className="breakthrough-list">{character.breakthroughs.map((item) => <article key={item.id}><header><strong>№ {item.number}</strong><button onClick={() => setCharacter({ ...character, breakthroughs: character.breakthroughs.filter((current) => current.id !== item.id) })}><Trash2 /></button></header><textarea value={item.description} onChange={(event) => setCharacter({ ...character, breakthroughs: character.breakthroughs.map((current) => current.id === item.id ? { ...current, description: event.target.value } : current) })} placeholder="Описание…" /></article>)}</div><Button onClick={() => setCharacter({ ...character, breakthroughs: [...character.breakthroughs, { id: uid("breakthrough"), number: character.breakthroughs.length + 1, description: "" }] })}><Plus /> Добавить прорыв</Button></SheetContent></Sheet>
    {fatigueState && <button className={`fatigue-overlay ${fatigueState}`} onClick={() => setFatigueState(null)}><span className="fatigue-icon">{fatigueState === "dead" ? <Skull /> : <><HeartPulse /><i>z z z</i></>}</span><strong>{fatigueState === "dead" ? "Вы умерли от истощения" : "Вы без сознания от истощения"}</strong><small>Нажмите, чтобы закрыть</small></button>}
    {tutorial && <TutorialGuide tutorial={tutorial} step={tutorialStep!} total={TUTORIAL.length} onStepChange={setTutorialStep} onClose={() => setTutorialStep(null)} />}
  </main>;
}
