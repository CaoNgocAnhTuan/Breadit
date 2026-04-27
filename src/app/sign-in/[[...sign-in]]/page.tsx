"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";

const SignInPage = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="h-screen flex items-center justify-between p-8">
      <div className="hidden lg:flex w-1/2 items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="320"
          height="320"
          viewBox="0 0 24 24"
        >
          <path
            fill="white"
            d="M 26.609375 29.023438 L 3.425781 29.023438 L 3.425781 26.707031 L 24.3125 26.707031 L 24.3125 23.242188 L 3.390625 23.242188 L 3.441406 0.015625 L 11.46875 0.015625 L 11.46875 17.117188 L 9.167969 17.117188 L 9.167969 2.335938 L 5.738281 2.335938 L 5.695312 20.925781 L 26.609375 20.925781 L 26.609375 29.023438"
          />
        </svg>
      </div>
      <div className="w-full lg:w-1/2 flex flex-col gap-4">
        <h1 className="text-2xl xsm:text-4xl md:text-6xl font-bold">
          Happening now
        </h1>
        <h1 className="text-2xl ">Join today.</h1>
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
          {error && <p className="text-red-300 text-sm w-72">{error}</p>}
          <button
            disabled={loading}
            className="bg-iconBlue rounded-full p-2 text-white font-bold w-72 text-center disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
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
