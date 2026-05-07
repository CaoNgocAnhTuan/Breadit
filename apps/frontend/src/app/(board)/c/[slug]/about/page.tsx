import CommunityHeader from "../CommunityHeader";
import CommunityAboutAdmin from "./CommunityAboutAdmin";
import Image from "@/components/Image";
import Link from "next/link";
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

type Member = {
  id: number;
  role: "MEMBER" | "MOD" | "OWNER";
  user: { id: string; username: string; displayName: string | null; img: string | null };
};

export default async function CommunityAboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = await getCommunity(slug);

  if (!community) {
    notFound();
  }

  const memberRole: "OWNER" | "MOD" | "MEMBER" | null = community.membership?.role ?? null;
  const isStaff = memberRole === "OWNER" || memberRole === "MOD";

  return (
    <div className="">
      <CommunityHeader community={community} />
      <div className="p-4 flex flex-col gap-6">

        {/* About */}
        <div>
          <h2 className="text-xl font-bold mb-2">About Community</h2>
          <p className="text-textGray">{community.description || "No description provided."}</p>
          <div className="flex gap-4 mt-2 text-sm text-textGray">
            <span><strong className="text-white">{community._count?.members ?? 0}</strong> Members</span>
            <span><strong className="text-white">{community._count?.posts ?? 0}</strong> Posts</span>
          </div>
        </div>

        {/* Rules */}
        <div>
          <h2 className="text-xl font-bold mb-2">Rules</h2>
          {community.rules?.length > 0 ? (
            <div className="flex flex-col gap-4">
              {community.rules.map((rule: { id: number; title: string; description?: string }, idx: number) => (
                <div key={rule.id} className="border-b border-borderGray pb-2">
                  <h3 className="font-bold">{idx + 1}. {rule.title}</h3>
                  {rule.description && <p className="text-sm text-textGray">{rule.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-textGray">No rules have been set for this community.</p>
          )}
        </div>

        {/* Members */}
        <div>
          <h2 className="text-xl font-bold mb-3">Members ({community._count?.members ?? 0})</h2>
          <div className="flex flex-col gap-3">
            {community.members?.map((m: Member) => (
              <div key={m.id} className="flex items-center justify-between">
                <Link href={`/${m.user.username}`} className="flex items-center gap-3 hover:opacity-80 transition">
                  <div className="w-8 h-8 rounded-full overflow-hidden relative bg-iconBlue/20 flex-shrink-0">
                    <Image path={m.user.img || "general/noAvatar.png"} alt="" w={32} h={32} />
                  </div>
                  <div>
                    <p className="font-bold text-sm leading-tight">{m.user.displayName || m.user.username}</p>
                    <p className="text-xs text-textGray">@{m.user.username}</p>
                  </div>
                </Link>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  m.role === "OWNER" ? "bg-yellow-500/20 text-yellow-400" :
                  m.role === "MOD"   ? "bg-blue-500/20 text-blue-400" :
                                       "bg-gray-500/20 text-gray-400"
                }`}>
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Admin panel — owners and mods only */}
        {isStaff && (
          <div>
            <h2 className="text-xl font-bold mb-3">Moderation</h2>
            <CommunityAboutAdmin
              communityId={community.id}
              communitySlug={community.slug}
              communityImg={community.img}
              communityCover={community.cover}
              members={community.members ?? []}
              role={memberRole as "OWNER" | "MOD"}
            />
          </div>
        )}

      </div>
    </div>
  );
}
