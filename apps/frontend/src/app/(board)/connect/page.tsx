import { redirect } from "next/navigation";
import { getSession, serverFetch } from "@/lib/session";
import ConnectFeed from "./ConnectFeed";

export default async function ConnectPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");

  const res = await serverFetch("/api/users/connect?cursor=1");
  const data = res.ok
    ? await res.json()
    : { users: [], hasMore: false };

  return (
    <div>
      <div className="sticky top-0 bg-black/80 backdrop-blur-sm z-10 px-4 py-3 border-b border-borderGray">
        <h1 className="font-bold text-xl">Connect</h1>
        <p className="text-textGray text-sm">People you might know</p>
      </div>

      {data.users.length === 0 ? (
        <p className="text-center text-textGray py-10">No suggestions right now &mdash; check back later</p>
      ) : (
        <ConnectFeed initialUsers={data.users} initialHasMore={data.hasMore} />
      )}
    </div>
  );
}
