"use client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type VideoTypes = { path: string; className?: string };

const Video = ({ path, className }: VideoTypes) => {
  const url =
    path.startsWith("https://") || path.startsWith("http://")
      ? path
      : path.includes("/")
        ? path.startsWith("/") ? path : `/${path}`
        : `${BACKEND_URL}/uploads/${path}`;
  return <video src={url} controls className={className} />;
};

export default Video;
