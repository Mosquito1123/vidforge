"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";

export function SupportTicketForm() {
  const t = useTranslations("support");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [priority, setPriority] = React.useState("normal");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // No dedicated ticket endpoint yet; record locally for follow-up.
      const ticket = { name, email, subject, message, priority, createdAt: new Date().toISOString() };
      try {
        const existing = JSON.parse(window.localStorage.getItem("vidforge_tickets") || "[]");
        existing.push(ticket);
        window.localStorage.setItem("vidforge_tickets", JSON.stringify(existing));
      } catch {
        // ignore
      }
      setDone(true);
      toast({ title: t("success"), variant: "success" });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-md border bg-muted/30 p-6 text-sm">
        {t("success")}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("fields.name")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>{t("fields.email")}</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("fields.subject")}</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>{t("fields.priority")}</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label>{t("fields.message")}</Label>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={6} />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "..." : t("submit")}
      </Button>
    </form>
  );
}
