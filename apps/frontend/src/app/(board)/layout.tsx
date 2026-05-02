import LeftBar from "@/components/LeftBar";
import RightBar from "@/components/RightBar";
import HideOnMessages from "@/components/HideOnMessages";
import ChatPopupManager from "@/components/ChatPopupManager";
import BoardLayoutClient from "./BoardLayoutClient";
import { getSession } from "@/lib/session";
import Link from "next/link";
import Logout from "@/components/Logout";

export default async function BoardLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  const session = await getSession();
  
  if (session?.user?.banned) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-center px-4">
        <h1 className="text-3xl font-bold">Your account has been suspended.</h1>
        <p className="text-textGray">Contact support if you believe this is an error.</p>
        <div className="mt-4 bg-iconBlue text-white px-6 py-2 rounded-full cursor-pointer hover:bg-opacity-90">
          <Logout />
        </div>
      </div>
    );
  }

  const isUnverified = session?.user && !session.user.emailVerified;

  const centerContent = (
    <>
      {isUnverified && (
        <div className="bg-iconBlue/10 border-b border-borderGray px-4 py-2 text-sm flex items-center justify-between">
          <span className="text-textGray">
            Please verify your email to post.
          </span>
          <Link
            href="/verify"
            className="text-iconBlue hover:underline font-medium"
          >
            Check your inbox
          </Link>
        </div>
      )}
      {children}
      {modal}
    </>
  );

  return (
    <>
      <BoardLayoutClient
        leftBar={<LeftBar />}
        rightBar={
          <HideOnMessages>
            <RightBar />
          </HideOnMessages>
        }
      >
        {centerContent}
      </BoardLayoutClient>
      <ChatPopupManager />
    </>
  );
}
