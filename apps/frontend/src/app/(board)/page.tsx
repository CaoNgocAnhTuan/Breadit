import Feed from "@/components/Feed";
import Share from "@/components/Share";
import Link from "next/link";

const Homepage = async ({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string; algo?: string }>;
}) => {
  const params = await searchParams;
  const validFeeds = ["explore", "following", "communities"] as const;
  const feed = validFeeds.includes((params.feed ?? "") as (typeof validFeeds)[number])
    ? (params.feed as (typeof validFeeds)[number])
    : undefined;
  // The ranking of For You. It is used only when no other feed is chosen (the backend refuses algo with feed).
  const algos = [
    { value: "chrono", label: "Chronological" },
    { value: "engagement", label: "Engagement" },
    { value: "social", label: "Social" },
  ] as const;
  const algo = feed
    ? undefined
    : algos.find((a) => a.value === params.algo)?.value;

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
      {!feed && (
        <div className="flex gap-2 px-4 py-2 border-b-[1px] border-borderGray text-sm text-textGray">
          {algos.map((a) => (
            <Link
              key={a.value}
              className={`px-3 py-1 rounded-full transition-colors duration-150 hover:bg-white/10 ${
                algo === a.value ? "bg-white/10 text-white font-bold" : ""
              }`}
              href={`/?algo=${a.value}`}
            >
              {a.label}
            </Link>
          ))}
        </div>
      )}
      <Share />
      <Feed feed={feed} algo={algo} />
    </div>
  );
};

export default Homepage;
