import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function envInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function mulberry32(seed: number) {
  // Simple deterministic RNG for repeatable seeding.
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  await prisma.user.upsert({
    where: { username: 'admin' },
    create: {
      username: 'admin',
      email: 'admin@breadit.dev',
      password: await bcrypt.hash('123456', 10),
      role: 'ADMIN',
      emailVerified: new Date(),
      displayName: 'Admin',
    },
    update: {},
  });

  const passwordHash = await bcrypt.hash('password', 10);

  const USER_COUNT = envInt('SEED_USERS', 50);
  const POSTS_PER_USER = envInt('SEED_POSTS_PER_USER', 10);
  const HASHTAG_COUNT = envInt('SEED_HASHTAGS', 200);
  const TAGS_PER_POST = envInt('SEED_TAGS_PER_POST', 2);
  const LIKE_EDGES = envInt('SEED_LIKES', 2000);
  const FOLLOW_EDGES = envInt('SEED_FOLLOWS', 500);
  const REPOST_RATE_PERCENT = envInt('SEED_REPOST_RATE', 10); // percent of posts to repost
  const RNG_SEED = envInt('SEED_RANDOM', 42);
  const rand = mulberry32(RNG_SEED);

  // Create users (deterministic ids) + fetch back.
  const userData = Array.from({ length: USER_COUNT }, (_, idx) => {
    const i = idx + 1;
    const id = `seed_user_${i.toString().padStart(4, '0')}`;
    return {
      id,
      email: `user${i}@example.com`,
      username: `user${i}`,
      password: passwordHash,
      emailVerified: new Date(),
      displayName: `User ${i}`,
      bio: `Hi I'm user${i}. Welcome to my profile!`,
      location: `USA`,
      job: `Developer`,
      website: `google.com`,
    };
  });

  await prisma.user.createMany({ data: userData, skipDuplicates: true });
  const users = await prisma.user.findMany({
    where: { id: { in: userData.map((u) => u.id) } },
    select: { id: true, username: true },
  });
  console.log(`${users.length} users ready.`);

  // Create hashtags
  const hashtagData = Array.from({ length: HASHTAG_COUNT }, (_, idx) => ({
    tag: `tag${(idx + 1).toString().padStart(4, '0')}`,
  }));
  await prisma.hashtag.createMany({ data: hashtagData, skipDuplicates: true });
  const hashtags = await prisma.hashtag.findMany({ select: { id: true, tag: true } });
  console.log(`${hashtags.length} hashtags ready.`);

  // Create posts (batch per user for speed)
  const postsToCreate: { desc: string; userId: string }[] = [];
  for (const u of users) {
    for (let j = 1; j <= POSTS_PER_USER; j++) {
      const t1 = hashtags[Math.floor(rand() * hashtags.length)]?.tag ?? 'tag0001';
      const t2 = hashtags[Math.floor(rand() * hashtags.length)]?.tag ?? 'tag0002';
      const tagsText = TAGS_PER_POST >= 2 ? ` #${t1} #${t2}` : TAGS_PER_POST === 1 ? ` #${t1}` : '';
      postsToCreate.push({
        desc: `Post ${j} by ${u.username}${tagsText}`,
        userId: u.id,
      });
    }
  }

  // Insert in chunks to avoid oversized queries
  const CHUNK = 2000;
  for (let i = 0; i < postsToCreate.length; i += CHUNK) {
    await prisma.post.createMany({ data: postsToCreate.slice(i, i + CHUNK) });
  }
  console.log(`${postsToCreate.length} posts created.`);

  // Fetch posts back (ids) to attach tags/likes
  const posts = await prisma.post.findMany({
    where: { deletedAt: null, parentPostId: null },
    select: { id: true, userId: true },
    orderBy: { id: 'asc' },
  });

  // Attach tags by parsing #tag#### in desc (create PostTag records)
  // Keep it simple: for each post, pick 0..TAGS_PER_POST hashtags.
  const postTags: { postId: number; hashtagId: number }[] = [];
  for (const p of posts) {
    const used = new Set<number>();
    for (let k = 0; k < TAGS_PER_POST; k++) {
      const ht = hashtags[Math.floor(rand() * hashtags.length)];
      if (!ht || used.has(ht.id)) continue;
      used.add(ht.id);
      postTags.push({ postId: p.id, hashtagId: ht.id });
    }
  }
  for (let i = 0; i < postTags.length; i += 5000) {
    await prisma.postTag.createMany({ data: postTags.slice(i, i + 5000), skipDuplicates: true });
  }
  console.log(`${postTags.length} post tags created.`);

  // Random follows
  const follows: { followerId: string; followingId: string; notify?: boolean }[] = [];
  for (let i = 0; i < FOLLOW_EDGES; i++) {
    const a = users[Math.floor(rand() * users.length)];
    const b = users[Math.floor(rand() * users.length)];
    if (!a || !b || a.id === b.id) continue;
    follows.push({ followerId: a.id, followingId: b.id, notify: false });
  }
  for (let i = 0; i < follows.length; i += 5000) {
    await prisma.follow.createMany({ data: follows.slice(i, i + 5000), skipDuplicates: true });
  }
  console.log(`${follows.length} follows created.`);

  // Random likes
  const likes: { userId: string; postId: number }[] = [];
  for (let i = 0; i < LIKE_EDGES; i++) {
    const u = users[Math.floor(rand() * users.length)];
    const p = posts[Math.floor(rand() * posts.length)];
    if (!u || !p) continue;
    likes.push({ userId: u.id, postId: p.id });
  }
  for (let i = 0; i < likes.length; i += 5000) {
    await prisma.like.createMany({ data: likes.slice(i, i + 5000), skipDuplicates: true });
  }
  console.log(`${likes.length} likes created.`);

  // Create comments using the Comment table
  const comments: any[] = [];
  // Only comment on a subset when seeding big datasets to keep seed time reasonable.
  const commentTargetCount = Math.min(posts.length, envInt('SEED_COMMENTS', 500));
  for (let i = 0; i < commentTargetCount; i++) {
    const comment = await prisma.comment.create({
      data: {
        body: `Comment on Post ${posts[i].id} by ${users[(i + 1) % 5].username}`,
        userId: users[Math.floor(rand() * users.length)]!.id,
        postId: posts[i].id,
      },
    });
    comments.push(comment);
  }

  // Create some threaded replies
  for (let i = 0; i < comments.length; i += 2) {
    await prisma.comment.create({
      data: {
        body: `Reply to comment ${comments[i].id} by ${users[(i + 3) % 5].username}`,
        userId: users[(i + 3) % 5].id,
        postId: comments[i].postId,
        parentCommentId: comments[i].id,
      },
    });
  }
  console.log('Comments and replies created.');

  // Create reposts using the Post model's rePostId
  const repostsToCreate: { desc: string; userId: string; rePostId: number }[] = [];
  for (const p of posts) {
    if (Math.floor(rand() * 100) >= REPOST_RATE_PERCENT) continue;
    const u = users[Math.floor(rand() * users.length)];
    if (!u || u.id === p.userId) continue;
    repostsToCreate.push({
      desc: `Repost of Post ${p.id}`,
      userId: u.id,
      rePostId: p.id,
    });
  }
  for (let i = 0; i < repostsToCreate.length; i += 2000) {
    await prisma.post.createMany({ data: repostsToCreate.slice(i, i + 2000) });
  }
  console.log(`${repostsToCreate.length} reposts created.`);

  // Create saved posts (users save posts they like)
  const saves: { userId: string; postId: number }[] = [];
  const SAVE_EDGES = envInt('SEED_SAVES', 500);
  for (let i = 0; i < SAVE_EDGES; i++) {
    const u = users[Math.floor(rand() * users.length)];
    const p = posts[Math.floor(rand() * posts.length)];
    if (!u || !p) continue;
    saves.push({ userId: u.id, postId: p.id });
  }
  for (let i = 0; i < saves.length; i += 5000) {
    await prisma.savedPosts.createMany({ data: saves.slice(i, i + 5000), skipDuplicates: true });
  }
  console.log(`${saves.length} saved posts created.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });