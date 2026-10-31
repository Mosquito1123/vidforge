import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = {
  title: "Free Tools",
  description: "Free utilities for creators using VidForge.",
};

export default function FreeToolsPage() {
  return <StaticPage ns="freeTools" />;
}
