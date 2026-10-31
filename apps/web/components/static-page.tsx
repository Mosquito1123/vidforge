import { getTranslations } from "next-intl/server";

type Section = { title: string; body: string };

export async function StaticPage({ ns }: { ns: string }) {
  const t = await getTranslations(ns);
  let sections: Section[] = [];
  try {
    sections = (t.raw("sections") as Section[]) || [];
  } catch {
    sections = [];
  }
  const updated = (() => {
    try {
      return t("updated");
    } catch {
      return "";
    }
  })();

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("intro")}</p>
      </div>
      {sections.map((s, i) => (
        <section key={i} className="space-y-2">
          <h2 className="text-xl font-semibold">{s.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{s.body}</p>
        </section>
      ))}
      {updated ? <p className="text-xs text-muted-foreground">{updated}</p> : null}
    </div>
  );
}