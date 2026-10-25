import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { copy } from "@/content/copy";
import "./globals.css";

// Archivo carries the display type (heavy, narrowed through its width axis); Inter carries the interface.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// the deployed site's address on Vercel (it sets VERCEL_PROJECT_PRODUCTION_URL), the dev server's elsewhere
const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3200";
const share = { url: "/og.png", width: 1200, height: 630, alt: copy.meta.title };

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: copy.meta.title,
  description: copy.meta.description,
  openGraph: { type: "website", siteName: copy.brand, title: copy.meta.title, description: copy.meta.description, images: [share] },
  twitter: { card: "summary_large_image", title: copy.meta.title, description: copy.meta.description, images: [share] },
};

// the page reaches under a phone's notch and home bar; the frame keeps its words clear of them (env(safe-area-inset-*))
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07080b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
