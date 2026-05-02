import type { Metadata } from "next";
import Comments from "@/components/Comments";
import Image from "@/components/Image";
import Post from "@/components/Post";
import { getSession, serverFetch } from "@/lib/session";
import Link from "next/link";
import { notFound } from "next/navigation";

const BACKEND_INTERNAL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";

function resolveImg(p?: string | null): string | undefined {
  if (!p) return undefined;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  if (!p.includes("/")) return `${BACKEND_INTERNAL}/uploads/${p}`;
  return undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const res = await serverFetch(`/api/posts/${postId}`);
  if (!res.ok) return {};
  const post = await res.json();
  const author = post.user?.displayName ?? post.user?.username ?? "";
  const desc = post.desc ?? "";
  const title = `${author}: "${desc.slice(0, 80)}${desc.length > 80 ? "…" : ""}"`;
  const img = resolveImg(post.img) ?? resolveImg(post.user?.img);
  return {
    title,
    description: desc || undefined,
    openGraph: {
      title,
      description: desc || undefined,
      ...(img ? { images: [{ url: img }] } : {}),
    },
    twitter: { card: img ? "summary_large_image" : "summary", title },
  };
}

const StatusPage = async ({
  params,
}: {
  params: Promise<{ username: string; postId: string }>;
}) => {
  const session = await getSession();
  const userId = session?.user?.id;
  const postId = (await params).postId;

  if (!userId) return;

  const res = await serverFetch(`/api/posts/${postId}`);
  if (!res.ok) return notFound();
  const post = await res.json();

  const backHref = post.parentPost
    ? `/${post.parentPost.user.username}/status/${post.parentPostId}`
    : "/";

  return (
    <div className="">
      <div className="flex items-center gap-8 sticky top-0 backdrop-blur-md p-4 z-10 bg-[#00000084]">
        <Link href={backHref}>
          <Image path="icons/back.svg" alt="back" w={24} h={24} />
        </Link>
        <h1 className="font-bold text-lg">Post</h1>
      </div>
      <Post type="status" post={post} />
      <Comments
        comments={post.comments}
        postId={post.id}
        username={post.user.username}
        depth={post.parentPostId ? 1 : 0}
      />
    </div>
  );
};

export default StatusPage;
