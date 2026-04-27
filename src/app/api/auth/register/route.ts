import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/prisma";

const Body = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { username, email, password } = parsed.data;

  const dup = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (dup) {
    return Response.json(
      { error: "Email or username already taken" },
      { status: 409 }
    );
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashed,
      displayName: username,
      emailVerified: new Date(),
    },
    select: { id: true },
  });
  return Response.json({ ok: true, userId: user.id });
}
