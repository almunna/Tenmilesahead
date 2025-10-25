// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "../components/AuthProvider";
import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";

export const metadata: Metadata = {
  title: "Ten Miles Ahead",
  description: "Milestone 1 — Trips, Uploader, Flipbook",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-slate-900 antialiased">
        <AuthProvider>
          <Navbar />
          {children}
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
