"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "./Image";
import { api } from "@/lib/api";

type Props = {
  targetUserId: string;
};

const MessageButton = ({ targetUserId }: Props) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    const res = await api("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ targetUserId }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/messages/${data.id}`);
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-9 h-9 flex items-center justify-center rounded-full border-[1px] border-gray-500 cursor-pointer hover:bg-[#181818] disabled:opacity-50"
    >
      <Image path="icons/message.svg" alt="Message" w={20} h={20} />
    </button>
  );
};

export default MessageButton;
