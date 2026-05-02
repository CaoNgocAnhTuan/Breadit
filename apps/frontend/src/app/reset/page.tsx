"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-red-300 text-sm w-72">Invalid reset link. Please request a new one.</p>
        <Link href="/forgot-password" className="text-iconBlue hover:underline text-sm">
          Request new link
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    const confirm = fd.get("confirm") as string;

    if (password !== confirm) {
      setErrorMsg("Passwords do not match");
      setStatus("error");
      return;
    }

    const res = await api("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data?.message ?? "Link is invalid or expired. Please request a new one.");
      setStatus("error");
      return;
    }

    router.push("/sign-in?reset=1");
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="relative w-72">
        <input
          name="password"
          type={showPassword ? "text" : "password"}
          required
          minLength={6}
          placeholder="New password"
          className="py-2 px-6 rounded-full text-black w-full placeholder:text-sm"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
        >
          {showPassword ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          )}
        </button>
      </div>
      <div className="relative w-72">
        <input
          name="confirm"
          type={showPassword ? "text" : "password"}
          required
          minLength={6}
          placeholder="Confirm new password"
          className="py-2 px-6 rounded-full text-black w-full placeholder:text-sm"
        />
      </div>
      {status === "error" && (
        <p className="text-red-300 text-sm w-72">{errorMsg}</p>
      )}

      <button
        disabled={status === "loading"}
        className="bg-iconBlue rounded-full p-2 text-white font-bold w-72 text-center disabled:opacity-60"
      >
        {status === "loading" ? "Resetting..." : "Reset password"}
      </button>
      <Link href="/forgot-password" className="text-iconBlue hover:underline text-sm">
        Request a new link
      </Link>
    </form>
  );
}

const ResetPage = () => {
  return (
    <div className="h-screen flex items-center justify-between p-8">
      <div className="w-full lg:w-1/2 flex flex-col gap-4 lg:mx-auto">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
};

export default ResetPage;
