import Link from "next/link";
import { serverFetch } from "@/lib/session";
import Image from "@/components/Image";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type SearchUser = {
  id: string;
  username: string;
  displayName: string | null;
  img: string | null;
};

type SearchHashtag = { id: number; tag: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SearchResults = { posts: any[]; users: SearchUser[]; hashtags: SearchHashtag[] };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  let results: SearchResults = { posts: [], users: [], hashtags: [] };

  if (query) {
    const res = await serverFetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (res.ok) results = await res.json();
  }

  const hasResults =
    results.users.length > 0 ||
    results.hashtags.length > 0 ||
    results.posts.length > 0;

  return (
    <div>
      <div className="sticky top-0 bg-black/80 backdrop-blur-sm z-10 px-4 py-3 border-b border-borderGray">
        <h1 className="font-bold text-xl">
          {query ? `Search results for "${query}"` : "Search"}
        </h1>
      </div>

      {!query && (
        <p className="text-center text-textGray py-10">Enter a query to search.</p>
      )}

      {query && !hasResults && (
        <p className="text-center text-textGray py-10">No results for &ldquo;{query}&rdquo;</p>
      )}

      {results.users.length > 0 && (
        <section className="border-b border-borderGray">
          <p className="px-4 pt-4 pb-2 font-bold text-sm text-textGray uppercase tracking-wide">People</p>
          {results.users.map((u) => (
            <Link
              key={u.id}
              href={`/${u.username}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/5"
            >
              <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  src={u.img ? `${BACKEND_URL}/uploads/${u.img}` : undefined}
                  alt={u.username}
                  w={40}
                  h={40}
                  tr
                />
              </div>
              <div>
                <p className="font-semibold leading-tight">{u.displayName ?? u.username}</p>
                <p className="text-textGray text-sm">@{u.username}</p>
              </div>
            </Link>
          ))}
        </section>
      )}

      {results.hashtags.length > 0 && (
        <section className="border-b border-borderGray">
          <p className="px-4 pt-4 pb-2 font-bold text-sm text-textGray uppercase tracking-wide">Hashtags</p>
          {results.hashtags.map((h) => (
            <Link
              key={h.id}
              href={`/hashtag/${h.tag}`}
              className="block px-4 py-3 hover:bg-white/5 font-semibold"
            >
              #{h.tag}
            </Link>
          ))}
        </section>
      )}

      {results.posts.length > 0 && (
        <section>
          <p className="px-4 pt-4 pb-2 font-bold text-sm text-textGray uppercase tracking-wide">Posts</p>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {results.posts.map((p: any) => (
            <Link
              key={p.id}
              href={`/${p.user.username}/status/${p.id}`}
              className="flex flex-col px-4 py-3 hover:bg-white/5 border-b border-borderGray"
            >
              <span className="text-textGray text-sm">@{p.user.username}</span>
              <span className="line-clamp-2">{p.desc}</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
