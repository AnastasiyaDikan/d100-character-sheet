import talentSnapshot from "@/lib/character/talents.json";

const normalize = (value: string) => value.toLocaleLowerCase("ru").replace(/ё/g, "е").trim();

export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get("title")?.trim();
  if (title && (title.length > 160 || /[\r\n]/.test(title))) {
    return Response.json({ error: "Некорректное название таланта." }, { status: 400 });
  }

  if (title) {
    const talent = talentSnapshot.talents.find((item) =>
      normalize(item.name) === normalize(title) || normalize(item.pageTitle) === normalize(title),
    );
    return talent
      ? Response.json(talent, { headers: { "Cache-Control": "public, max-age=86400" } })
      : Response.json({ error: "Талант не найден в локальном справочнике." }, { status: 404 });
  }

  return Response.json(talentSnapshot, { headers: { "Cache-Control": "public, max-age=86400" } });
}
