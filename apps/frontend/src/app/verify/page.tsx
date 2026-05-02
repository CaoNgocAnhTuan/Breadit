"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";

function VerifyForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await api("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/sign-in?verified=1");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(data?.message ?? "Invalid or expired code. Please try again.");
  };

  const onResend = async () => {
    setResent(false);
    setError(null);
    setResending(true);
    await api("/api/auth/verify/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setResending(false);
    setResent(true);
  };

  if (!email) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col gap-4 max-w-sm text-center">
          <h1 className="text-2xl font-bold">No email provided</h1>
          <p className="text-textGray text-sm">
            Please register first to receive a verification code.
          </p>
          <Link href="/sign-up" className="text-iconBlue hover:underline text-sm">
            Back to sign up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="flex flex-col gap-5 w-80 text-center border border-borderGray rounded-2xl p-8">
        <h1 className="text-2xl font-bold">Check your inbox</h1>
        <p className="text-textGray text-sm leading-relaxed">
          We sent a 6-digit code to{" "}
          <span className="text-white font-medium">{email}</span>. Paste it
          below — it expires in 15 minutes.
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="000000"
            className="py-3 px-4 rounded-xl text-black text-center text-3xl font-mono tracking-[0.4em] w-full placeholder:text-gray-300 placeholder:text-xl placeholder:tracking-widest"
            required
            autoFocus
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {resent && (
            <p className="text-green-400 text-sm">Code resent — check your inbox.</p>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="bg-white text-black font-bold rounded-full py-2 px-4 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>

        <button
          onClick={onResend}
          disabled={resending}
          className="text-iconBlue hover:underline text-sm disabled:opacity-50"
        >
          {resending ? "Sending..." : "Resend code"}
        </button>

        <Link href="/sign-in" className="text-textGray hover:underline text-xs">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
