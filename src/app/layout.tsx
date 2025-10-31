// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "../components/AuthProvider";
import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";

export const metadata = {
  title: "Ten Miles Ahead",
  icons: {
    icon: "/logo.png", // favicon in most browsers
    shortcut: "/logo.png", // legacy shortcut icon
    apple: "/logo.png", // iOS home screen icon
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh text-slate-900 antialiased bg-blue-50 ">
        <AuthProvider>
          <Navbar />
          {children}
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
