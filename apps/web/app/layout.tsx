import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Toaster } from "@/components/toaster";

const inter = Inter({ subsets: ["latin"] });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "VidForge — AI Video Generation",
    template: "%s | VidForge",
  },
  description: "Generate stunning videos from text and images with AI.",
  openGraph: {
    title: "VidForge — AI Video Generation",
    description: "Generate stunning videos from text and images with AI.",
    url: APP_URL,
    siteName: "VidForge",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VidForge — AI Video Generation",
    description: "Generate stunning videos from text and images with AI.",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <Footer />
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}