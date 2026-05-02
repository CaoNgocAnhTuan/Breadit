import { redirect } from "next/navigation";
import { getSession, serverFetch } from "@/lib/session";
import Post from "@/components/Post";

export default async function BookmarksPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");

  const res = await serverFetch("/api/users/me/saved?cursor=1");
  const data = res.ok ? await res.json() : { posts: [], hasMore: false };

  return (
    <div>
      <div className="sticky top-0 bg-black/80 backdrop-blur-sm z-10 px-4 py-3 border-b border-borderGray">
        <h1 className="font-bold text-xl">Bookmarks</h1>
      </div>
      {data.posts.length === 0 ? (
        <p className="text-center text-textGray py-10">No bookmarks yet</p>
      ) : (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.posts.map((post: any) => (
          <Post key={post.id} post={post} />
        ))
      )}
    </div>
  );
}
