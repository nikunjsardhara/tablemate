import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
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
  title: "Tablemate — ask the café",
  description:
    "Scan the QR code, ask the café a question, and meet the person who answers it best.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fafaf9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-50 text-zinc-900">
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-stone-50/95 backdrop-blur">
          <div className="mx-auto flex h-12 max-w-md items-center justify-center gap-2">
            <span aria-hidden>☕</span>
            <span className="text-sm font-semibold tracking-tight">
              Tablemate
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-4">
          {children}
        </main>
        {/* usePathname is request-time state, so the tab bar streams in
            behind this boundary while the rest of the shell prerenders. */}
        <Suspense fallback={null}>
          <Nav />
        </Suspense>
      </body>
    </html>
  );
}
