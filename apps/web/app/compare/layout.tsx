import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare AI Video Models",
  description: "Compare AI video generation models by provider, type, cost, and capabilities.",
  openGraph: {
    title: "Compare AI Video Models — VidForge",
    description: "Compare AI video generation models by provider, type, cost, and capabilities.",
  },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
