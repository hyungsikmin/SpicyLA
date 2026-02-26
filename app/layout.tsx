import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

import VisitorPing from '@/components/VisitorPing'

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)

const supabaseOrigin =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string'
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : null

export const metadata: Metadata = {
  metadataBase: baseUrl ? new URL(baseUrl) : undefined,
  title: "아니스비",
  description: "LA 20·30 익명 커뮤니티. Reddit-like anonymous community for Korean Americans in Los Angeles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {supabaseOrigin ? (
          <link rel="preconnect" href={supabaseOrigin} />
        ) : null}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',t==='dark');})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen bg-background text-foreground`}
      >
        <VisitorPing />
        {children}
      </body>
    </html>
  );
}
