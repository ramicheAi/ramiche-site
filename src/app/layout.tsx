import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Parallax Operations",
  description: "Automation dock — all projects, all signals, one view",
  manifest: "/manifest.json",
  icons: {
    icon: "/parallax-icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Parallax",
  },
  other: {
    "theme-color": "#1a1a5e",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          if('serviceWorker' in navigator){
            navigator.serviceWorker.getRegistrations().then(function(regs){
              regs.forEach(function(r){r.unregister()});
            });
            caches.keys().then(function(keys){
              keys.forEach(function(k){caches.delete(k)});
            });
          }
        `}} />
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
