// Ids of the app rows (blueprint section 2.5, design: Ids).

// A bcrypt hash of the seed users' password ("password"), cost 10. Made once with the backend's bcryptjs
// (bcrypt.hash("password", 10), checked with bcrypt.compare). A constant, so two loads write the same rows.
export const PASSWORD_HASH = "$2b$10$0d.Q3RGdr5828InHbpr4Fu5A2gPzanO676tPpEIZTmk3WuhVg6.h.";

const USER_DIGITS = 10;
const APP_USER_ID = /^u[0-9]{10}$/;

/** `u` plus the integer padded to 10 digits: 42 becomes `u0000000042`. */
export function appUserId(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0 || n >= 10 ** USER_DIGITS) throw new Error(`user id ${String(n)} is not an integer of at most ${USER_DIGITS} digits`);
  return `u${String(n).padStart(USER_DIGITS, "0")}`;
}

/** The reverse of appUserId. Throws on any other text. */
export function canonicalUserId(s: string): number {
  if (!APP_USER_ID.test(s)) throw new Error(`user id "${s}" is not u plus ${USER_DIGITS} digits`);
  return Number(s.slice(1));
}

/** The largest canonical post id (0 for no posts). A repost row gets this number plus its event id, so repost ids start after the posts. */
export function repostOffset(posts: readonly { postId: number }[]): number {
  let max = 0;
  for (const p of posts) if (p.postId > max) max = p.postId;
  return max;
}
