import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = {
  title: "Use Cases",
  description: "How teams use VidForge to create video content.",
};

export default function UseCasesPage() {
  return <StaticPage ns="useCases" />;
}
