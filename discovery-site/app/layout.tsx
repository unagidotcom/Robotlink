import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { getSiteUrl, siteDescription, siteName } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: { default: siteName, template: `%s · ${siteName}` },
  description: siteDescription,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": [{ url: "/feed.xml", title: `${siteName} RSS feed` }] },
  },
  openGraph: { type: "website", siteName, title: siteName, description: siteDescription },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <footer>
          <p>Independent travel notes, edited for people before crawlers.</p>
          <p><a href="/feed.xml">RSS feed</a> · <a href="/audit">Publication log</a></p>
        </footer>
      </body>
    </html>
  );
}
