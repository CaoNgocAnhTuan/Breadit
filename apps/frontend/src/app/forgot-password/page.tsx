"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";

const ForgotPasswordPage = () => {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: fd.get("email") }),
      });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="h-screen flex items-center justify-between p-8">
      <div className="w-full lg:w-1/2 flex flex-col gap-4 lg:mx-auto">
        <h1 className="text-2xl font-bold">Forgot your password?</h1>
        <p className="text-textGray text-sm w-72">
          Enter your email and we&apos;ll send you a reset link.
        </p>
        {status === "success" ? (
          <div className="flex flex-col gap-3">
            <p className="text-green-400 text-sm w-72">
              If that email is registered, you&apos;ll receive a reset link shortly.
            </p>
            <Link href="/sign-in" className="text-iconBlue hover:underline text-sm">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <input
              name="email"
              type="email"
              required
              placeholder="E-mail"
              className="py-2 px-6 rounded-full text-black w-72 placeholder:text-sm"
            />
            {status === "error" && (
              <p className="text-red-300 text-sm w-72">Something went wrong. Please try again.</p>
            )}
            <button
              disabled={status === "loading"}
              className="bg-iconBlue rounded-full p-2 text-white font-bold w-72 text-center disabled:opacity-60"
            >
              {status === "loading" ? "Sending..." : "Send reset link"}
            </button>
            <Link href="/sign-in" className="text-iconBlue hover:underline text-sm">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
