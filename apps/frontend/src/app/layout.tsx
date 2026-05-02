import "./globals.css";

import type { Metadata } from "next";
import { SessionProvider } from "@/providers/SessionProvider";
import QueryProvider from "@/providers/QueryProvider";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Lama Dev X Clone",
  description: "Next.js social media application project",
};

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <SessionProvider value={session}>
      <QueryProvider>
        <html lang="en">
          <body>{children}</body>
        </html>
      </QueryProvider>
    </SessionProvider>
  );
}
