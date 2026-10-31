"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

const LOCALES = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中文" },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;
    router.refresh();
  };

  return (
    <select
      value={locale}
      onChange={onChange}
      aria-label="Language"
      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
    >
      {LOCALES.map((l) => (
        <option key={l.value} value={l.value}>
          {l.label}
        </option>
      ))}
    </select>
  );
}