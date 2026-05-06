import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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

  // Create 5 users with unique details
  const users: any[] = [];
  for (let i = 1; i <= 5; i++) {
    const user = await prisma.user.create({
      data: {
        id: `user${i}`,
        email: `user${i}@example.com`,
        username: `user${i}`,
        password: passwordHash,
        emailVerified: new Date(),
        displayName: `User ${i}`,
        bio: `Hi I'm user${i}. Welcome to my profile!`,
        location: `USA`,
        job: `Developer`,
        website: `google.com`,
      },
    });
    users.push(user);
  }
  console.log(`${users.length} users created.`);

  // Create 5 posts for each user
  const posts: any[] = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = 1; j <= 5; j++) {
      const post = await prisma.post.create({
        data: {
          desc: `Post ${j} by ${users[i].username}`,
          userId: users[i].id,
        },
      });
      posts.push(post);
    }
  }
  console.log('Posts created.');

  // Create some follows
  await prisma.follow.createMany({
    data: [
      { followerId: users[0].id, followingId: users[1].id },
      { followerId: users[0].id, followingId: users[2].id },
      { followerId: users[1].id, followingId: users[3].id },
      { followerId: users[2].id, followingId: users[4].id },
      { followerId: users[3].id, followingId: users[0].id },
    ],
  });
  console.log('Follows created.');

  // Create some likes
  await prisma.like.createMany({
    data: [
      { userId: users[0].id, postId: posts[0].id },
      { userId: users[1].id, postId: posts[1].id },
      { userId: users[2].id, postId: posts[2].id },
      { userId: users[3].id, postId: posts[3].id },
      { userId: users[4].id, postId: posts[4].id },
    ],
  });
  console.log('Likes created.');

  // Create comments using the Comment table
  const comments: any[] = [];
  for (let i = 0; i < posts.length; i++) {
    const comment = await prisma.comment.create({
      data: {
        body: `Comment on Post ${posts[i].id} by ${users[(i + 1) % 5].username}`,
        userId: users[(i + 1) % 5].id,
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
  const reposts: any[] = [];
  for (let i = 0; i < posts.length; i++) {
    const repost = await prisma.post.create({
      data: {
        desc: `Repost of Post ${posts[i].id} by ${users[(i + 2) % 5].username}`,
        userId: users[(i + 2) % 5].id, // The user who is reposting
        rePostId: posts[i].id, // Linking to the original post being reposted
      },
    });
    reposts.push(repost);
  }
  console.log('Reposts created.');

  // Create saved posts (users save posts they like)
  await prisma.savedPosts.createMany({
    data: [
      { userId: users[0].id, postId: posts[1].id },
      { userId: users[1].id, postId: posts[2].id },
      { userId: users[2].id, postId: posts[3].id },
      { userId: users[3].id, postId: posts[4].id },
      { userId: users[4].id, postId: posts[0].id },
    ],
  });
  console.log('Saved posts created.');
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