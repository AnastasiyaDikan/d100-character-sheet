"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CHARACTERISTICS } from "@/lib/character/data";
import type { CharacteristicId, Talent } from "@/lib/character/types";

const SOURCE_PAGE = "https://ffg.fandom.com/ru/wiki/Таланты";

export type CatalogTalent = {
  id: string;
  name: string;
  pageTitle: string;
  group: string;
  properties: string;
  requirements: string;
  lineages: string;
  sources: string;
  sourceUrl: string;
};

type TalentSnapshot = { generatedAt: string; talents: CatalogTalent[] };
const key = (value: string) => value.toLocaleLowerCase("ru").replace(/ё/g, "е").trim();

export default function TalentCatalogDialog({ open, onOpenChange, existingTalents, onImport }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTalents: Talent[];
  onImport: (talent: Omit<Talent, "id" | "source">) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogTalent[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [supernaturalOpen, setSupernaturalOpen] = useState(false);
  const [supernaturalCharacteristic, setSupernaturalCharacteristic] = useState<CharacteristicId>("agility");
  const [supernaturalMode, setSupernaturalMode] = useState<"add" | "multiply">("add");
  const [supernaturalValue, setSupernaturalValue] = useState(2);
  const existing = useMemo(() => new Map(existingTalents.map((talent) => [key(talent.name), talent])), [existingTalents]);
  const filtered = useMemo(() => {
    const needle = key(query);
    return catalog.filter((talent) => !needle || key(`${talent.name} ${talent.group} ${talent.requirements} ${talent.lineages} ${talent.properties}`).includes(needle));
  }, [catalog, query]);

  const loadCatalog = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/talents?catalog=2", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(String(response.status));
      const snapshot = await response.json() as TalentSnapshot;
      if (!Array.isArray(snapshot.talents) || snapshot.talents.length === 0) throw new Error("empty");
      setCatalog(snapshot.talents);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || catalog.length > 0 || loading || error) return;
    const timer = window.setTimeout(() => void loadCatalog(), 0);
    return () => window.clearTimeout(timer);
  }, [catalog.length, error, loading, open]);

  const addSupernaturalSense = () => {
    const characteristic = CHARACTERISTICS.find((item) => item.id === supernaturalCharacteristic)!;
    const marker = supernaturalMode === "multiply" ? "x" : "";
    const effect = supernaturalMode === "multiply"
      ? `обычный бонус характеристики умножается на ${supernaturalValue}`
      : `к бонусу характеристики прибавляется ${supernaturalValue}`;
    onImport({
      name: `Сверхъестественное чувство: ${characteristic.label} (${marker}${supernaturalValue})`,
      properties: `Выбранная характеристика: ${characteristic.label}. ${effect[0].toLocaleUpperCase("ru")}${effect.slice(1)}. Эффект применяется ко всем связанным проверкам и производным значениям.`,
      requirements: "Отсутствуют.",
    });
    setSupernaturalOpen(false);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="paper-dialog talent-catalog-dialog">
      <DialogHeader><DialogTitle><BookOpen /> Справочник талантов</DialogTitle><DialogDescription>254 таланта с полными свойствами и требованиями сохранены в чарнике и доступны даже при недоступности FFG Wiki. В справочник также включены домашняя линейка оружейного мастерства и настраиваемое Сверхъестественное чувство.</DialogDescription></DialogHeader>
      {!error && <label className="catalog-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, линейка, текст или требование…" aria-label="Поиск по справочнику талантов" /><span>{filtered.length}</span></label>}
      <div className="catalog-list">
        {loading && <p className="catalog-state">Открываю локальный справочник…</p>}
        {error && <div className="catalog-state"><strong>Не удалось открыть встроенный справочник</strong><span>Повторите попытку или добавьте талант вручную в основном окне.</span><Button onClick={() => void loadCatalog()}><RefreshCw /> Повторить</Button></div>}
        {!loading && !error && filtered.map((talent) => {
          const supernatural = talent.id === "сверхъестественное-чувство";
          const saved = supernatural ? existingTalents.find((item) => key(item.name).startsWith("сверхъестественное чувство")) : existing.get(key(talent.name));
          return <article className="catalog-talent" key={talent.id}><div><small>{talent.lineages || talent.group}</small><h3>{talent.name}</h3><p><strong>Свойства:</strong> {talent.properties}</p><p><strong>Требования:</strong> {talent.requirements}</p></div><div className="catalog-talent-actions"><Button size="sm" disabled={saved?.source === "race"} onClick={() => supernatural ? setSupernaturalOpen(true) : onImport({ name: talent.name, properties: talent.properties, requirements: talent.requirements })}>{saved?.source === "race" ? "Расовая черта" : supernatural && saved ? <><Plus /> Добавить ещё</> : saved ? <><RefreshCw /> Обновить</> : <><Plus /> Добавить</>}</Button></div></article>;
        })}
        {!loading && !error && filtered.length === 0 && <p className="catalog-state">Подходящих талантов не найдено.</p>}
      </div>
      <DialogFooter className="catalog-footer"><span>Первоисточник: <a href={SOURCE_PAGE} target="_blank" rel="noreferrer">FFG Wiki <ExternalLink /></a></span><Button className="negative-button" onClick={() => onOpenChange(false)}>Закрыть</Button></DialogFooter>
    </DialogContent>
    <Dialog open={supernaturalOpen} onOpenChange={setSupernaturalOpen}><DialogContent className="paper-dialog supernatural-sense-dialog"><DialogHeader><DialogTitle>Сверхъестественное чувство</DialogTitle><DialogDescription>Выберите характеристику и способ усиления её бонуса.</DialogDescription></DialogHeader><label><span>Характеристика</span><select value={supernaturalCharacteristic} onChange={(event) => setSupernaturalCharacteristic(event.target.value as CharacteristicId)}>{CHARACTERISTICS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><fieldset><legend>Тип эффекта</legend><button className={supernaturalMode === "add" ? "active" : ""} onClick={() => setSupernaturalMode("add")}><strong>+{supernaturalValue}</strong><span>прибавить к бонусу</span></button><button className={supernaturalMode === "multiply" ? "active" : ""} onClick={() => setSupernaturalMode("multiply")}><strong>×{supernaturalValue}</strong><span>умножить бонус</span></button></fieldset><label><span>Значение</span><input type="number" min="1" max="20" value={supernaturalValue} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setSupernaturalValue(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label><p>Будет добавлено: <b>Сверхъестественное чувство: {CHARACTERISTICS.find((item) => item.id === supernaturalCharacteristic)?.label} ({supernaturalMode === "multiply" ? "x" : ""}{supernaturalValue})</b></p><DialogFooter><Button variant="outline" onClick={() => setSupernaturalOpen(false)}>Отмена</Button><Button className="fantasy-button" onClick={addSupernaturalSense}>Добавить талант</Button></DialogFooter></DialogContent></Dialog>
  </Dialog>;
}
