import Image from "./Image";

type Props = {
  avatarPath?: string | null;
  size?: "sm" | "md";
};

/**
 * Animated three-dot typing indicator bubble.
 * Mirrors the iMessage / Messenger style.
 */
const TypingDots = ({ avatarPath, size = "md" }: Props) => {
  const avatarSize = size === "sm" ? "w-6 h-6" : "w-7 h-7";
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";
  const px = size === "sm" ? "px-3 py-2" : "px-4 py-3";

  return (
    <div className="flex items-end gap-1.5 mt-2">
      <div className={`${avatarSize} rounded-full overflow-hidden shrink-0 mb-0.5`}>
        <Image
          path={avatarPath || "general/noAvatar.png"}
          alt="typing"
          w={size === "sm" ? 24 : 28}
          h={size === "sm" ? 24 : 28}
          tr={true}
        />
      </div>
      <div className={`bg-[#2f3336] ${px} rounded-2xl rounded-bl-sm flex gap-1 items-center`}>
        <span
          className={`${dotSize} bg-textGray rounded-full animate-bounce`}
          style={{ animationDelay: "0ms", animationDuration: "1s" }}
        />
        <span
          className={`${dotSize} bg-textGray rounded-full animate-bounce`}
          style={{ animationDelay: "200ms", animationDuration: "1s" }}
        />
        <span
          className={`${dotSize} bg-textGray rounded-full animate-bounce`}
          style={{ animationDelay: "400ms", animationDuration: "1s" }}
        />
      </div>
    </div>
  );
};

export default TypingDots;
