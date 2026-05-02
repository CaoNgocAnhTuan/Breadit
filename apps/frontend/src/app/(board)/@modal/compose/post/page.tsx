"use client";

import Share from "@/components/Share";
import { useRouter } from "next/navigation";

const PostModal = () => {
  const router = useRouter();

  return (
    <div className="absolute w-screen h-screen top-0 left-0 z-20 bg-[#293139a6] flex justify-center">
      <div className="py-4 px-8 rounded-xl bg-black w-[600px] h-max mt-12">
        {/* TOP */}
        <div className="flex items-center justify-between mb-2">
          <div className="cursor-pointer" onClick={() => router.back()}>
            X
          </div>
          <div className="text-iconBlue font-bold">Drafts</div>
        </div>
        {/* COMPOSE */}
        <Share />
      </div>
    </div>
  );
};

export default PostModal;
