"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type TrendingTag = { tag: string; postCount: number };

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const PopularTags = () => {
  const { data: tags = [] } = useQuery<TrendingTag[]>({
    queryKey: ["trending-hashtags"],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/hashtags/trending`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (tags.length === 0) return null;

  return (
    <div className="p-4 rounded-2xl border-[1px] border-borderGray flex flex-col gap-3">
      <h1 className="text-xl font-bold text-textGrayLight">Trending</h1>
      {tags.map((t) => (
        <Link
          key={t.tag}
          href={`/hashtag/${t.tag}`}
          className="block hover:bg-white/5 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
        >
          <h2 className="text-textGrayLight font-bold">#{t.tag}</h2>
          <span className="text-textGray text-sm">
            {formatCount(t.postCount)} posts
          </span>
        </Link>
      ))}
      <Link href="/search" className="text-iconBlue text-sm">
        Show More
      </Link>
    </div>
  );
};

export default PopularTags;
