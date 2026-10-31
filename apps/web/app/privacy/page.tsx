import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How VidForge collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return <StaticPage ns="privacy" />;
}
