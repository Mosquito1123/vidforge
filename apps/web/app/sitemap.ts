import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/compare",
    "/pricing",
    "/generate",
    "/dashboard",
    "/billing",
    "/account",
    "/login",
    "/register",
    "/privacy",
    "/terms",
    "/refund-policy",
    "/contact",
    "/report-abuse",
    "/faq",
    "/free-tools",
    "/use-cases",
    "/api-docs",
    "/blog",
  ];

  return routes.map((route) => ({
    url: `${APP_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
