import Feed from "@/components/Feed";
import Share from "@/components/Share";
import Link from "next/link";

const Homepage = async ({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) => {
  const params = await searchParams;
  const validFeeds = ["explore", "following", "communities"] as const;
  const feed = validFeeds.includes((params.feed ?? "") as (typeof validFeeds)[number])
    ? (params.feed as (typeof validFeeds)[number])
    : undefined;

  return (
    <div className="">
      <div className="px-4 pt-4 flex justify-between text-textGray font-bold border-b-[1px] border-borderGray">
        <Link
          className={`pb-3 px-2 flex items-center transition-colors duration-150 hover:bg-white/10 ${
            !feed ? "border-b-4 border-iconBlue text-white" : ""
          }`}
          href="/"
        >
          For you
        </Link>
        <Link
          className={`pb-3 px-2 flex items-center transition-colors duration-150 hover:bg-white/10 ${
            feed === "explore" ? "border-b-4 border-iconBlue text-white" : ""
          }`}
          href="/?feed=explore"
        >
          Explore
        </Link>
        <Link
          className={`hidden pb-3 px-2 md:flex items-center transition-colors duration-150 hover:bg-white/10 ${
            feed === "following" ? "border-b-4 border-iconBlue text-white" : ""
          }`}
          href="/?feed=following"
        >
          Following
        </Link>
        <Link
          className={`hidden pb-3 px-2 md:flex items-center transition-colors duration-150 hover:bg-white/10 ${
            feed === "communities" ? "border-b-4 border-iconBlue text-white" : ""
          }`}
          href="/?feed=communities"
        >
          Communities
        </Link>
      </div>
      <Share />
      <Feed feed={feed} />
    </div>
  );
};

export default Homepage;
