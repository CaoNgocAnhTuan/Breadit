export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/((?!_next|sign-in|sign-up|api/auth|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
};
