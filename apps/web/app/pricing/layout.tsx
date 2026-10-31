import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for AI video generation.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
