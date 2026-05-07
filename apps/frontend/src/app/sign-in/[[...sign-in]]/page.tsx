"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";
import Image from "@/components/Image";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified");
  const reset = searchParams.get("reset");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Invalid email or password");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <>
      {verified && (
        <p className="text-green-400 text-sm w-72">
          Email verified! You can now sign in.
        </p>
      )}
      {reset && (
        <p className="text-green-400 text-sm w-72">
          Password reset! Please sign in with your new password.
        </p>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input
          name="email"
          type="email"
          required
          placeholder="E-mail"
          className="py-2 px-6 rounded-full text-black w-72 placeholder:text-sm"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          className="py-2 px-6 rounded-full text-black w-72 placeholder:text-sm"
        />
        <Link
          href="/forgot-password"
          className="text-iconBlue hover:underline text-xs -mt-2"
        >
          Forgot password?
        </Link>
        {error && <p className="text-red-300 text-sm w-72">{error}</p>}
        <button
          disabled={loading}
          className="bg-iconBlue rounded-full p-2 text-white font-bold w-72 text-center disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </>
  );
}

const SignInPage = () => {
  return (
    <div className="h-screen flex items-center justify-between p-8">
      <div className="hidden lg:flex w-1/2 items-center justify-center">
        <Image path="icons/logo.svg" alt="" w={350} h={350} />
      </div>
      <div className="w-full lg:w-1/2 flex flex-col gap-4">
        <h1 className="text-2xl xsm:text-4xl md:text-6xl font-bold">
          Happening now
        </h1>
        <h1 className="text-2xl ">Join today.</h1>
        <Suspense>
          <SignInForm />
        </Suspense>
        <div className="w-72 flex items-center gap-4">
          <div className="h-px bg-borderGray flex-grow"></div>
          <span className="text-textGrayLight">or</span>
          <div className="h-px bg-borderGray flex-grow"></div>
        </div>
        <Link
          href="/sign-up"
          className="bg-iconBlue rounded-full p-2 text-white font-bold w-72 text-center"
        >
          Create Account
        </Link>
        <p className="w-72 text-xs">
          By signing up, you agree to the{" "}
          <span className="text-iconBlue">Terms of Service</span> and{" "}
          <span className="text-iconBlue">Privacy Policy</span>, including{" "}
          <span className="text-iconBlue">Cookie Use</span>.
        </p>
      </div>
    </div>
  );
};

export default SignInPage;
