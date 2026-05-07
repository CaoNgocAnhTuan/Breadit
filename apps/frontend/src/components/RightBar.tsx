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
      <div className="text-textGray text-[12px] flex flex-wrap items-center">
        <Link href="/">Terms of Service</Link>
        <span className="mx-2">|</span>
        <Link href="/">Privacy Policy</Link>
        <span className="mx-2">|</span>
        <Link href="/">Cookie Policy</Link>
        <span className="mx-2">|</span>
        <Link href="/">Accessibility</Link>
        <span className="mx-2">|</span>
        <span>© 2026 CaoNgocAnhTuan ~ Thesis.</span>
      </div>
    </div>
  );
};

export default RightBar;
