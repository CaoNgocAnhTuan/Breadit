import Feed from "@/components/Feed";
import Share from "@/components/Share";
import Link from "next/link";

const Homepage = async ({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) => {
  const params = await searchParams;
  const feed = params.feed === "explore" ? "explore" : undefined;

  return (
    <div className="">
      <div className="px-4 pt-4 flex justify-between text-textGray font-bold border-b-[1px] border-borderGray">
        <Link
          className={`pb-3 flex items-center ${!feed ? "border-b-4 border-iconBlue text-white" : ""}`}
          href="/"
        >
          For you
        </Link>
        <Link
          className={`pb-3 flex items-center ${feed === "explore" ? "border-b-4 border-iconBlue text-white" : ""}`}
          href="/?feed=explore"
        >
          Explore
        </Link>
        <Link className="hidden pb-3 md:flex items-center" href="/">
          React.js
        </Link>
        <Link className="hidden pb-3 md:flex items-center" href="/">
          Javascript
        </Link>
        <Link className="hidden pb-3 md:flex items-center" href="/">
          CSS
        </Link>
      </div>
      <Share />
      <Feed feed={feed} />
    </div>
  );
};

export default Homepage;
