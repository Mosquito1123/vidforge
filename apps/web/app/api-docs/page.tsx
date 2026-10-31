import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = {
  title: "API Documentation",
  description: "Programmatic access to VidForge video generation.",
};

export default function ApiDocsPage() {
  return <StaticPage ns="apiDocs" />;
}
