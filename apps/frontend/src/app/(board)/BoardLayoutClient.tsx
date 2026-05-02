"use client";

import { useState } from "react";

export default function BoardLayoutClient({
  leftBar,
  rightBar,
  children,
}: {
  leftBar: React.ReactNode;
  rightBar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);

  return (
    <div className="max-w-screen-md lg:max-w-screen-lg xl:max-w-screen-xl xxl:max-w-screen-xxl mx-auto flex justify-between relative">
      {/* Floating Toggle Controls */}
      <div className="fixed bottom-4 left-4 z-[60] flex gap-2">
        <button
          onClick={() => setShowLeft(!showLeft)}
          className="p-2 rounded-full bg-black/80 backdrop-blur border border-borderGray text-textGray hover:text-white transition-colors shadow-lg"
          title={showLeft ? "Hide Left Menu" : "Show Left Menu"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {showLeft ? (
              <path d="M15 18l-6-6 6-6" />
            ) : (
              <path d="M9 18l6-6-6-6" />
            )}
          </svg>
        </button>
      </div>

      <div className="fixed bottom-4 right-4 lg:right-8 z-[60] flex gap-2">
        <button
          onClick={() => setShowRight(!showRight)}
          className="p-2 rounded-full bg-black/80 backdrop-blur border border-borderGray text-textGray hover:text-white transition-colors shadow-lg hidden lg:flex"
          title={showRight ? "Hide Right Panel" : "Show Right Panel"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {showRight ? (
              <path d="M9 18l6-6-6-6" />
            ) : (
              <path d="M15 18l-6-6 6-6" />
            )}
          </svg>
        </button>
      </div>

      {/* Left Bar Area */}
      {showLeft && (
        <div className="px-2 xsm:px-4 xxl:px-8 relative z-50 shrink-0 w-[68px] xxl:w-[275px] transition-all duration-300">
          {leftBar}
        </div>
      )}

      {/* Center Feed Area */}
      <div
        className={`flex-1 border-x-[1px] border-borderGray transition-all duration-300 ${
          !showLeft && !showRight ? "max-w-3xl mx-auto" : "lg:min-w-[600px]"
        }`}
      >
        {children}
      </div>

      {/* Right Bar Area */}
      {showRight && (
        <div className="hidden lg:flex ml-4 md:ml-8 shrink-0 w-[350px] transition-all duration-300">
          {rightBar}
        </div>
      )}
    </div>
  );
}
