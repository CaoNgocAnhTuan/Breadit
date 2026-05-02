"use client";

export default function ProfileError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center p-8">
      <p className="text-textGray text-lg">Could not load this profile.</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-full border border-borderGray text-sm hover:bg-white/10 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
