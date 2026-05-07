"use client";

import Link from "next/link";
import type { MentionEntity } from "@breadit/shared";

type RichTextProps = {
  text: string;
  mentions?: MentionEntity[];
  className?: string;
};

type Segment =
  | { type: "text"; value: string }
  | { type: "mention"; original: string; username: string; displayName: string | null }
  | { type: "hashtag"; tag: string };

function parseSegments(text: string, mentions?: MentionEntity[]): Segment[] {
  const regex = /(@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+)/g;
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    const token = match[0];
    if (token.startsWith("@")) {
      const rawUsername = token.slice(1);
      const mention = mentions?.find(
        (m) => m.username.toLowerCase() === rawUsername.toLowerCase()
      );
      if (mention) {
        segments.push({
          type: "mention",
          original: rawUsername,
          username: mention.user.username,
          displayName: mention.user.displayName,
        });
      } else {
        segments.push({ type: "text", value: token });
      }
    } else if (token.startsWith("#")) {
      segments.push({ type: "hashtag", tag: token.slice(1) });
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

const RichText = ({ text, mentions, className }: RichTextProps) => {
  const segments = parseSegments(text, mentions);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case "mention":
            return (
              <Link
                key={i}
                href={`/${seg.username}`}
                className="text-iconBlue hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                @{seg.displayName || seg.username}
              </Link>
            );
          case "hashtag":
            return (
              <Link
                key={i}
                href={`/hashtag/${seg.tag.toLowerCase()}`}
                className="text-iconBlue hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                #{seg.tag}
              </Link>
            );
          default:
            return <span key={i}>{seg.value}</span>;
        }
      })}
    </span>
  );
};

export default RichText;
