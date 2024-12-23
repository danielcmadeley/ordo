import "./globals.css";
import "@repo/ui/styles.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import DashboardHeader from "./components/dashboard-header";

const nohemi = localFont({
  src: [
    {
      path: "./fonts/nohemilight.woff",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/nohemiregular.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/nohemimedium.woff",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/nohemibold.woff",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-nohemi",
});

export const metadata: Metadata = {
  title: "Ordo - Dashboard",
  description: "Bring order to complexity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`bg-[#FBFEFB] h-screen w-screen overflow-hidden font-nohemi ${nohemi.variable}`}
      >
        <Suspense fallback={<div className="h-[40px]" />}>
          <DashboardHeader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
