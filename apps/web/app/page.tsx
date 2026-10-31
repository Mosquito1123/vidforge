import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Film, Zap, Shield } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Home",
  description: "Generate stunning videos from text and images with AI.",
};

export default async function LandingPage() {
  const t = await getTranslations();
  return (
    <div>
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Now in beta
          </div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            {t("hero.subtitle")}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/generate">{t("hero.cta")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/pricing">{t("hero.secondary")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto grid gap-6 px-4 py-12 md:grid-cols-3">
        {[
          { icon: Film, title: t("tools.prompt"), desc: t("hero.subtitle") },
          { icon: Zap, title: t("generate.generate"), desc: t("hero.subtitle") },
          { icon: Shield, title: t("common.success"), desc: t("hero.subtitle") },
        ].map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <f.icon className="h-8 w-8 text-primary" />
              <CardTitle className="mt-2">{f.title}</CardTitle>
              <CardDescription>{f.desc}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </section>
    </div>
  );
}