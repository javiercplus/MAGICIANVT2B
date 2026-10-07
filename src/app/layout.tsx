import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "MagicianVT2b · VRM avatar web app",
  description:
    "VRM avatar viewer with mouse gaze tracking, microphone-driven lip sync, green screen, and screen recording. Runs natively on Linux (no Wine). 100% offline.",
  keywords: [
    "MagicianVT2b",
    "VRM",
    "Three.js",
    "three-vrm",
    "gaze tracking",
    "lip sync",
    "avatar",
    "Linux",
    "offline",
  ],
  authors: [{ name: "MagicianVT2b" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "MagicianVT2b",
    description:
      "VRM avatar viewer with gaze tracking, lip sync, green screen, and screen recording.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MagicianVT2b",
    description:
      "VRM avatar viewer with gaze tracking, lip sync, green screen, and screen recording.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={`${GeistSans.className} antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
