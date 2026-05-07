import InfiniteFeed from "./InfiniteFeed";
import { serverFetch } from "@/lib/session";

const Feed = async ({
  userProfileId,
  feed,
}: {
  userProfileId?: string;
  feed?: string;
}) => {
  const params = new URLSearchParams({ cursor: "1" });
  if (userProfileId) params.set("user", userProfileId);
  if (feed) params.set("feed", feed);
  const res = await serverFetch(`/api/posts?${params}`);
  const initialData = res.ok ? await res.json() : undefined;

  return (
    <InfiniteFeed
      key={[userProfileId ?? "", feed ?? "", ""].join("|")}
      userProfileId={userProfileId}
      feed={feed}
      initialData={initialData}
    />
  );
};

export default Feed;
