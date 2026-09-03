"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Talent } from "@/lib/character/types";

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
  const existing = useMemo(() => new Map(existingTalents.map((talent) => [key(talent.name), talent])), [existingTalents]);
  const filtered = useMemo(() => {
    const needle = key(query);
    return catalog.filter((talent) => !needle || key(`${talent.name} ${talent.group} ${talent.requirements} ${talent.lineages} ${talent.properties}`).includes(needle));
  }, [catalog, query]);

  const loadCatalog = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/talents", { headers: { Accept: "application/json" } });
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

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="paper-dialog talent-catalog-dialog">
      <DialogHeader><DialogTitle><BookOpen /> Справочник талантов</DialogTitle><DialogDescription>250 талантов с полными свойствами и требованиями сохранены в чарнике и доступны даже при недоступности FFG Wiki. Rogue Trader, DeathWatch и Imperium Maledictum исключены.</DialogDescription></DialogHeader>
      {!error && <label className="catalog-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, линейка, текст или требование…" aria-label="Поиск по справочнику талантов" /><span>{filtered.length}</span></label>}
      <div className="catalog-list">
        {loading && <p className="catalog-state">Открываю локальный справочник…</p>}
        {error && <div className="catalog-state"><strong>Не удалось открыть встроенный справочник</strong><span>Повторите попытку или добавьте талант вручную в основном окне.</span><Button onClick={() => void loadCatalog()}><RefreshCw /> Повторить</Button></div>}
        {!loading && !error && filtered.map((talent) => {
          const saved = existing.get(key(talent.name));
          return <article className="catalog-talent" key={talent.id}><div><small>{talent.lineages || talent.group}</small><h3>{talent.name}</h3><p><strong>Свойства:</strong> {talent.properties}</p><p><strong>Требования:</strong> {talent.requirements}</p></div><div className="catalog-talent-actions"><Button size="sm" disabled={saved?.source === "race"} onClick={() => onImport({ name: talent.name, properties: talent.properties, requirements: talent.requirements })}>{saved?.source === "race" ? "Расовая черта" : saved ? <><RefreshCw /> Обновить</> : <><Plus /> Добавить</>}</Button></div></article>;
        })}
        {!loading && !error && filtered.length === 0 && <p className="catalog-state">Подходящих талантов не найдено.</p>}
      </div>
      <DialogFooter className="catalog-footer"><span>Первоисточник: <a href={SOURCE_PAGE} target="_blank" rel="noreferrer">FFG Wiki <ExternalLink /></a></span><Button className="negative-button" onClick={() => onOpenChange(false)}>Закрыть</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
