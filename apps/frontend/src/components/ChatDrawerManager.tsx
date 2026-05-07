"use client";

import { useCallback, useEffect, useState } from "react";
import ChatDrawer from "./ChatDrawer";

export default function ChatDrawerManager() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handler = () => toggle();
    window.addEventListener("chatdrawer:toggle", handler);
    return () => window.removeEventListener("chatdrawer:toggle", handler);
  }, [toggle]);

  useEffect(() => {
    const handler = () => close();
    window.addEventListener("open-chat-popup", handler);
    return () => window.removeEventListener("open-chat-popup", handler);
  }, [close]);

  return <ChatDrawer open={open} onClose={close} />;
}

