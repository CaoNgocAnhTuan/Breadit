import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 backdrop-blur-md p-4 z-10 border-b border-borderGray bg-black/50">
        <h1 className="font-bold text-xl">Settings</h1>
      </div>
      <div className="divide-y divide-borderGray">
        <Link
          href="/settings/blocked"
          className="flex items-center justify-between px-4 py-4 hover:bg-white/5"
        >
          <span className="font-semibold">Blocked accounts</span>
          <span className="text-textGray text-xl leading-none" aria-hidden>
            ›
          </span>
        </Link>
        <Link href="/" className="block px-4 py-4 text-textGray text-sm hover:text-white">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
