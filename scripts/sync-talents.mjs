import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUTPUT = path.join(ROOT, "lib/character/talents.json");
const CACHE = path.join(ROOT, ".talents-sync-cache.jsonl");
const INDEX_URL = "https://r.jina.ai/http://ffg.fandom.com/ru/wiki/%D0%A2%D0%B0%D0%BB%D0%B0%D0%BD%D1%82%D1%8B?action=render";
const SOURCE_ROOT = "https://ffg.fandom.com/ru/wiki";
const READER_ROOT = "https://r.jina.ai/http://ffg.fandom.com/ru/wiki";
const ALLOWED_GROUPS = new Set(["Dark Heresy", "Black Crusade", "Only War", "Dark Heresy 2"]);
const EXCLUDED = ["rogue trader", "deathwatch", "death watch", "imperium maledictum"];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const clean = (value) => value.replace(/\[[^\]]*]/g, "").replace(/\s+/g, " ").trim();
const key = (value) => value.toLocaleLowerCase("ru").replace(/ё/g, "е").trim();
const isExcluded = (value) => EXCLUDED.some((lineage) => key(value).includes(lineage));
const splitMetadata = (value) => value.split(/[,;·|]+/).map((item) => clean(item).replace(/[.]+$/, "")).filter(Boolean);
const allowedMetadata = (value) => splitMetadata(value).filter((item) => !isExcluded(item));
const mergeMetadata = (...values) => {
  const items = new Map();
  for (const value of values) for (const item of allowedMetadata(value)) items.set(key(item), item);
  return [...items.values()].join(", ");
};
async function fetchText(url, attempts = 8) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "text/plain", "User-Agent": "D100 Character Sheet talent snapshot" },
        signal: AbortSignal.timeout(90_000),
      });
      const text = await response.text();
      if (!response.ok || text.length < 100 || !text.includes("Markdown Content:")) {
        throw new Error(`HTTP ${response.status}, ${text.length} bytes`);
      }
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const throttled = error instanceof Error && /HTTP 429/.test(error.message);
        await sleep(throttled ? Math.min(60_000, attempt * 10_000) : attempt * 2000);
      }
    }
  }
  throw lastError;
}

function parseIndex(markdown) {
  const talents = new Map();
  let group = "";
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^###\s+\[([^\]]+)]/);
    if (heading) group = heading[1];
    if (!ALLOWED_GROUPS.has(group) || !line.startsWith("| [")) continue;
    const match = line.match(/^\|\s*\[([^\]]+)]\((https:\/\/ffg\.fandom\.com\/ru\/wiki\/[^ )]+)(?:\s+["']([^"']+)["'])?\)/i);
    if (!match) continue;
    const name = clean(match[1].replace(/[†*]+$/g, ""));
    const pageTitle = clean(match[3] || decodeURIComponent(match[2].split("/wiki/")[1]).replace(/_/g, " "));
    if (!name || pageTitle.includes(":")) continue;
    const id = key(name);
    const existing = talents.get(id);
    talents.set(id, {
      id,
      name: existing?.name ?? name,
      pageTitle: existing?.pageTitle ?? pageTitle,
      group: mergeMetadata(existing?.group ?? "", group),
      properties: "",
      requirements: "—",
      lineages: mergeMetadata(existing?.lineages ?? "", group),
      sources: "",
      sourceUrl: `${SOURCE_ROOT}/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`,
    });
  }
  return [...talents.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

const markdownInline = (value) => clean(value
  .replace(/!\[[^\]]*]\([^\n)]*\)/g, "")
  .replace(/\[([^\]]+)]\((?:<[^>]+>|[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\)/g, "$1")
  .replace(/<[^>]+>/g, " ")
  .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
  .replace(/^[ \t]*[-*+][ \t]+/gm, "• ")
  .replace(/[*_`~]+/g, ""));

function markdownBlocks(value) {
  return value.trim().split(/\n\s*\n+/).map((block) => markdownInline(block.replace(/\n+/g, " "))).filter(Boolean);
}

function preferredScope(markdown) {
  const body = markdown.split("Markdown Content:").slice(1).join("Markdown Content:");
  const headings = [...body.matchAll(/^(#{1,6})[ \t]+(.+)$/gm)];
  const talentHeading = headings.find((match) => /^(?:как\s+)?талант(?:ы)?(?:\s*\([^)]*\))?$/i.test(markdownInline(match[2])));
  if (!talentHeading || talentHeading.index === undefined) return { text: body, preferred: false };
  const level = talentHeading[1].length;
  const start = talentHeading.index + talentHeading[0].length;
  const following = headings.find((match) => (match.index ?? 0) >= start && match[1].length <= level);
  return { text: body.slice(start, following?.index ?? body.length), preferred: true };
}

function section(markdown, labelPattern) {
  const headings = [...markdown.matchAll(/^(#{2,6})[ \t]+(.+)$/gm)];
  const index = headings.findIndex((match) => labelPattern.test(markdownInline(match[2])));
  if (index < 0) return "";
  const heading = headings[index];
  const start = (heading.index ?? 0) + heading[0].length;
  const next = headings.slice(index + 1).find((candidate) => (candidate.index ?? 0) >= start);
  return markdown.slice(start, next?.index ?? markdown.length).trim();
}

function parseDetail(markdown, talent) {
  const { text: scope, preferred } = preferredScope(markdown);
  const requirements = markdownBlocks(section(scope, /^требован/i)).join("\n\n") || "—";
  const rawLineages = markdownBlocks(section(scope, /^линейк/i)).join(", ");
  const sourceBlocks = markdownBlocks(section(scope, /^источник/i));
  const sources = sourceBlocks[0] || "";
  const explicitProperties = markdownBlocks(section(scope, /^(?:свойств|описан|эффект)/i));
  let propertyBlocks = explicitProperties.length ? explicitProperties : sourceBlocks.slice(1);

  if (!propertyBlocks.length && preferred) {
    const metadata = [...scope.matchAll(/^#{2,6}[ \t]+(?:оригинал|линейк|требован|источник|свойств|описан|эффект).+$/gim)][0];
    propertyBlocks = markdownBlocks(scope.slice(0, metadata?.index ?? scope.length)).filter((block) => block.length > 20);
  }
  if (!propertyBlocks.length) {
    const withoutMetadata = scope.replace(/^#{2,6}[ \t]+(?:оригинал|линейк|требован|источник)[\s\S]*?(?=^#{2,6}[ \t]+|$)/gim, "");
    propertyBlocks = markdownBlocks(withoutMetadata).filter((block) => block.length > 20 && !/^Title:|^URL Source:/i.test(block));
  }

  const properties = [...new Set(propertyBlocks)].join("\n\n");
  const lineages = mergeMetadata(talent.lineages, rawLineages);
  if (!properties) throw new Error("empty description");
  return { ...talent, properties, requirements, lineages, sources };
}

async function mapConcurrent(items, concurrency, task) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

const index = await fetchText(INDEX_URL);
const catalog = parseIndex(index);
if (catalog.length !== 250) throw new Error(`Ожидалось 250 уникальных талантов, найдено ${catalog.length}.`);

const cached = new Map();
try {
  for (const line of (await readFile(CACHE, "utf8")).split(/\r?\n/).filter(Boolean)) {
    const record = JSON.parse(line);
    cached.set(record.id, record);
  }
  console.log(`Продолжаю с ${cached.size} уже сохранёнными талантами.`);
} catch {
  // Первый запуск: промежуточного снимка ещё нет.
}

const failures = [];
const detailed = await mapConcurrent(catalog, 2, async (talent, index) => {
  if (cached.has(talent.id)) return cached.get(talent.id);
  try {
    await sleep(750);
    const encoded = encodeURIComponent(talent.pageTitle.replace(/ /g, "_"));
    const markdown = await fetchText(`${READER_ROOT}/${encoded}?action=render`);
    const record = parseDetail(markdown, talent);
    cached.set(record.id, record);
    await appendFile(CACHE, `${JSON.stringify(record)}\n`, "utf8");
    process.stdout.write(`\rОбработано ${index + 1}/${catalog.length}`);
    return record;
  } catch (error) {
    failures.push(`${talent.name}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
});
process.stdout.write("\n");

if (failures.length) {
  console.error(failures.join("\n"));
  throw new Error(`Не удалось сохранить ${failures.length} талантов. Запустите синхронизацию ещё раз.`);
}

const snapshot = {
  formatVersion: 1,
  source: "FFG Wiki",
  sourceUrl: `${SOURCE_ROOT}/%D0%A2%D0%B0%D0%BB%D0%B0%D0%BD%D1%82%D1%8B`,
  excludedLineages: ["Rogue Trader", "DeathWatch", "Imperium Maledictum"],
  generatedAt: new Date().toISOString(),
  talents: detailed,
};

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Сохранено ${detailed.length} талантов: ${OUTPUT}`);
