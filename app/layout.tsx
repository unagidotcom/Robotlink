import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Article Visibility",
  description: "Agency visibility foundation for third-party content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
