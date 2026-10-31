import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth-guard";

export const metadata: Metadata = {
  title: "Generate",
  description: "Generate AI videos from text prompts and images.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
