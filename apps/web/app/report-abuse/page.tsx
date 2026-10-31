import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = {
  title: "Report Abuse",
  description: "Report abusive, illegal, or rights-infringing content on VidForge.",
};

export default function ReportAbusePage() {
  return <StaticPage ns="reportAbuse" />;
}
