"use client";

import Share from "@/components/Share";
import { useRouter } from "next/navigation";

// N8: the full page for a direct load or a reload of /compose/post. In the app, a click on the Post
// button is intercepted by `@modal/(.)compose/post` and shows the same compose box over the feed.
const ComposePostPage = () => {
  const router = useRouter();

  return (
    <div className="p-4">
      {/* TOP */}
      <div className="flex items-center justify-between mb-2">
        {/* router.back() would leave the site after a direct load, so the close button goes home. */}
        <div
          className="cursor-pointer"
          role="button"
          tabIndex={0}
          aria-label="Close"
          onClick={() => router.push("/")}
          onKeyDown={(e) => {
            if (e.key === "Enter") router.push("/");
          }}
        >
          X
        </div>
        <div className="text-iconBlue font-bold">Drafts</div>
      </div>
      {/* COMPOSE */}
      <Share />
    </div>
  );
};

export default ComposePostPage;
