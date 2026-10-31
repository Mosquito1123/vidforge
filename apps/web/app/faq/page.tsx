import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about VidForge.",
};

export default function FaqPage() {
  return <StaticPage ns="faq" />;
}
