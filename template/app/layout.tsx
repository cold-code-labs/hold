import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hold instance",
  description: "A Hold-backed app — Postgres + RLS + better-auth.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
