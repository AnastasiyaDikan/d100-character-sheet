"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Talent } from "@/lib/character/types";

const SOURCE_PAGE = "https://ffg.fandom.com/ru/wiki/Таланты";
const API_ROOT = "https://ffg.fandom.com/ru/api.php";
const READER_ROOT = "https://r.jina.ai/http://ffg.fandom.com/ru/wiki";
const CATALOG_CACHE_KEY = "d100-ffg-talents-v4";
const DETAIL_CACHE_PREFIX = "d100-ffg-talent-detail-v5:";
const EXCLUDED_LINEAGES = ["rogue trader", "deathwatch", "death watch", "imperium maledictum"];

type CatalogTalent = {
  id: string;
  name: string;
  pageTitle: string;
  group: string;
  properties: string;
  requirements: string;
  lineages: string;
  sources: string;
  detailLoaded: boolean;
  excluded: boolean;
};

type ParseResponse = { parse?: { text?: string; title?: string } };
type TalentDetailResponse = {
  format: "html" | "markdown";
  content: string;
  sourceUrl: string;
};

const clean = (value: string) => value
  .replace(/\[[^\]]*]/g, "")
  .replace(/\s+/g, " ")
  .trim();
const key = (value: string) => value.toLocaleLowerCase("ru").replace(/ё/g, "е").trim();
const isExcludedLineage = (value: string) => EXCLUDED_LINEAGES.some((lineage) => key(value).includes(lineage));
const splitMetadata = (value: string) => value
  .split(/[,;·|]+/)
  .map((item) => clean(item).replace(/[.]+$/, ""))
  .filter(Boolean);
const allowedMetadata = (value: string) => splitMetadata(value).filter((item) => !isExcludedLineage(item));
const mergeAllowedMetadata = (...values: string[]) => {
  const items = new Map<string, string>();
  for (const value of values) {
    for (const item of allowedMetadata(value)) items.set(key(item), item);
  }
  return [...items.values()].join(", ");
};
const exclusivelyExcluded = (lineages: string, sources: string) => {
  const explicitLineages = splitMetadata(lineages);
  if (explicitLineages.length) return explicitLineages.every(isExcludedLineage);
  const explicitSources = splitMetadata(sources);
  return explicitSources.length > 0 && explicitSources.every(isExcludedLineage);
};

function apiUrl(pageTitle: string) {
  const params = new URLSearchParams({
    action: "parse",
    page: pageTitle,
    prop: "text",
    redirects: "1",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  return `${API_ROOT}?${params}`;
}

function jsonp(url: string): Promise<ParseResponse> {
  return new Promise((resolve, reject) => {
    const callback = `d100TalentCatalog${Date.now()}${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => finish(new Error("timeout")), 15000);
    const finish = (error?: Error, data?: ParseResponse) => {
      window.clearTimeout(timer);
      script.remove();
      delete (window as unknown as Record<string, unknown>)[callback];
      if (error) reject(error); else resolve(data ?? {});
    };
    (window as unknown as Record<string, unknown>)[callback] = (data: ParseResponse) => finish(undefined, data);
    script.onerror = () => finish(new Error("script"));
    script.src = `${url}&callback=${callback}`;
    document.head.appendChild(script);
  });
}

async function requestPage(pageTitle: string): Promise<ParseResponse> {
  const url = apiUrl(pageTitle);
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error(String(response.status));
    return await response.json() as ParseResponse;
  } catch {
    return jsonp(url);
  }
}

export async function requestTalentDetail(pageTitle: string): Promise<TalentDetailResponse> {
  const encodedTitle = encodeURIComponent(pageTitle.replace(/ /g, "_"));
  try {
    const readerResponse = await fetch(`${READER_ROOT}/${encodedTitle}?action=render`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(60_000),
    });
    const content = await readerResponse.text();
    if (!readerResponse.ok || content.length < 120 || !content.includes("Markdown Content:")) {
      throw new Error(`reader-${readerResponse.status}`);
    }
    return {
      format: "markdown",
      content,
      sourceUrl: `https://ffg.fandom.com/ru/wiki/${encodedTitle}`,
    };
  } catch {
    return Promise.any([
      fetch(`/api/talents?title=${encodeURIComponent(pageTitle)}`).then(async (response) => {
        if (!response.ok) throw new Error(`detail-${response.status}`);
        return response.json() as Promise<TalentDetailResponse>;
      }),
      requestPage(pageTitle).then((response) => {
        const content = response.parse?.text ?? "";
        if (content.length < 120) throw new Error("fandom-empty");
        return {
          format: "html" as const,
          content,
          sourceUrl: `https://ffg.fandom.com/ru/wiki/${encodedTitle}`,
        };
      }),
    ]);
  }
}

function wikiTitle(anchor: HTMLAnchorElement | null, fallback: string) {
  if (!anchor) return fallback;
  const title = anchor.getAttribute("title");
  if (title) return clean(title);
  const href = anchor.getAttribute("href") ?? "";
  const match = href.match(/\/ru\/wiki\/([^#?]+)/i);
  if (!match) return fallback;
  try { return decodeURIComponent(match[1]).replace(/_/g, " "); } catch { return fallback; }
}

function parseCatalog(html: string): CatalogTalent[] {
  const documentNode = new DOMParser().parseFromString(html, "text/html");
  documentNode.querySelectorAll("script, style, sup.reference, .mw-editsection, .navbox").forEach((node) => node.remove());
  const talents = new Map<string, CatalogTalent>();

  for (const table of documentNode.querySelectorAll("table")) {
    const firstRow = table.querySelector("tr");
    const headers = firstRow ? [...firstRow.querySelectorAll("th,td")].map((cell) => key(clean(cell.textContent ?? ""))) : [];
    const nameIndex = Math.max(0, headers.findIndex((header) => /назван|талант/.test(header)));
    const lineageIndex = headers.findIndex((header) => /линейк|систем|игр/.test(header));
    const sourceIndex = headers.findIndex((header) => /источник/.test(header));
    const requirementIndex = headers.findIndex((header) => /требован/.test(header));
    let group = "Таланты";
    let previous = table.previousElementSibling;
    while (previous && !/^H[2-4]$/.test(previous.tagName)) previous = previous.previousElementSibling;
    if (previous) group = clean(previous.textContent ?? "") || group;
    if (isExcludedLineage(group)) continue;

    for (const row of [...table.querySelectorAll("tr")].slice(1)) {
      const cells = [...row.querySelectorAll(":scope > th, :scope > td")];
      const nameCell = cells[nameIndex];
      const anchor = nameCell?.querySelector<HTMLAnchorElement>("a[href*='/ru/wiki/']") ?? null;
      const name = clean(anchor?.textContent ?? nameCell?.textContent ?? "");
      const pageTitle = wikiTitle(anchor, name);
      if (!anchor || name.length < 2 || name.length > 120 || pageTitle.includes(":")) continue;
      const lineages = lineageIndex >= 0 ? clean(cells[lineageIndex]?.textContent ?? "") : "";
      const sources = sourceIndex >= 0 ? clean(cells[sourceIndex]?.textContent ?? "") : "";
      if (exclusivelyExcluded(lineages, sources)) continue;
      const requirements = requirementIndex >= 0 ? clean(cells[requirementIndex]?.textContent ?? "") : "";
      const talentKey = key(name);
      const existing = talents.get(talentKey);
      talents.set(talentKey, {
        id: talentKey,
        name,
        pageTitle: existing?.pageTitle ?? pageTitle,
        group: mergeAllowedMetadata(existing?.group ?? "", group),
        properties: "",
        requirements: existing?.requirements || requirements,
        lineages: mergeAllowedMetadata(existing?.lineages ?? "", lineages || group),
        sources: existing?.sources || sources,
        detailLoaded: false, excluded: false,
      });
    }
  }

  return [...talents.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

function infoValue(root: ParentNode, labelPattern: RegExp) {
  for (const row of root.querySelectorAll(".pi-item.pi-data, .portable-infobox .pi-data, table tr, dl")) {
    const labelNode = row.querySelector(".pi-data-label, th, dt");
    const valueNode = row.querySelector(".pi-data-value, td, dd");
    if (labelNode && valueNode && labelPattern.test(clean(labelNode.textContent ?? ""))) return clean(valueNode.textContent ?? "");
  }
  return "";
}

function preferredHtmlScope(documentNode: Document) {
  const heading = [...documentNode.querySelectorAll<HTMLElement>("h2, h3, h4")].find((node) =>
    /^(?:как\s+)?талант(?:ы)?(?:\s*\([^)]*\))?$/i.test(clean(node.textContent ?? "")),
  );
  if (!heading) return { root: documentNode as ParentNode, preferred: false };

  const section = documentNode.createElement("section");
  const level = Number(heading.tagName.slice(1));
  let sibling = heading.nextSibling;
  while (sibling) {
    const element = sibling.nodeType === 1 ? sibling as Element : null;
    const siblingLevel = element && /^H[1-6]$/.test(element.tagName) ? Number(element.tagName.slice(1)) : 7;
    if (siblingLevel <= level) break;
    section.appendChild(sibling.cloneNode(true));
    sibling = sibling.nextSibling;
  }
  return { root: section as ParentNode, preferred: true };
}

function descriptionText(root: ParentNode) {
  root.querySelectorAll("script, style, sup.reference, .mw-editsection, aside, table, .navbox, .toc, .references, figure, noscript").forEach((node) => node.remove());
  const contentRoots: ParentNode[] = (root as Node).nodeType === 9
    ? [...root.querySelectorAll(".mw-parser-output")]
    : [root];
  const paragraphs = contentRoots.flatMap((contentRoot) => [...contentRoot.querySelectorAll("p")])
    .map((node) => clean(node.textContent ?? ""))
    .filter((text) => text.length > 10 && !/^Источник|^Категори/i.test(text));
  const hasBareDescription = contentRoots.some((contentRoot) => [...contentRoot.childNodes]
    .some((node) => node.nodeType === 3 && clean(node.textContent ?? "").length > 10));
  if (!hasBareDescription && paragraphs.length) return [...new Set(paragraphs)].join("\n\n");

  const completeText = contentRoots
    .map((contentRoot) => clean(contentRoot.textContent ?? ""))
    .filter((text) => text.length > 10 && !/^Источник|^Категори/i.test(text));
  return [...new Set(completeText)].join("\n\n");
}

function parseTalentDetail(html: string, talent: CatalogTalent): CatalogTalent {
  const documentNode = new DOMParser().parseFromString(html, "text/html");
  const { root, preferred } = preferredHtmlScope(documentNode);
  const requirements = infoValue(root, /^требован/i)
    || talent.requirements
    || (!preferred ? infoValue(documentNode, /^требован/i) : "")
    || "—";
  const lineages = infoValue(root, /^линейк/i)
    || (!preferred ? infoValue(documentNode, /^линейк/i) : "")
    || talent.lineages;
  const sources = infoValue(root, /^источник/i)
    || (!preferred ? infoValue(documentNode, /^источник/i) : "")
    || talent.sources;
  const properties = descriptionText(root);
  if (!properties) throw new Error("description");
  return {
    ...talent,
    properties,
    requirements,
    lineages: mergeAllowedMetadata(talent.lineages, lineages),
    sources,
    detailLoaded: true,
    excluded: exclusivelyExcluded(lineages, sources),
  };
}

const markdownInline = (value: string) => clean(value
  .replace(/!\[[^\]]*]\([^\n)]*\)/g, "")
  .replace(/\[([^\]]+)]\((?:<[^>]+>|[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\)/g, "$1")
  .replace(/<[^>]+>/g, " ")
  .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
  .replace(/^[ \t]*[-*+][ \t]+/gm, "• ")
  .replace(/[*_`~]+/g, ""));

function markdownBlocks(value: string) {
  return value
    .trim()
    .split(/\n\s*\n+/)
    .map((block) => markdownInline(block.replace(/\n+/g, " ")))
    .filter(Boolean);
}

function preferredMarkdownScope(markdown: string) {
  const body = markdown.includes("Markdown Content:") ? markdown.split("Markdown Content:").slice(1).join("Markdown Content:") : markdown;
  const headings = [...body.matchAll(/^(#{1,6})[ \t]+(.+)$/gm)];
  const talentHeading = headings.find((match) => /^(?:как\s+)?талант(?:ы)?(?:\s*\([^)]*\))?$/i.test(markdownInline(match[2])));
  if (!talentHeading || talentHeading.index === undefined) return { text: body, preferred: false };
  const level = talentHeading[1].length;
  const start = talentHeading.index + talentHeading[0].length;
  const following = headings.find((match) => (match.index ?? 0) >= start && match[1].length <= level);
  return { text: body.slice(start, following?.index ?? body.length), preferred: true };
}

function markdownSection(markdown: string, labelPattern: RegExp) {
  const headings = [...markdown.matchAll(/^(#{2,6})[ \t]+(.+)$/gm)];
  const headingIndex = headings.findIndex((match) => labelPattern.test(markdownInline(match[2])));
  if (headingIndex < 0) return "";
  const heading = headings[headingIndex];
  const start = (heading.index ?? 0) + heading[0].length;
  const next = headings.slice(headingIndex + 1).find((candidate) => (candidate.index ?? 0) >= start);
  return markdown.slice(start, next?.index ?? markdown.length).trim();
}

export function parseTalentMarkdown(markdown: string, talent: CatalogTalent): CatalogTalent {
  const { text: scope, preferred } = preferredMarkdownScope(markdown);
  const requirements = markdownBlocks(markdownSection(scope, /^требован/i)).join("\n\n") || talent.requirements || "—";
  const lineages = markdownBlocks(markdownSection(scope, /^линейк/i)).join(", ") || talent.lineages;
  const sourceBlocks = markdownBlocks(markdownSection(scope, /^источник/i));
  const sources = sourceBlocks[0] || talent.sources;
  const explicitProperties = markdownBlocks(markdownSection(scope, /^(?:свойств|описан|эффект)/i));
  let propertyBlocks = explicitProperties.length ? explicitProperties : sourceBlocks.slice(1);

  if (!propertyBlocks.length && preferred) {
    const firstMetadata = [...scope.matchAll(/^#{2,6}[ \t]+(?:оригинал|линейк|требован|источник|свойств|описан|эффект).+$/gim)][0];
    propertyBlocks = markdownBlocks(scope.slice(0, firstMetadata?.index ?? scope.length))
      .filter((block) => block.length > 20);
  }

  const properties = [...new Set(propertyBlocks)].join("\n\n");
  if (!properties) throw new Error("description");
  return {
    ...talent,
    properties,
    requirements,
    lineages: mergeAllowedMetadata(talent.lineages, lineages),
    sources,
    detailLoaded: true,
    excluded: exclusivelyExcluded(lineages, sources),
  };
}

function parseTalentResponse(response: TalentDetailResponse, talent: CatalogTalent) {
  return response.format === "markdown"
    ? parseTalentMarkdown(response.content, talent)
    : parseTalentDetail(response.content, talent);
}

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
  const [detailLoading, setDetailLoading] = useState<Set<string>>(new Set());
  const [detailErrors, setDetailErrors] = useState<Set<string>>(new Set());
  const existing = useMemo(() => new Map(existingTalents.map((talent) => [key(talent.name), talent])), [existingTalents]);
  const filtered = useMemo(() => {
    const needle = key(query);
    return catalog.filter((talent) => !talent.excluded && (!needle || key(`${talent.name} ${talent.group} ${talent.requirements} ${talent.lineages}`).includes(needle)));
  }, [catalog, query]);

  const loadCatalog = useCallback(async (ignoreCache = false) => {
    setLoading(true);
    setError(false);
    try {
      if (!ignoreCache) {
        const cached = sessionStorage.getItem(CATALOG_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as CatalogTalent[];
          if (parsed.length) { setCatalog(parsed); return; }
        }
      }
      const response = await requestPage("Таланты");
      const parsed = parseCatalog(response.parse?.text ?? "");
      if (!parsed.length) throw new Error("empty");
      setCatalog(parsed);
      sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (talent: CatalogTalent, ignoreCache = false) => {
    if (talent.detailLoaded) return talent;
    setDetailLoading((current) => new Set(current).add(talent.id));
    setDetailErrors((current) => { const next = new Set(current); next.delete(talent.id); return next; });
    try {
      const cacheKey = `${DETAIL_CACHE_PREFIX}${talent.id}`;
      let detailed: CatalogTalent | null = null;
      if (!ignoreCache) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) detailed = JSON.parse(cached) as CatalogTalent;
      }
      if (!detailed) {
        const response = await requestTalentDetail(talent.pageTitle);
        detailed = parseTalentResponse(response, talent);
        sessionStorage.setItem(cacheKey, JSON.stringify(detailed));
      }
      setCatalog((current) => current.map((item) => item.id === talent.id ? detailed! : item));
      return detailed;
    } catch {
      setDetailErrors((current) => new Set(current).add(talent.id));
      return null;
    } finally {
      setDetailLoading((current) => { const next = new Set(current); next.delete(talent.id); return next; });
    }
  }, []);

  useEffect(() => {
    if (!open || catalog.length > 0 || loading || error) return;
    const timer = window.setTimeout(() => void loadCatalog(), 0);
    return () => window.clearTimeout(timer);
  }, [catalog.length, error, loadCatalog, loading, open]);

  useEffect(() => {
    if (!open || key(query).length < 3 || filtered.length > 8) return;
    const pending = filtered.filter((talent) => !talent.detailLoaded && !detailLoading.has(talent.id) && !detailErrors.has(talent.id));
    if (!pending.length) return;
    const timer = window.setTimeout(() => { for (const talent of pending) void loadDetail(talent); }, 250);
    return () => window.clearTimeout(timer);
  }, [detailErrors, detailLoading, filtered, loadDetail, open, query]);

  const importTalent = async (talent: CatalogTalent) => {
    const detailed = talent.detailLoaded ? talent : await loadDetail(talent, detailErrors.has(talent.id));
    if (!detailed || detailed.excluded) return;
    onImport({ name: detailed.name, properties: detailed.properties, requirements: detailed.requirements });
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="paper-dialog talent-catalog-dialog">
      <DialogHeader><DialogTitle><BookOpen /> Справочник талантов</DialogTitle><DialogDescription>Полные описания и требования загружаются со страниц талантов FFG Wiki. Rogue Trader, Deathwatch и Imperium Maledictum исключены.</DialogDescription></DialogHeader>
      {!error && <label className="catalog-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, линейка или требование…" aria-label="Поиск по справочнику талантов" /><span>{filtered.length}</span></label>}
      <div className="catalog-list">
        {loading && <p className="catalog-state">Загружаю список талантов…</p>}
        {error && <div className="catalog-state"><strong>FFG Wiki сейчас не ответила</strong><span>Можно повторить загрузку или добавить талант вручную в основном окне.</span><Button onClick={() => void loadCatalog(true)}><RefreshCw /> Повторить</Button></div>}
        {!loading && !error && filtered.map((talent) => {
          const saved = existing.get(key(talent.name));
          const isLoading = detailLoading.has(talent.id);
          const detailError = detailErrors.has(talent.id);
          return <article className="catalog-talent" key={talent.id}><div><small>{talent.lineages || talent.group}</small><h3>{talent.name}</h3>
            {talent.detailLoaded ? <><p><strong>Свойства:</strong> {talent.properties}</p><p><strong>Требования:</strong> {talent.requirements}</p></> : detailError ? <p className="catalog-detail-error">Не удалось загрузить страницу таланта. Повторите попытку.</p> : <p className="catalog-detail-prompt">{isLoading ? "Загружаю полное описание и требования…" : "Описание загрузится перед добавлением."}</p>}
          </div><div className="catalog-talent-actions">{!talent.detailLoaded && !isLoading && <Button size="sm" variant="outline" onClick={() => void loadDetail(talent, detailError)}>{detailError ? <><RefreshCw /> Повторить</> : "Показать описание"}</Button>}<Button size="sm" disabled={isLoading || saved?.source === "race"} onClick={() => void importTalent(talent)}>{saved?.source === "race" ? "Расовая черта" : saved ? <><RefreshCw /> Обновить</> : <><Plus /> Добавить</>}</Button></div></article>;
        })}
        {!loading && !error && filtered.length === 0 && <p className="catalog-state">Подходящих талантов из разрешённых линеек не найдено.</p>}
      </div>
      <DialogFooter className="catalog-footer"><span>Источник: <a href={SOURCE_PAGE} target="_blank" rel="noreferrer">FFG Wiki <ExternalLink /></a></span><Button className="negative-button" onClick={() => onOpenChange(false)}>Закрыть</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
