import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { getPageSEO } from "@/lib/seo";
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
  ...getPageSEO("home"),
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
    "theme-color": "#0a0a0a",
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
    <html lang="en" className="dark" style={{ colorScheme: "dark", backgroundColor: "#0a0a0a" }}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try{
            if('serviceWorker' in navigator){
              navigator.serviceWorker.getRegistrations().then(function(regs){
                regs.forEach(function(r){r.unregister()});
              }).catch(function(){});
              caches.keys().then(function(keys){
                keys.forEach(function(k){caches.delete(k)});
              }).catch(function(){});
            }
          }catch(e){}
        `}} />
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable}`} style={{ backgroundColor: "#0a0a0a", color: "#ededed" }}>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
