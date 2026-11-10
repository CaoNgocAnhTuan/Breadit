import InfiniteFeed from "./InfiniteFeed";
import { serverFetch } from "@/lib/session";

const Feed = async ({
  userProfileId,
  feed,
  algo,
}: {
  userProfileId?: string;
  feed?: string;
  algo?: string;
}) => {
  const params = new URLSearchParams({ cursor: "1" });
  if (userProfileId) params.set("user", userProfileId);
  if (feed) params.set("feed", feed);
  if (algo) params.set("algo", algo);
  const res = await serverFetch(`/api/posts?${params}`);
  const initialData = res.ok ? await res.json() : undefined;

  return (
    <InfiniteFeed
      key={[userProfileId ?? "", feed ?? "", algo ?? "", ""].join("|")}
      userProfileId={userProfileId}
      feed={feed}
      algo={algo}
      initialData={initialData}
    />
  );
};

export default Feed;
