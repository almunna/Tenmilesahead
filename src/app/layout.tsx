// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "../components/AuthProvider";
import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";

export const metadata: Metadata = {
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
      {/* swapped to palette tokens */}
      <body className="min-h-dvh antialiased bg-background text-foreground site-bg">
        <AuthProvider>
          {/* keep content above decorative background layers */}
          <div className="relative z-10">
            <Navbar />
            {children}
            <SiteFooter />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
