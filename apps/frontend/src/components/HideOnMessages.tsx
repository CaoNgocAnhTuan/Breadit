"use client";

import { usePathname } from "next/navigation";

export default function HideOnMessages({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname.startsWith("/messages")) return null;
  return <>{children}</>;
}
