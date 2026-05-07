"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import Image from "@/components/Image";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SignUpPage = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateEmail = (value: string) => {
    if (value && !EMAIL_RE.test(value)) {
      setEmailError("Invalid email address");
    } else {
      setEmailError(null);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const payload = {
      username: String(fd.get("username") ?? ""),
      email,
      password: String(fd.get("password") ?? ""),
    };

    if (!EMAIL_RE.test(email)) {
      setEmailError("Invalid email address");
      return;
    }

    setLoading(true);
    const res = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.message ? String(data.message) : "Failed to register");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push(`/verify?email=${encodeURIComponent(email)}`);
  };

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
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <input
            name="username"
            type="text"
            required
            minLength={3}
            placeholder="Username"
            className="py-2 px-6 rounded-full text-black w-72 placeholder:text-sm"
          />
          <div className="flex flex-col gap-1">
            <input
              name="email"
              type="text"
              required
              placeholder="E-mail"
              onChange={(e) => validateEmail(e.target.value)}
              className={`py-2 px-6 rounded-full text-black w-72 placeholder:text-sm ${
                emailError ? "ring-2 ring-red-400" : ""
              }`}
            />
            {emailError && (
              <p className="text-red-400 text-xs pl-4">{emailError}</p>
            )}
          </div>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="Password"
            className="py-2 px-6 rounded-full text-black w-72 placeholder:text-sm"
          />
          {error && <p className="text-red-300 text-sm w-72">{error}</p>}
          <button
            disabled={loading || !!emailError}
            className="bg-iconBlue rounded-full p-2 text-white font-bold w-72 text-center disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>
        <div className="w-72 flex items-center gap-4">
          <div className="h-px bg-borderGray flex-grow"></div>
          <span className="text-textGrayLight">or</span>
          <div className="h-px bg-borderGray flex-grow"></div>
        </div>
        <Link
          href="/sign-in"
          className="bg-iconBlue rounded-full p-2 text-white font-bold w-72 text-center"
        >
          Already have an account?
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

export default SignUpPage;
