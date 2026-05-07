"use client";

import Image from "./Image";
import PostInfo from "./PostInfo";
import PostInteractions from "./PostInteractions";
import RichText from "./RichText";
import Video from "./Video";
import MediaViewer from "./MediaViewer";
import Link from "next/link";
import { useState } from "react";
import { Post as PostType, MentionEntity } from "@breadit/shared";
import { format } from "timeago.js";

type UserSummary = {
  displayName: string | null;
  username: string;
  img: string | null;
};

type CommunitySummary = {
  name: string;
  slug: string;
} | null;

type Engagement = {
  _count: { likes: number; rePosts: number; comments: number };
  likes: { id: number }[];
  rePosts: { id: number }[];
  saves: { id: number }[];
};

export type PostWithDetails = PostType &
  Engagement & {
    user: UserSummary;
    mentions?: MentionEntity[];
    community?: CommunitySummary;
    rePost?: (PostType & Engagement & { user: UserSummary; mentions?: MentionEntity[]; community?: CommunitySummary }) | null;
  };

const Post = ({
  type,
  post,
}: {
  type?: "status" | "comment";
  post: PostWithDetails;
}) => {
  const [selectedMedia, setSelectedMedia] = useState<{
    url: string;
    type: "image" | "video";
  } | null>(null);
  const originalPost = post.rePost || post;

  return (
    <div className="p-4 border-y-[1px] border-borderGray">
      {/* POST TYPE */}
      {post.rePost && (
        <div className="flex items-center gap-2 text-sm text-textGray mb-2 from-bold">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
          >
            <path
              fill="#71767b"
              d="M4.75 3.79l4.603 4.3-1.706 1.82L6 8.38v7.37c0 .97.784 1.75 1.75 1.75H13V20H7.75c-2.347 0-4.25-1.9-4.25-4.25V8.38L1.853 9.91.147 8.09l4.603-4.3zm11.5 2.71H11V4h5.25c2.347 0 4.25 1.9 4.25 4.25v7.37l1.647-1.53 1.706 1.82-4.603 4.3-4.603-4.3 1.706-1.82L18 15.62V8.25c0-.97-.784-1.75-1.75-1.75z"
            />
          </svg>
          <span>{post.user.displayName} reposted</span>
        </div>
      )}
      {originalPost.community && (
        <div className="flex items-center gap-2 text-sm text-textGray mb-2 font-bold">
           <Link href={`/c/${originalPost.community.slug}`} className="hover:underline flex items-center gap-1">
             <div className="w-4 h-4 relative rounded-sm overflow-hidden bg-iconBlue/20">
               <Image path="icons/community.svg" alt="" w={16} h={16}/>
             </div>
             <span>c/{originalPost.community.slug}</span>
           </Link>
        </div>
      )}
      {/* POST CONTENT */}
      <div className={`flex gap-4 ${type === "status" && "flex-col"}`}>
        {/* AVATAR */}

        <div
          className={`${
            type === "status" && "hidden"
          } relative w-10 h-10 rounded-full overflow-hidden -z-10`}
        >
          <Image
            path={originalPost.user.img || "general/noAvatar.png"}
            alt=""
            fill
            className="object-cover object-center"
            tr={true}
          />
        </div>

        {/* CONTENT */}
        <div className="flex-1 flex flex-col gap-2">
          {/* TOP */}
          <div className="w-full flex justify-between">
            <Link
              href={`/${originalPost.user.username}`}
              className="flex gap-4"
            >
              <div
                className={`${
                  type !== "status" && "hidden"
                } relative w-10 h-10 rounded-full overflow-hidden`}
              >
                <Image
                  path={originalPost.user.img || "general/noAvatar.png"}
                  alt=""
                  fill
                  className="object-cover object-center"
                  tr={true}
                />
              </div>
              <div
                className={`flex items-center gap-2 flex-wrap ${
                  type === "status" && "flex-col gap-0 !items-start"
                }`}
              >
                <h1 className="text-md font-bold">
                  {originalPost.user.displayName}
                </h1>
                <span
                  className={`text-textGray ${type === "status" && "text-sm"}`}
                >
                  @{originalPost.user.username}
                </span>
                {type !== "status" && (
                  <span className="text-textGray">
                    {format(originalPost.createdAt)}
                    {new Date(originalPost.updatedAt).getTime() -
                      new Date(originalPost.createdAt).getTime() >
                      1000
                      ? " (edited)"
                      : ""}
                  </span>
                )}
              </div>
            </Link>
            <PostInfo
              postId={originalPost.id}
              postUserId={originalPost.userId}
              postDesc={originalPost.desc}
              postMedia={originalPost.media}
            />
          </div>
          {/* TEXT & MEDIA */}
          <Link
            href={`/${originalPost.user.username}/status/${originalPost.id}`}
          >
            <p className={`${type === "status" && "text-lg"}`}>
              {originalPost.desc ? (
                <RichText
                  text={originalPost.desc}
                  mentions={originalPost.mentions}
                />
              ) : null}
            </p>
          </Link>
          {originalPost.media && originalPost.media.length > 0 && (
            <div
              className={`grid gap-0.5 rounded-2xl overflow-hidden border border-borderGray ${
                originalPost.media.length > 1 ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {originalPost.media.map((m) => (
                <div
                  key={m.id}
                  className={`relative transition-opacity ${m.type === "IMAGE" ? "cursor-pointer hover:opacity-90" : ""} ${
                    originalPost.media.length === 3 && m === originalPost.media[0]
                      ? "row-span-2"
                      : ""
                  }`}
                  onClick={() => {
                    if (m.type === "IMAGE") {
                      setSelectedMedia({
                        url: m.url,
                        type: "image",
                      });
                    }
                  }}
                >
                  {m.type === "IMAGE" ? (
                    <Image
                      path={m.url}
                      alt=""
                      w={600}
                      h={600}
                      className={`w-full h-full object-cover ${
                        originalPost.isSensitive ? "blur-3xl" : ""
                      }`}
                    />
                  ) : (
                    <Video
                      path={m.url}
                      className={`w-full h-full object-cover ${
                        originalPost.isSensitive ? "blur-3xl" : ""
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {type === "status" && (
            <span className="text-textGray">
              {new Date(originalPost.createdAt).toLocaleString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}{" "}
              ·{" "}
              {new Date(originalPost.createdAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {new Date(originalPost.updatedAt).getTime() -
                new Date(originalPost.createdAt).getTime() >
                1000
                ? " (edited)"
                : ""}
            </span>
          )}
          <PostInteractions
            username={originalPost.user.username}
            postId={originalPost.id}
            count={originalPost._count}
            isLiked={!!(originalPost.likes?.length)}
            isRePosted={!!(originalPost.rePosts?.length)}
            isSaved={!!(originalPost.saves?.length)}
          />
        </div>
      </div>
      {selectedMedia && (
        <MediaViewer
          url={selectedMedia.url}
          type={selectedMedia.type}
          onClose={() => setSelectedMedia(null)}
        />
      )}
    </div>
  );
};

export default Post;
