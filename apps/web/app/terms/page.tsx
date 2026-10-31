import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing your use of VidForge.",
};

export default function TermsPage() {
  return <StaticPage ns="terms" />;
}
