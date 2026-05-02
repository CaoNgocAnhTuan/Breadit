"use client";

import NextImage from "next/image";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type ImageType = {
  path?: string;
  src?: string;
  w?: number;
  h?: number;
  alt: string;
  className?: string;
  tr?: boolean;
  fill?: boolean;
};

export const resolve = (p?: string, src?: string) => {
  if (src) return src;
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  // bare filename (no "/") = backend-uploaded file
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
  if (!p.includes("/")) return `${BACKEND_URL}/uploads/${p}`;
  return p.startsWith("/") ? p : `/${p}`;
};

const Image = ({ path, src, w, h, alt, className, tr: _tr, fill }: ImageType) => {
  const url = resolve(path, src);
  if (!url) return null;
  return (
    <NextImage
      src={url}
      {...(!fill ? { width: w ?? 100, height: h ?? 100 } : { fill: true })}
      alt={alt}
      className={className}
      unoptimized={
        url.startsWith("blob:") ||
        url.startsWith("data:") ||
        url.startsWith(BACKEND_URL)
      }
    />
  );
};

export default Image;
