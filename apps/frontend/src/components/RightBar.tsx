import Link from "next/link";
import Recommendations from "./Recommendations";
import Search from "./Search";
import ChatToggleButton from "./ChatToggleButton";

const RightBar = () => {
  return (
    <div className="pt-4 flex flex-col gap-4 sticky top-0 h-[calc(100vh-16px)]">
      <Search />
      <Recommendations />
      <div className="mt-auto sticky bottom-4 flex justify-end">
        <ChatToggleButton />
      </div>
      <div className="text-textGray text-sm flex gap-x-4 flex-wrap">
        <Link href="/">Terms of Service</Link>
        <Link href="/">Privacy Policy</Link>
        <Link href="/">Cookie Policy</Link>
        <Link href="/">Accessibility</Link>
        <span>© 2026 CaoNgocAnhTuan ~ Thesis.</span>
      </div>
    </div>
  );
};

export default RightBar;
