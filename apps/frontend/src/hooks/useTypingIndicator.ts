"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "@/socket";

/**
 * Manages both sides of the typing indicator for a single conversation:
 *  - Emits startTyping / stopTyping when the local user types
 *  - Listens for userTyping / userStopTyping from the partner
 *
 * Call joinConversation() on mount and leaveConversation() on unmount (handled internally).
 */
export function useTypingIndicator(conversationId: number, username: string) {
  const [partnerTyping, setPartnerTyping] = useState(false);

  const isTypingRef = useRef(false);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // join / leave conversation room
  useEffect(() => {
    socket.emit("joinConversation", conversationId);
    return () => {
      socket.emit("leaveConversation", conversationId);
      // clean up our own typing state on unmount
      if (isTypingRef.current) {
        socket.emit("stopTyping", { conversationId });
        isTypingRef.current = false;
      }
    };
  }, [conversationId]);

  // listen for partner typing events
  useEffect(() => {
    const onTyping = (payload: { conversationId: number }) => {
      if (payload.conversationId !== conversationId) return;
      setPartnerTyping(true);
      // auto-hide if stopTyping is never received (e.g. page closed)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setPartnerTyping(false), 4000);
    };

    const onStop = (payload: { conversationId: number }) => {
      if (payload.conversationId !== conversationId) return;
      setPartnerTyping(false);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };

    socket.on("userTyping", onTyping);
    socket.on("userStopTyping", onStop);
    return () => {
      socket.off("userTyping", onTyping);
      socket.off("userStopTyping", onStop);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [conversationId]);

  /** Call on every keystroke in the input textarea */
  const onKeystroke = () => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("startTyping", { conversationId, username });
    }
    // reset the stop-typing debounce timer (3 s of silence)
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    sendTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("stopTyping", { conversationId });
    }, 3000);
  };

  /** Call when the message is sent so the indicator drops immediately */
  const onSent = () => {
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit("stopTyping", { conversationId });
    }
  };

  return { partnerTyping, onKeystroke, onSent };
}
