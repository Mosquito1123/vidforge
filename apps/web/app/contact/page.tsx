import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";
import { SupportTicketForm } from "@/components/support-ticket-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact VidForge support.",
};

export default function ContactPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 space-y-8">
      <StaticPage ns="contact" />
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Support ticket</h2>
        <SupportTicketForm />
      </div>
    </div>
  );
}
