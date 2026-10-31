import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = {
  title: "Blog",
  description: "News, tutorials, and updates from VidForge.",
};

export default function BlogPage() {
  return <StaticPage ns="blog" />;
}
