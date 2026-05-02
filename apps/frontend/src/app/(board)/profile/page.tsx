import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function ProfileRedirect() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  redirect(`/${session.user.username}`);
}
