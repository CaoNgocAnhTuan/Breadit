"use client";

import { useState } from "react";
import ProfileTabFeed from "./ProfileTabFeed";

const TABS = ["posts", "replies", "media", "likes"] as const;
type Tab = (typeof TABS)[number];

const ProfileTabs = ({ username, query }: { username: string; query?: string }) => {
  const [activeTab, setActiveTab] = useState<Tab>("posts");

  return (
    <div>
      <div className="flex border-b border-borderGray">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-4 capitalize text-sm font-medium hover:bg-white/5 transition-colors ${
              activeTab === tab
                ? "text-white border-b-2 border-iconBlue"
                : "text-textGray"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <ProfileTabFeed username={username} tab={activeTab} query={query ?? ""} />
    </div>
  );
};

export default ProfileTabs;
