import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Красивый чарник D100",
  description: "Интерактивный лист персонажа для настольной ролевой системы D100.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
