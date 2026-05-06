"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import Image from "./Image";
import Video from "./Video";
import MediaViewer from "./MediaViewer";
import TypingDots from "./TypingDots";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { socket } from "@/socket";
import { api, apiMultipart } from "@/lib/api";
import { useSession } from "@/providers/SessionProvider";
import type { MessageItem } from "@breadit/shared";

type MessagesPage = { items: MessageItem[]; nextCursor: number | null };
type OtherUser = { id: string; username: string; displayName: string | null; img: string | null; lastReadAt?: string | null; };
type Props = { conversationId: number; initialData: MessagesPage; otherUser: OtherUser };

const isVideo = (url: string) =>
  /\.(mp4|mov|webm|ogg)$/i.test(url) || url.includes("/video/upload/");

const timeLabel = (d: string) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fetchMessages = async (id: number, cursor?: number): Promise<MessagesPage> => {
  const q = cursor ? `?cursor=${cursor}` : "";
  const res = await api(`/api/conversations/${id}/messages${q}`);
  return res.json();
};

// ── pending-file entry ──────────────────────────────────────────────────────
type PendingFile = { file: File; preview: string };

const makePending = (f: File): PendingFile => ({
  file: f,
  preview: URL.createObjectURL(f),
});

// ── main component ──────────────────────────────────────────────────────────
const MessageThread = ({ conversationId, initialData, otherUser }: Props) => {
  const router = useRouter();
  const session = useSession();
  const queryClient = useQueryClient();

  const [body, setBody] = useState("");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{
    url: string;
    type: "image" | "video";
  } | null>(null);

  const [partnerReadAt, setPartnerReadAt] = useState<Date | null>(() =>
    otherUser.lastReadAt ? new Date(otherUser.lastReadAt) : null
  );

  const { partnerTyping, onKeystroke, onSent } = useTypingIndicator(
    conversationId,
    session?.user.username ?? "",
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }) =>
      fetchMessages(conversationId, pageParam as number | undefined),
    initialPageParam: undefined as number | undefined,
    initialData: { pages: [initialData], pageParams: [undefined] },
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });

  const allMessages = data?.pages.slice().reverse().flatMap((p) => p.items) ?? [];

  // scroll to bottom on first load
  useEffect(() => {
    if (!didScrollRef.current && allMessages.length > 0) {
      bottomRef.current?.scrollIntoView();
      didScrollRef.current = true;
    }
  }, [allMessages.length]);

  // scroll to bottom when partner typing indicator appears
  useEffect(() => {
    if (partnerTyping) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [partnerTyping]);

  // mark read + clear badge
  useEffect(() => {
    api(`/api/conversations/${conversationId}/read`, { method: "PATCH" });
    window.dispatchEvent(new CustomEvent("messages:clear-badge"));
  }, [conversationId]);

  // real-time incoming messages
  useEffect(() => {
    const handler = (payload: { conversationId: number; message: MessageItem }) => {
      if (payload.conversationId !== conversationId) return;
      appendToCache(payload.message);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };
    
    const readHandler = (payload: { conversationId: number; readerId: string }) => {
      if (payload.conversationId === conversationId && payload.readerId === otherUser.id) {
        setPartnerReadAt(new Date());
      }
    };

    socket.on("newMessage", handler);
    socket.on("messageRead", readHandler);
    return () => { 
      socket.off("newMessage", handler); 
      socket.off("messageRead", readHandler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, otherUser.id]);

  // cleanup blob URLs
  useEffect(() => {
    return () => { pending.forEach((p) => URL.revokeObjectURL(p.preview)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendToCache = useCallback(
    (msg: MessageItem) => {
      queryClient.setQueryData<{ pages: MessagesPage[]; pageParams: unknown[] }>(
        ["messages", conversationId],
        (old) => {
          if (!old) return old;
          const first = old.pages[0];
          return { ...old, pages: [{ ...first, items: [...first.items, msg] }, ...old.pages.slice(1)] };
        },
      );
    },
    [conversationId, queryClient],
  );

  // ── file helpers ────────────────────────────────────────────────────────
  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
    );
    if (!arr.length) return;
    setPending((prev) => [...prev, ...arr.map(makePending)]);
  }, []);

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(pending[idx].preview);
    setPending((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── paste handler ───────────────────────────────────────────────────────
  const onPaste = useCallback(
    (e: React.ClipboardEvent | ClipboardEvent) => {
      const items = (e as ClipboardEvent).clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    },
    [addFiles],
  );

  // global paste listener so user doesn't have to focus textarea
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("paste", onPaste as EventListener);
    return () => el.removeEventListener("paste", onPaste as EventListener);
  }, [onPaste]);

  // ── drag & drop ─────────────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ── send ────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = body.trim();
    if ((!text && pending.length === 0) || sending) return;
    onSent();
    setSending(true);

    const filesToSend = [...pending];
    setBody("");
    setPending([]);

    // send text first (if any)
    if (text) {
      const res = await api(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        appendToCache(await res.json());
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    }

    // upload & send each file as its own message
    for (const { file, preview } of filesToSend) {
      URL.revokeObjectURL(preview);
      const form = new FormData();
      form.append("file", file);
      const up = await apiMultipart("/api/uploads", form);
      if (!up.ok) continue;
      const { filename } = await up.json();
      const res = await api(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ mediaUrl: filename }),
      });
      if (res.ok) {
        appendToCache(await res.json());
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    }

    setSending(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const onScroll = () => {
    if (!scrollRef.current || !hasNextPage) return;
    if (scrollRef.current.scrollTop === 0) {
      const prevH = scrollRef.current.scrollHeight;
      fetchNextPage().then(() => {
        if (scrollRef.current)
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevH;
      });
    }
  };

  const myId = session?.user.id;
  const canSend = (body.trim().length > 0 || pending.length > 0) && !sending;

  // ── grouped messages (consecutive same sender = no repeat avatar) ───────
  type GroupedMsg = MessageItem & { showAvatar: boolean; isFirst: boolean };
  const grouped: GroupedMsg[] = allMessages.map((msg, i) => {
    const next = allMessages[i + 1];
    const prev = allMessages[i - 1];
    return {
      ...msg,
      showAvatar: msg.senderId !== myId && (!next || next.senderId !== msg.senderId),
      isFirst: !prev || prev.senderId !== msg.senderId,
    };
  });

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full outline-none"
      tabIndex={-1}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* ── drag overlay ── */}
      {dragging && (
        <div className="absolute inset-0 z-50 bg-iconBlue/20 border-2 border-dashed border-iconBlue rounded-lg flex items-center justify-center pointer-events-none">
          <p className="text-iconBlue font-semibold text-lg">Drop files here</p>
        </div>
      )}

      {/* ── header ── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-borderGray shrink-0">
        <button
          onClick={() => router.push("/messages")}
          className="p-1 rounded-full hover:bg-[#181818] lg:hidden"
        >
          ←
        </button>
        <div className="w-10 h-10 relative rounded-full overflow-hidden shrink-0">
          <Image path={otherUser.img || "general/noAvatar.png"} alt="" fill className="object-cover object-center" tr={true} />
        </div>
        <div>
          <p className="font-semibold">{otherUser.displayName || otherUser.username}</p>
          <p className="text-textGray text-xs">@{otherUser.username}</p>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => {
              const lastMsg = allMessages[allMessages.length - 1];
              window.dispatchEvent(
                new CustomEvent("open-chat-popup", {
                  detail: {
                    conversationId,
                    message: lastMsg || { senderId: myId },
                    senderHint: otherUser,
                  },
                })
              );
              router.push("/");
            }}
            className="p-2 rounded-full hover:bg-[#181818] text-textGray hover:text-white"
            title="Pop out chat"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── messages ── */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1"
      >
        {hasNextPage && (
          <button
            onClick={() => {
              const prevH = scrollRef.current?.scrollHeight ?? 0;
              fetchNextPage().then(() => {
                if (scrollRef.current)
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevH;
              });
            }}
            className="text-iconBlue text-sm text-center py-2 hover:underline"
          >
            Load older messages
          </button>
        )}

        {grouped.map((msg) => {
          const isMe = msg.senderId === myId;
          const isVid = msg.mediaUrl ? isVideo(msg.mediaUrl) : false;
          const isLastRead =
            partnerReadAt &&
            isMe &&
            msg.id ===
              allMessages
                .filter(
                  (m) => m.senderId === myId && new Date(m.createdAt).getTime() <= partnerReadAt.getTime()
                )
                .pop()?.id;

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} ${
                msg.isFirst ? "mt-3" : "mt-0.5"
              }`}
            >
              {/* other user avatar slot */}
              {!isMe && (
                <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mb-0.5">
                  {msg.showAvatar ? (
                    <Image
                      path={otherUser.img || "general/noAvatar.png"}
                      alt=""
                      w={28}
                      h={28}
                      tr={true}
                    />
                  ) : (
                    <div className="w-7 h-7" />
                  )}
                </div>
              )}

              <div className={`flex flex-col gap-0.5 max-w-[65%] ${isMe ? "items-end" : "items-start"}`}>
                {msg.mediaUrl && (
                  <div className="rounded-2xl overflow-hidden max-w-[280px]">
                    {isVid ? (
                      <Video path={msg.mediaUrl} className="w-full max-h-64 object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          msg.mediaUrl.startsWith("http")
                            ? msg.mediaUrl
                            : `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000"}/uploads/${msg.mediaUrl}`
                        }
                        alt="media"
                        className="w-full max-h-64 object-cover cursor-pointer hover:opacity-90"
                        onClick={() => setSelectedMedia({ url: msg.mediaUrl!, type: "image" })}
                      />
                    )}
                  </div>
                )}
                {msg.body && (
                  <div
                    className={`px-4 py-2 rounded-2xl text-sm break-words ${
                      isMe
                        ? "bg-iconBlue text-white rounded-br-sm"
                        : "bg-[#2f3336] text-white rounded-bl-sm"
                    }`}
                  >
                    {msg.body}
                  </div>
                )}
                {msg.showAvatar && !isMe && (
                  <span className="text-[11px] text-textGray px-1">
                    {timeLabel(msg.createdAt)}
                  </span>
                )}
                {isLastRead && (
                  <span className="text-[11px] text-textGray px-1">
                    Seen {timeLabel(partnerReadAt.toISOString())}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {partnerTyping && (
          <TypingDots avatarPath={otherUser.img} size="md" />
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── file previews ── */}
      {pending.length > 0 && (
        <div className="px-4 pt-3 border-t border-borderGray/50 shrink-0">
          <div className="flex flex-wrap gap-2">
            {pending.map((p, i) => (
              <div key={i} className="relative group">
                {p.file.type.startsWith("video/") ? (
                  <video
                    src={p.preview}
                    className="w-20 h-20 object-cover rounded-xl border border-borderGray"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.preview}
                    alt="preview"
                    className="w-20 h-20 object-cover rounded-xl border border-borderGray"
                  />
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center text-xs hover:bg-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
                {/* video indicator */}
                {p.file.type.startsWith("video/") && (
                  <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1 text-[10px]">
                    ▶
                  </div>
                )}
              </div>
            ))}
            {/* add more button */}
            <button
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-xl border border-dashed border-borderGray flex items-center justify-center text-textGray hover:border-iconBlue hover:text-iconBlue transition-colors text-2xl"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* ── input bar ── */}
      <div className="px-4 py-3 flex items-end gap-3 shrink-0 border-t border-borderGray">
        <button
          onClick={() => fileRef.current?.click()}
          className="p-2 rounded-full hover:bg-[#181818] shrink-0 text-textGray hover:text-white transition-colors"
          title="Attach media (or paste)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
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
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="flex-1 bg-[#2f3336] rounded-2xl px-4 py-2 flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              onKeystroke();
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste as React.ClipboardEventHandler<HTMLTextAreaElement>}
            placeholder={pending.length ? "Add a caption…" : "Start a new message"}
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none text-sm overflow-hidden leading-5"
            style={{ minHeight: "20px", maxHeight: "120px" }}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!canSend}
          className="p-2.5 rounded-full bg-iconBlue disabled:opacity-40 shrink-0 hover:bg-blue-500 transition-colors"
          title="Send (⌘+Enter)"
        >
          {sending ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="animate-spin">
              <path d="M12 2a10 10 0 1 0 10 10" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          )}
        </button>
      </div>

      {/* hint text */}
      {pending.length === 0 && (
        <p className="text-center text-textGray text-[11px] pb-1">
          ⌘+Enter to send · Paste or drag images/videos
        </p>
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
};

export default MessageThread;
