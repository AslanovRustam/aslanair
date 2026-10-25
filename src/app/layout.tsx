import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
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

export const metadata: Metadata = {
  title: "AslanAir — choose your seat",
  description: "A concept: board a fictional airliner and pick your seat in real-time 3D.",
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
