"use client";

import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import Image from "./Image";
import { api } from "@/lib/api";

type FollowingUser = {
  id: string;
  username: string;
  displayName: string | null;
  img: string | null;
};

export type MentionInputHandle = {
  getValue: () => string;
  setValue: (_v: string) => void;
  focus: () => void;
};

type MentionInputProps = {
  placeholder?: string;
  className?: string;
  rows?: number;
  variant?: "input" | "textarea";
  autoFocus?: boolean;
};

const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  ({ placeholder, className, rows = 1, variant = "textarea", autoFocus }, ref) => {
    const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [suggestions, setSuggestions] = useState<FollowingUser[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [mentionQuery, setMentionQuery] = useState<{ query: string; startPos: number } | null>(null);

    useImperativeHandle(ref, () => ({
      getValue: () => inputRef.current?.value ?? "",
      setValue: (v: string) => {
        if (inputRef.current) inputRef.current.value = v;
      },
      focus: () => inputRef.current?.focus(),
    }));

    const findMentionQuery = useCallback(() => {
      const el = inputRef.current;
      if (!el) return null;

      const cursorPos = el.selectionStart ?? 0;
      const textBeforeCursor = el.value.slice(0, cursorPos);

      const atIdx = textBeforeCursor.lastIndexOf("@");
      if (atIdx === -1) return null;

      if (atIdx > 0 && /\S/.test(textBeforeCursor[atIdx - 1])) return null;

      const query = textBeforeCursor.slice(atIdx + 1);
      if (/\s/.test(query)) return null;

      return { query, startPos: atIdx };
    }, []);

    const handleInput = useCallback(() => {
      const result = findMentionQuery();
      if (result) {
        setMentionQuery(result);
        setSelectedIdx(0);
      } else {
        setMentionQuery(null);
        setShowDropdown(false);
        setSuggestions([]);
      }
    }, [findMentionQuery]);

    useEffect(() => {
      if (!mentionQuery) return;

      const timer = setTimeout(async () => {
        try {
          const res = await api(
            `/api/users/me/following/search?q=${encodeURIComponent(mentionQuery.query)}`
          );
          if (res.ok) {
            const data: FollowingUser[] = await res.json();
            setSuggestions(data);
            setShowDropdown(data.length > 0);
          }
        } catch {
          /* ignore */
        }
      }, 200);

      return () => clearTimeout(timer);
    }, [mentionQuery]);

    const insertMention = useCallback(
      (user: FollowingUser) => {
        const el = inputRef.current;
        if (!el || !mentionQuery) return;

        const before = el.value.slice(0, mentionQuery.startPos);
        const after = el.value.slice((el.selectionStart ?? 0));
        const newValue = `${before}@${user.username} ${after}`;
        el.value = newValue;

        const newCursorPos = mentionQuery.startPos + user.username.length + 2;
        el.setSelectionRange(newCursorPos, newCursorPos);
        el.focus();

        setShowDropdown(false);
        setMentionQuery(null);
        setSuggestions([]);
      },
      [mentionQuery]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (!showDropdown || suggestions.length === 0) return;

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIdx((prev) => (prev + 1) % suggestions.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(suggestions[selectedIdx]);
        } else if (e.key === "Escape") {
          setShowDropdown(false);
        }
      },
      [showDropdown, suggestions, selectedIdx, insertMention]
    );

    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, []);

    const sharedProps = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref: inputRef as any,
      placeholder,
      className: className ?? "w-full bg-transparent outline-none",
      autoFocus,
      onInput: handleInput,
      onKeyDown: handleKeyDown,
      onClick: handleInput,
    };

    return (
      <div className="relative">
        {variant === "input" ? (
          <input type="text" {...sharedProps} />
        ) : (
          <textarea rows={rows} {...sharedProps} />
        )}

        {showDropdown && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 left-0 right-0 mt-1 bg-black border border-borderGray rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto"
          >
            <p className="px-3 pt-2 pb-1 text-xs text-textGray font-semibold uppercase tracking-wide">
              Following
            </p>
            {suggestions.map((user, idx) => (
              <button
                key={user.id}
                onClick={() => insertMention(user)}
                onMouseEnter={() => setSelectedIdx(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  idx === selectedIdx ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                  <Image
                    path={user.img || "general/noAvatar.png"}
                    alt={user.username}
                    w={32}
                    h={32}
                    tr
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate">
                    {user.displayName ?? user.username}
                  </p>
                  <p className="text-textGray text-xs truncate">@{user.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

MentionInput.displayName = "MentionInput";

export default MentionInput;
