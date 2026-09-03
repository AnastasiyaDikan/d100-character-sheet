import { NextRequest } from "next/server";

const FANDOM_ROOT = "https://ffg.fandom.com/ru/wiki";
const READER_ROOT = "https://r.jina.ai/http://ffg.fandom.com/ru/wiki";

async function fetchText(url: string, timeout: number) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
      "User-Agent": "D100 Character Sheet/0.3 (+talent reference)",
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`source-${response.status}`);
  return response.text();
}

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim() ?? "";
  if (!title || title.length > 160 || /[\r\n]/.test(title)) {
    return Response.json({ error: "Некорректное название таланта." }, { status: 400 });
  }

  const encodedTitle = encodeURIComponent(title.replace(/ /g, "_"));
  const sourceUrl = `${FANDOM_ROOT}/${encodedTitle}`;
  try {
    const markdown = await fetchText(`${READER_ROOT}/${encodedTitle}?action=render`, 45_000);
    if (markdown.length > 120 && markdown.includes("Markdown Content:") && !/Checking you're not a bot/i.test(markdown)) {
      return Response.json({ format: "markdown", content: markdown, sourceUrl }, {
        headers: { "Cache-Control": "public, max-age=3600" },
      });
    }
  } catch {
    // Fandom's rendered page below is a second route if the reader is unavailable.
  }

  try {
    const html = await fetchText(`${sourceUrl}?action=render`, 20_000);
    if (html.length < 120 || /Please contact the site owner|Checking you're not a bot/i.test(html)) throw new Error("empty");
    return Response.json({ format: "html", content: html, sourceUrl }, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return Response.json({ error: "Страница таланта временно недоступна." }, { status: 502 });
  }
}
