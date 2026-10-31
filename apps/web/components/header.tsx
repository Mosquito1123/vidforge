"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CreditsBadge } from "@/components/credits-badge";
import { LanguageSwitcher } from "@/components/language-switcher";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

const primaryLinks = [
  { href: "/generate", key: "nav.generate" },
  { href: "/tools", key: "nav.tools" },
  { href: "/dashboard", key: "nav.dashboard" },
  { href: "/pricing", key: "nav.pricing" },
  { href: "/billing", key: "nav.billing" },
] as const;

export function Header() {
  const t = useTranslations();
  const pathname = usePathname();
  const [credits, setCredits] = React.useState<number | null>(null);
  const [authed, setAuthed] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("vidforge_token") : null;
    if (!token) return;
    setAuthed(true);
    api.me().then(({ data }) => {
      if (data) {
        api.creditsBalance().then(({ data: cb }) => {
          if (cb) setCredits(Number(cb.balance));
        });
      }
    });
  }, []);

  // Keep the badge fresh when another view spends or tops up credits.
  React.useEffect(() => {
    const onCredits = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      if (typeof detail === "number" && Number.isFinite(detail)) setCredits(detail);
    };
    window.addEventListener("vidforge:credits", onCredits);
    return () => window.removeEventListener("vidforge:credits", onCredits);
  }, []);

  // Close the mobile menu on navigation.
  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const logout = async () => {
    await api.logout();
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold">
          <Film className="h-5 w-5" aria-hidden="true" />
          <span>{t("nav.brand")}</span>
        </Link>

        <nav className="hidden gap-6 md:flex" aria-label={t("nav.primary")}>
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground",
                pathname === link.href ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-3 md:flex">
            <LanguageSwitcher />
            {credits !== null && <CreditsBadge credits={credits} />}
            {authed ? (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/account">{t("nav.account")}</Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={logout}>
                  {t("nav.logout")}
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">{t("nav.login")}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">{t("nav.signup")}</Link>
                </Button>
              </>
            )}
          </div>

          {authed && credits !== null && (
            <div className="md:hidden">
              <CreditsBadge credits={credits} />
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-nav" className="border-t bg-background md:hidden">
          <nav className="container mx-auto flex flex-col gap-1 px-4 py-3" aria-label={t("nav.primary")}>
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {t(link.key)}
              </Link>
            ))}

            <div className="my-2 h-px bg-border" />

            {authed ? (
              <>
                <Link
                  href="/account"
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                >
                  {t("nav.account")}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                >
                  {t("nav.logout")}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 px-1 py-1">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/login">{t("nav.login")}</Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link href="/register">{t("nav.signup")}</Link>
                </Button>
              </div>
            )}

            <div className="px-1 py-2">
              <LanguageSwitcher />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
