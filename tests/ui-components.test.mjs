import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("parses the full Jaded talent description and requirements", async () => {
  const { parseTalentMarkdown } = await vite.ssrLoadModule("/app/components/TalentCatalogDialog.tsx");
  const markdown = `
Markdown Content:
## Искушенный

### Оригинал

Jaded.

### Линейки

[Dark Heresy](https://ffg.fandom.com/ru/wiki/Dark_Heresy), [Rogue Trader](https://ffg.fandom.com/ru/wiki/Rogue_Trader), [Black Crusade](https://ffg.fandom.com/ru/wiki/Black_Crusade).

### Требования

[Сила воли](https://ffg.fandom.com/ru/wiki/Willpower) 30.

### Источники

[Dark Heresy Rulebook](https://ffg.fandom.com/ru/wiki/Dark_Heresy_Rulebook).

Вы повидали столько зла в этой галактике, что привыкли к виду самых отвратительных ужасов.
`;
  const parsed = parseTalentMarkdown(markdown, {
    id: "искушенный",
    name: "Искушенный",
    pageTitle: "Искушенный",
    group: "Dark Heresy, Black Crusade",
    properties: "",
    requirements: "",
    lineages: "",
    sources: "",
    detailLoaded: false,
    excluded: false,
  });

  assert.equal(parsed.requirements, "Сила воли 30.");
  assert.match(parsed.properties, /^Вы повидали столько зла/);
  assert.equal(parsed.lineages, "Dark Heresy, Black Crusade");
});

test("prefers a talent section over an augmentation section", async () => {
  const { parseTalentMarkdown } = await vite.ssrLoadModule("/app/components/TalentCatalogDialog.tsx");
  const markdown = `
Markdown Content:
## Аугметика

### Источники

Only War.

Описание импланта, которое не должно попасть в карточку.

## [Талант](https://ffg.fandom.com/ru/wiki/Талант "Талант")

### Требования

Интеллект 30.

### Источники

Dark Heresy Rulebook.

Описание [именно](https://ffg.fandom.com/ru/wiki/Талант "Талант") таланта, которое [должно](https://ffg.fandom.com/ru/wiki/Описание "Описание") попасть в карточку.
`;
  const parsed = parseTalentMarkdown(markdown, {
    id: "example",
    name: "Пример",
    pageTitle: "Пример",
    group: "Dark Heresy",
    properties: "",
    requirements: "",
    lineages: "Dark Heresy",
    sources: "",
    detailLoaded: false,
    excluded: false,
  });

  assert.equal(parsed.requirements, "Интеллект 30.");
  assert.equal(parsed.properties, "Описание именно таланта, которое должно попасть в карточку.");
  assert.doesNotMatch(parsed.properties, /импланта/);
});

test("loads talent details through the browser-readable endpoint first", async () => {
  const { requestTalentDetail } = await vite.ssrLoadModule("/app/components/TalentCatalogDialog.tsx");
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    return new Response(`Markdown Content:\n${"Описание таланта. ".repeat(12)}`, { status: 200 });
  };

  try {
    const response = await requestTalentDetail("Искушенный");
    assert.equal(response.format, "markdown");
    assert.match(requested[0], /^https:\/\/r\.jina\.ai\/http:\/\/ffg\.fandom\.com\/ru\/wiki\//);
    assert.equal(requested.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
