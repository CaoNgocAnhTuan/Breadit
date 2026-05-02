"use client";

import { useRef } from "react";

const QuoteRepostModal = ({
  isReposted,
  isPending,
  onRepost,
  onClose,
}: {
  isReposted: boolean;
  isPending: boolean;
  onRepost: (_desc?: string) => void;
  onClose: () => void;
}) => {
  const descRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-black border border-borderGray rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          disabled={isPending}
          onClick={() => onRepost()}
          className="py-2 px-4 bg-white text-black font-bold rounded-full disabled:opacity-50"
        >
          {isReposted ? "Undo Repost" : "Repost"}
        </button>
        <div className="flex flex-col gap-2">
          <input
            ref={descRef}
            type="text"
            placeholder="Add a comment…"
            className="bg-transparent border border-borderGray rounded-xl px-3 py-2 text-sm outline-none"
            maxLength={255}
          />
          <button
            disabled={isPending}
            onClick={() => {
              const val = descRef.current?.value?.trim();
              if (val) onRepost(val);
            }}
            className="py-2 px-4 bg-white text-black font-bold rounded-full disabled:opacity-50"
          >
            Quote
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuoteRepostModal;
