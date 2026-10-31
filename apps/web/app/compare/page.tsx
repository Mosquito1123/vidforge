"use client";

import * as React from "react";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, type ApiModel } from "@/lib/api";
import { toast } from "@/lib/toast";

type SortKey = "name" | "creditsCost" | "provider";

function toNumber(v: number | string | undefined | null): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function metaString(m: ApiModel, key: string): string {
  const md = m.metadata as Record<string, unknown> | null | undefined;
  const v = md?.[key];
  return typeof v === "string" ? v : "";
}

export default function ComparePage() {
  const t = useTranslations();
  const [models, setModels] = React.useState<ApiModel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [provider, setProvider] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("active");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const res = await api.listModels(true);
      if (!mounted) return;
      if (res.data) {
        setModels(res.data);
      } else {
        setError(res.error || "Failed to load models");
        toast({ title: "Could not load models", description: res.error || undefined, variant: "destructive" });
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const providers = React.useMemo(() => {
    const set = new Set(models.map((m) => m.provider));
    return ["all", ...Array.from(set).sort()];
  }, [models]);

  const types = React.useMemo(() => {
    const set = new Set(models.map((m) => m.type));
    return ["all", ...Array.from(set).sort()];
  }, [models]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = models.filter((m) => {
      if (provider !== "all" && m.provider !== provider) return false;
      if (type !== "all" && m.type !== type) return false;
      if (status === "active" && !m.active) return false;
      if (status === "inactive" && m.active) return false;
      if (q) {
        const hay = `${m.name} ${m.slug} ${m.provider} ${m.type}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "provider") cmp = a.provider.localeCompare(b.provider);
      else cmp = toNumber(a.creditsCost) - toNumber(b.creditsCost);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [models, query, provider, type, status, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("compare.title")}</h1>
          <p className="text-muted-foreground">{t("compare.subtitle")}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/generate">Start generating</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2 lg:col-span-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search models..."
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Provider</Label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {providers.map((p) => (
                <option key={p} value={p}>
                  {p === "all" ? "All" : p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {types.map((ty) => (
                <option key={ty} value={ty}>
                  {ty === "all" ? "All" : ty}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-8">
          <span className="text-sm text-muted-foreground">{t("common.loading")}</span>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No models match your filters.
          </CardContent>
        </Card>
      )}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  <button onClick={() => toggleSort("name")} className="hover:underline">
                    Model {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  <button onClick={() => toggleSort("provider")} className="hover:underline">
                    Provider {sortKey === "provider" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">
                  <button onClick={() => toggleSort("creditsCost")} className="hover:underline">
                    Credits {sortKey === "creditsCost" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium">Max duration</th>
                <th className="px-4 py-3 text-left font-medium">Resolution</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((m) => {
                const maxDur = metaString(m, "maxDurationSeconds") || metaString(m, "maxDuration");
                const res = metaString(m, "maxResolution") || metaString(m, "resolution");
                return (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.slug}</div>
                    </td>
                    <td className="px-4 py-3 capitalize">{m.provider}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{m.type}</Badge>
                    </td>
                    <td className="px-4 py-3">{toNumber(m.creditsCost)}</td>
                    <td className="px-4 py-3">{maxDur || "—"}</td>
                    <td className="px-4 py-3">{res || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.active ? "default" : "secondary"}>
                        {m.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {m.active ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/generate?model=${encodeURIComponent(m.slug || m.id)}`}>
                            Generate
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          Generate
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {models.length} models.
      </p>
    </div>
  );
}
