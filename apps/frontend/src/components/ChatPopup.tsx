"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "./Image";
import Video from "./Video";
import MediaViewer from "./MediaViewer";
import TypingDots from "./TypingDots";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { api, apiMultipart } from "@/lib/api";
import { socket } from "@/socket";
import { useSession } from "@/providers/SessionProvider";
import type { MessageItem } from "@breadit/shared";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

const isVideo = (url: string) =>
  /\.(mp4|mov|webm|ogg)$/i.test(url) || url.includes("/video/upload/");

const resolveMedia = (url: string) =>
  url.startsWith("http") ? url : `${BACKEND_URL}/uploads/${url}`;

const timeLabel = (d: string) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export type OtherUser = {
  id: string;
  username: string;
  displayName: string | null;
  img: string | null;
  lastReadAt?: string | null;
};

export type ChatPopupHandle = {
  conversationId: number;
  otherUser: OtherUser;
  minimized: boolean;
  unread: number;
};

type PendingFile = { file: File; preview: string };

type Props = {
  popup: ChatPopupHandle;
  incomingMessage: MessageItem | null; // latest pushed from parent
  onClose: () => void;
  onToggleMinimize: () => void;
  onRead: () => void;
};

export default function ChatPopup({
  popup,
  incomingMessage,
  onClose,
  onToggleMinimize,
  onRead,
}: Props) {
  const session = useSession();
  const myId = session?.user.id;

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{
    url: string;
    type: "image" | "video";
  } | null>(null);
  const [partnerReadAt, setPartnerReadAt] = useState<Date | null>(() =>
    popup.otherUser.lastReadAt ? new Date(popup.otherUser.lastReadAt) : null
  );

  const { partnerTyping, onKeystroke, onSent } = useTypingIndicator(
    popup.conversationId,
    session?.user.username ?? "",
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // listen for messageRead
  useEffect(() => {
    const readHandler = (payload: { conversationId: number; readerId: string }) => {
      if (payload.conversationId === popup.conversationId && payload.readerId === popup.otherUser.id) {
        setPartnerReadAt(new Date());
      }
    };
    socket.on("messageRead", readHandler);
    return () => { socket.off("messageRead", readHandler); };
  }, [popup.conversationId, popup.otherUser.id]);

  // load last page of messages on mount
  useEffect(() => {
    api(`/api/conversations/${popup.conversationId}/messages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items: MessageItem[] } | null) => {
        if (data) setMessages(data.items);
        setLoaded(true);
        setTimeout(() => bottomRef.current?.scrollIntoView(), 30);
      });
   
  }, [popup.conversationId]);

  // scroll to bottom when expanded
  useEffect(() => {
    if (!popup.minimized) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      onRead();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup.minimized]);

  // scroll to bottom when partner typing dots appear
  useEffect(() => {
    if (partnerTyping && !popup.minimized) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerTyping]);

  // append incoming messages from parent manager
  useEffect(() => {
    if (!incomingMessage) return;
    setMessages((prev) => {
      if (prev.find((m) => m.id === incomingMessage.id)) return prev;
      return [...prev, incomingMessage];
    });
    if (!popup.minimized) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingMessage]);

  // file helpers
  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
    );
    if (!arr.length) return;
    setPending((prev) => [
      ...prev,
      ...arr.map((f) => ({ file: f, preview: URL.createObjectURL(f) })),
    ]);
  }, []);

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(pending[idx].preview);
    setPending((prev) => prev.filter((_, i) => i !== idx));
  };

  // paste
  useEffect(() => {
    const el = containerRef.current;
    if (!el || popup.minimized) return;
    const handler = (e: ClipboardEvent) => {
      const files: File[] = [];
      for (const item of e.clipboardData?.items ?? []) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) { e.preventDefault(); addFiles(files); }
    };
    el.addEventListener("paste", handler);
    return () => el.removeEventListener("paste", handler);
  }, [addFiles, popup.minimized]);

  // cleanup blobs
  useEffect(() => {
    return () => { pending.forEach((p) => URL.revokeObjectURL(p.preview)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendMsg = (msg: MessageItem) => {
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const handleSend = async () => {
    const text = body.trim();
    if ((!text && pending.length === 0) || sending) return;
    onSent();
    setSending(true);

    const filesToSend = [...pending];
    setBody("");
    setPending([]);

    if (text) {
      const res = await api(
        `/api/conversations/${popup.conversationId}/messages`,
        { method: "POST", body: JSON.stringify({ body: text }) },
      );
      if (res.ok) appendMsg(await res.json());
    }

    for (const { file, preview } of filesToSend) {
      URL.revokeObjectURL(preview);
      const form = new FormData();
      form.append("file", file);
      const up = await apiMultipart("/api/uploads", form);
      if (!up.ok) continue;
      const { filename } = await up.json();
      const res = await api(
        `/api/conversations/${popup.conversationId}/messages`,
        { method: "POST", body: JSON.stringify({ mediaUrl: filename }) },
      );
      if (res.ok) appendMsg(await res.json());
    }

    setSending(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (body.trim().length > 0 || pending.length > 0) && !sending;

  return (
    <div
      ref={containerRef}
      className="flex flex-col w-[320px] rounded-t-2xl shadow-2xl border border-borderGray bg-black overflow-hidden"
      style={{ maxHeight: popup.minimized ? "52px" : "440px" }}
    >
      {/* ── header ── */}
      <button
        onClick={onToggleMinimize}
        className="flex items-center gap-2 px-3 py-3 hover:bg-[#181818] transition-colors cursor-pointer shrink-0 w-full text-left"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
            <Image
              path={popup.otherUser.img || "general/noAvatar.png"}
              alt=""
              w={32}
              h={32}
              tr={true}
            />
          </div>
          {popup.minimized && popup.unread > 0 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-iconBlue rounded-full flex items-center justify-center text-[10px] font-bold">
              {popup.unread > 9 ? "9+" : popup.unread}
            </div>
          )}
        </div>
        <span className="font-semibold text-sm flex-1 truncate">
          {popup.otherUser.displayName || popup.otherUser.username}
        </span>
        {popup.minimized ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-textGray shrink-0">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-textGray shrink-0">
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-0.5 rounded-full hover:bg-gray-700 text-textGray shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </button>

      {!popup.minimized && (
        <>
          {/* ── messages ── */}
          <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1 min-h-0">
            {!loaded && (
              <p className="text-textGray text-xs text-center py-4">Loading…</p>
            )}
            {loaded && messages.length === 0 && (
              <p className="text-textGray text-xs text-center py-4">
                No messages yet. Say hi!
              </p>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.senderId === myId;
              const prev = messages[i - 1];
              const isFirst = !prev || prev.senderId !== msg.senderId;
              const isVid = msg.mediaUrl ? isVideo(msg.mediaUrl) : false;
              const isLastRead =
                partnerReadAt &&
                isMe &&
                msg.id ===
                  messages
                    .filter(
                      (m) => m.senderId === myId && new Date(m.createdAt).getTime() <= partnerReadAt.getTime()
                    )
                    .pop()?.id;

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-1.5 ${isMe ? "flex-row-reverse" : "flex-row"} ${isFirst ? "mt-2" : "mt-0.5"}`}
                >
                  {!isMe && (
                    <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mb-0.5">
                      {isFirst ? (
                        <Image
                          path={popup.otherUser.img || "general/noAvatar.png"}
                          alt=""
                          w={24}
                          h={24}
                          tr={true}
                        />
                      ) : (
                        <div className="w-6 h-6" />
                      )}
                    </div>
                  )}
                  <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                    {msg.mediaUrl && (
                      <div className="rounded-xl overflow-hidden max-w-[200px]">
                        {isVid ? (
                          <Video path={msg.mediaUrl} className="w-full max-h-40 object-cover" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveMedia(msg.mediaUrl)}
                            alt="media"
                            className="w-full max-h-40 object-cover cursor-pointer hover:opacity-90"
                            onClick={() => setSelectedMedia({ url: msg.mediaUrl!, type: "image" })}
                          />
                        )}
                      </div>
                    )}
                    {msg.body && (
                      <div
                        className={`px-3 py-1.5 rounded-2xl text-sm break-words leading-5 ${
                          isMe
                            ? "bg-iconBlue text-white rounded-br-sm"
                            : "bg-[#2f3336] text-white rounded-bl-sm"
                        }`}
                      >
                        {msg.body}
                      </div>
                    )}
                    {(!messages[i + 1] || messages[i + 1].senderId !== msg.senderId) && !isMe && (
                      <span className="text-[10px] text-textGray px-1">
                        {timeLabel(msg.createdAt)}
                      </span>
                    )}
                    {isLastRead && (
                      <span className="text-[10px] text-textGray px-1">
                        Seen {timeLabel(partnerReadAt.toISOString())}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {partnerTyping && (
              <TypingDots avatarPath={popup.otherUser.img} size="sm" />
            )}
            <div ref={bottomRef} />
          </div>

          {/* ── file previews ── */}
          {pending.length > 0 && (
            <div className="px-3 pt-2 flex flex-wrap gap-1.5 shrink-0">
              {pending.map((p, i) => (
                <div key={i} className="relative group">
                  {p.file.type.startsWith("video/") ? (
                    <video src={p.preview} className="w-14 h-14 object-cover rounded-lg border border-borderGray" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.preview} alt="" className="w-14 h-14 object-cover rounded-lg border border-borderGray" />
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-gray-700 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── input ── */}
          <div className="px-3 py-2 flex items-end gap-2 shrink-0 border-t border-borderGray/50">
            <button
              onClick={() => fileRef.current?.click()}
              className="p-1 rounded-full hover:bg-[#181818] text-textGray shrink-0"
              title="Attach (or paste)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
            />
            <div className="flex-1 bg-[#2f3336] rounded-2xl px-3 py-1.5">
              <textarea
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  onKeystroke();
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
                }}
                onKeyDown={onKeyDown}
                placeholder={pending.length ? "Add caption…" : "Aa"}
                rows={1}
                className="w-full bg-transparent outline-none resize-none text-sm leading-5 overflow-hidden"
                style={{ minHeight: "20px", maxHeight: "80px" }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="p-1.5 rounded-full bg-iconBlue disabled:opacity-40 shrink-0"
            >
              {sending ? (
                <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
              )}
            </button>
          </div>
        </>
      )}
      {selectedMedia && (
        <MediaViewer
          url={selectedMedia.url}
          type={selectedMedia.type}
          onClose={() => setSelectedMedia(null)}
        />
      )}
    </div>
  );
}
