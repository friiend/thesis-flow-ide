import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "ThesisFlow-IDE | 学术论文协同写作工作台",
  description: "通用学术论文协同写作工作台 - Local-First, 极致节省Token成本",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-gradient-to-br from-stone-200 via-stone-100 to-amber-50/30`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
