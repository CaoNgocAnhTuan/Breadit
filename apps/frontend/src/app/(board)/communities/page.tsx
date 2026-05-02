import Link from "next/link";
import Image from "@/components/Image";
import { cookies } from "next/headers";

async function getCommunities() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("breadit_session")?.value;
    const res = await fetch(`${process.env.BACKEND_INTERNAL_URL}/api/communities`, {
      headers: sessionToken ? { Cookie: `breadit_session=${sessionToken}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function CommunitiesPage() {
  const communities = await getCommunities();

  return (
    <div className="">
      <div className="flex items-center justify-between p-4 sticky top-0 bg-black/60 backdrop-blur-md z-10">
        <h1 className="text-xl font-bold">Communities</h1>
        <Link
          href="/communities/new"
          className="bg-white text-black font-bold py-2 px-4 rounded-full text-sm"
        >
          Create Community
        </Link>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {communities.length === 0 ? (
          <p className="text-textGray">No communities found. Create one!</p>
        ) : (
          communities.map((c: {
            id: number;
            name: string;
            slug: string;
            img?: string;
            description?: string;
            _count?: { members: number };
          }) => (
            <Link
              key={c.id}
              href={`/c/${c.slug}`}
              className="border border-borderGray rounded-xl p-4 hover:bg-[#181818] transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 relative rounded-lg overflow-hidden bg-iconBlue/20">
                  <Image
                    path={c.img || "general/event.png"}
                    alt={c.name}
                    w={100}
                    h={100}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold truncate">{c.name}</h2>
                  <p className="text-sm text-textGray truncate">c/{c.slug}</p>
                </div>
              </div>
              <p className="mt-2 text-sm line-clamp-2 text-textGray">
                {c.description || "No description provided."}
              </p>
              <div className="mt-2 text-xs text-textGray">
                {c._count?.members || 0} members
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
