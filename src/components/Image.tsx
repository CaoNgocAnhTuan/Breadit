"use client";

import NextImage from "next/image";

type ImageType = {
  path?: string;
  src?: string;
  w?: number;
  h?: number;
  alt: string;
  className?: string;
  tr?: boolean;
};

const resolve = (p?: string, src?: string) => {
  if (src) return src;
  if (!p) return "";
  return p.startsWith("/") ? p : `/${p}`;
};

const Image = ({ path, src, w, h, alt, className, tr: _tr }: ImageType) => {
  const url = resolve(path, src);
  if (!url) return null;
  return (
    <NextImage
      src={url}
      width={w ?? 100}
      height={h ?? 100}
      alt={alt}
      className={className}
      unoptimized={url.startsWith("blob:") || url.startsWith("data:")}
    />
  );
};

export default Image;
