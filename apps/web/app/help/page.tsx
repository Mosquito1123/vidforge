import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = {
  title: "Help Center",
  description: "Guides and answers for using VidForge.",
};

export default function HelpPage() {
  return <StaticPage ns="help" />;
}
