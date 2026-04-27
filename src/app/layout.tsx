import "./globals.css";

import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import QueryProvider from "@/providers/QueryProvider";

export const metadata: Metadata = {
  title: "Lama Dev X Clone",
  description: "Next.js social media application project",
};

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SessionProvider>
      <QueryProvider>
        <html lang="en">
          <body>{children}</body>
        </html>
      </QueryProvider>
    </SessionProvider>
  );
}
