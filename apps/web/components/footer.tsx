"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  const groups: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: t("product"),
      links: [
        { href: "/generate", label: t("generate") },
        { href: "/pricing", label: t("pricing") },
        { href: "/compare", label: t("compare") },
        { href: "/use-cases", label: t("useCases") },
      ],
    },
    {
      title: t("resources"),
      links: [
        { href: "/faq", label: t("faq") },
        { href: "/help", label: t("help") },
        { href: "/support", label: t("contact") },
        { href: "/free-tools", label: t("freeTools") },
        { href: "/api-docs", label: t("apiDocs") },
        { href: "/blog", label: t("blog") },
      ],
    },
    {
      title: t("legal"),
      links: [
        { href: "/privacy", label: t("privacy") },
        { href: "/terms", label: t("terms") },
        { href: "/refund-policy", label: t("refund") },
      ],
    },
    {
      title: t("company"),
      links: [
        { href: "/contact", label: t("contact") },
        { href: "/report-abuse", label: t("reportAbuse") },
      ],
    },
  ];

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          {groups.map((g) => (
            <div key={g.title}>
              <h3 className="text-sm font-semibold">{g.title}</h3>
              <ul className="mt-3 space-y-2">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
          {t("copyright", { year })}
        </div>
        <div className="mt-2 text-center text-xs text-muted-foreground">
          ICP备案号：{process.env.NEXT_PUBLIC_ICP_NUMBER || "京ICP备2024XXXXXX号"} · 公安备案号：{process.env.NEXT_PUBLIC_PS_NUMBER || "京公网安备 11010XXXXXXX号"}
        </div>
      </div>
    </footer>
  );
}