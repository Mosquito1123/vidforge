import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Eraser, Mic, Scissors, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "AI Video Tools",
  description: "Edit, clean up and voice AI-generated videos with dedicated pipelines.",
};

const TOOLS = [
  { href: "/generate", key: "generate", icon: Sparkles, credits: 10 },
  { href: "/tools/edit", key: "edit", icon: Scissors, credits: 12 },
  { href: "/tools/watermark", key: "watermark", icon: Eraser, credits: 15 },
  { href: "/tools/voiceover", key: "voiceover", icon: Mic, credits: 18 },
] as const;

export default async function ToolsPage() {
  const t = await getTranslations();

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("toolsPage.title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("toolsPage.subtitle")}</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.href} href={tool.href} className="group focus-visible:outline-none">
              <Card className="h-full transition-colors group-hover:border-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardHeader className="space-y-2 pb-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <CardTitle className="text-base">{t(`toolsPage.cards.${tool.key}.title`)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t(`toolsPage.cards.${tool.key}.description`)}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{t("toolsPage.fromCredits", { credits: tool.credits })}</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
