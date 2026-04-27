"use client";

type VideoTypes = { path: string; className?: string };

const Video = ({ path, className }: VideoTypes) => {
  const url = path.startsWith("/") ? path : `/${path}`;
  return <video src={url} controls className={className} />;
};

export default Video;
