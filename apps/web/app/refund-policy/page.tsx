import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Refund eligibility and process for VidForge subscriptions and credits.",
};

export default function RefundPolicyPage() {
  return <StaticPage ns="refund" />;
}
