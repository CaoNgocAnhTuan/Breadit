import InfiniteFeed from "@/components/InfiniteFeed";
import Share from "@/components/Share";
import CommunityHeader from "./CommunityHeader";
import PendingPostsBanner from "./PendingPostsBanner";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

async function getCommunity(slug: string) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("breadit_session")?.value;

    const res = await fetch(`${process.env.BACKEND_INTERNAL_URL}/api/communities/${slug}`, {
      headers: sessionToken ? { Cookie: `breadit_session=${sessionToken}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getInitialPosts(communityId: number) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("breadit_session")?.value;
    const res = await fetch(
      `${process.env.BACKEND_INTERNAL_URL}/api/posts?cursor=1&communityId=${communityId}`,
      {
        headers: sessionToken ? { Cookie: `breadit_session=${sessionToken}` } : {},
        cache: "no-store",
      }
    );
    if (!res.ok) return { posts: [], hasMore: false };
    return res.json();
  } catch {
    return { posts: [], hasMore: false };
  }
}

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = await getCommunity(slug);

  if (!community) {
    notFound();
  }

  if (community.isBanned) {
    return (
      <div className="">
        <CommunityHeader community={community} />
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-4">
          <span className="text-4xl">🚫</span>
          <h2 className="text-xl font-bold">You are banned from this community</h2>
          <p className="text-textGray text-sm max-w-xs">
            You cannot view posts, join, or interact with c/{community.slug}.
          </p>
        </div>
      </div>
    );
  }

  const initialPosts = await getInitialPosts(community.id);
  const role = community.membership?.role ?? null;
  const isStaff = role === "OWNER" || role === "MOD";

  return (
    <div className="">
      <CommunityHeader community={community} />
      {isStaff && <PendingPostsBanner communityId={community.id} />}
      <Share communityId={community.id} />
      <InfiniteFeed communityId={community.id} initialData={initialPosts} />
    </div>
  );
}
