import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AGU Kampus Takvimi",
  description: "AGU ogrenci etkinlikleri icin merkezi kampus takvimi."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
