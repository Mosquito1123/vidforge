"use client";

import { Coins } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function CreditsBadge({
  credits,
  className,
}: {
  credits: number;
  className?: string;
}) {
  const t = useTranslations();
  return (
    <Badge variant="secondary" className={cn("gap-1", className)}>
      <Coins className="h-3.5 w-3.5" />
      {credits} {t("common.credits")}
    </Badge>
  );
}