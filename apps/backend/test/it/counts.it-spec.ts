import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUserWithCookie, prisma, uniq } from './helpers/factory';

type U = Awaited<ReturnType<typeof createUserWithCookie>>;

describe('T1, T2: counts ignore soft-deleted rows', () => {
  let app: NestFastifyApplication;
  let alice: U;
  let bob: U;
  let carol: U;

  const as = (u: U) => client(app, u.cookie);

  async function newPost(u: U, desc: string): Promise<number> {
    const res = await as(u).form('POST', '/api/posts', { desc });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    alice = await createUserWithCookie({ username: uniq('alice') });
    bob = await createUserWithCookie({ username: uniq('bob') });
    carol = await createUserWithCookie({ username: uniq('carol') });
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  describe('T1: reposts', () => {
    it('after un-repost the count is 0 and my flag is empty; after repost again it is 1', async () => {
      const id = await newPost(alice, 'repost target');

      expect((await as(bob).post(`/api/posts/${id}/repost`)).body).toMatchObject({ reposted: true, count: 1 });
      let post = (await as(bob).get(`/api/posts/${id}`)).body;
      expect(post._count.rePosts).toBe(1);
      expect(post.rePosts).toHaveLength(1);

      expect((await as(bob).post(`/api/posts/${id}/repost`)).body).toMatchObject({ reposted: false, count: 0 });
      post = (await as(bob).get(`/api/posts/${id}`)).body;
      expect(post._count.rePosts).toBe(0);
      expect(post.rePosts).toHaveLength(0);

      expect((await as(bob).post(`/api/posts/${id}/repost`)).body).toMatchObject({ reposted: true, count: 1 });
      post = (await as(bob).get(`/api/posts/${id}`)).body;
      expect(post._count.rePosts).toBe(1);
      expect(post.rePosts).toHaveLength(1);

      const rows = await prisma().post.findMany({ where: { rePostId: id } });
      expect(rows.filter((r) => r.deletedAt === null)).toHaveLength(1); // one live repost
      expect(rows).toHaveLength(2); // the first one is only soft-deleted
    });

    it('the same counts show in the profile feed, the profile tab, search and the hashtag page', async () => {
      const tag = uniq('tag').replace('_', '');
      const text = `findme ${tag} #${tag}`;
      const id = await newPost(alice, text);
      await as(bob).post(`/api/posts/${id}/repost`); // repost
      await as(bob).post(`/api/posts/${id}/repost`); // un-repost

      const find = (posts: Array<{ id: number }>) => posts.find((p) => p.id === id) as any;

      const feed = (await as(bob).get(`/api/posts?user=${alice.user.id}`)).body;
      expect(find(feed.posts)._count.rePosts).toBe(0);
      expect(find(feed.posts).rePosts).toHaveLength(0);

      const tab = (await as(bob).get(`/api/users/${alice.user.username}/posts?tab=posts`)).body;
      expect(find(tab.posts)._count.rePosts).toBe(0);

      const search = (await as(bob).get(`/api/search?q=${tag}`)).body;
      expect(find(search.posts)._count.rePosts).toBe(0);
      expect(find(search.posts).rePosts).toHaveLength(0);

      const hashtag = (await as(bob).get(`/api/hashtags/${tag}/posts`)).body;
      expect(find(hashtag.posts)._count.rePosts).toBe(0);
      expect(find(hashtag.posts).rePosts).toHaveLength(0);
    });

    it('the explore feed uses the same fixed counts', async () => {
      const id = await newPost(alice, 'explore count probe');
      await as(bob).post(`/api/posts/${id}/repost`);
      await as(bob).post(`/api/posts/${id}/repost`); // un-repost

      let cursor = '1';
      let found: any;
      for (let page = 0; page < 40 && !found; page++) {
        const res = (await as(bob).get(`/api/posts?feed=explore&cursor=${cursor}`)).body;
        found = res.posts.find((p: { id: number }) => p.id === id);
        if (!res.hasMore) break;
        cursor = res.nextCursor;
      }
      expect(found).toBeDefined();
      expect(found._count.rePosts).toBe(0);
    });

    it('T1b: a quote repost still counts, and so does a live plain repost next to it', async () => {
      const id = await newPost(alice, 'quote target');
      expect((await as(bob).post(`/api/posts/${id}/repost`, { desc: 'my take' })).body.count).toBe(1);
      expect((await as(carol).post(`/api/posts/${id}/repost`)).body.count).toBe(2);
      const post = (await as(alice).get(`/api/posts/${id}`)).body;
      expect(post._count.rePosts).toBe(2);
    });

    it('a deleted quote repost no longer counts', async () => {
      const id = await newPost(alice, 'quote delete target');
      await as(bob).post(`/api/posts/${id}/repost`, { desc: 'to be removed' });
      const quote = await prisma().post.findFirst({ where: { rePostId: id } });
      expect((await as(bob).delete(`/api/posts/${quote!.id}`)).status).toBe(200);
      expect((await as(alice).get(`/api/posts/${id}`)).body._count.rePosts).toBe(0);
    });
  });

  describe('T2: comments', () => {
    it('deleting a reply lowers the count; deleting the comment lowers it to 0', async () => {
      const id = await newPost(alice, 'comment target');
      const top = await as(alice).form('POST', `/api/posts/${id}/comments`, { body: 'top' });
      const reply = await as(bob).form('POST', `/api/posts/${id}/comments`, {
        body: 'reply',
        parentCommentId: String(top.body.id),
      });
      expect((await as(bob).get(`/api/posts/${id}`)).body._count.comments).toBe(2);

      expect((await as(bob).delete(`/api/comments/${reply.body.id}`)).status).toBe(200);
      expect((await as(bob).get(`/api/posts/${id}`)).body._count.comments).toBe(1);

      expect((await as(alice).delete(`/api/comments/${top.body.id}`)).status).toBe(200);
      expect((await as(bob).get(`/api/posts/${id}`)).body._count.comments).toBe(0);
    });

    it('replies still count as comments (documented rule)', async () => {
      const id = await newPost(alice, 'reply count target');
      const top = await as(alice).form('POST', `/api/posts/${id}/comments`, { body: 'top' });
      await as(bob).form('POST', `/api/posts/${id}/comments`, { body: 'r1', parentCommentId: String(top.body.id) });
      await as(carol).form('POST', `/api/posts/${id}/comments`, { body: 'r2', parentCommentId: String(top.body.id) });
      expect((await as(alice).get(`/api/posts/${id}`)).body._count.comments).toBe(3);
    });
  });

  describe('likes are unchanged', () => {
    it('like count and flag still work', async () => {
      const id = await newPost(alice, 'like target');
      expect((await as(bob).post(`/api/posts/${id}/like`)).body).toMatchObject({ liked: true, count: 1 });
      const post = (await as(bob).get(`/api/posts/${id}`)).body;
      expect(post._count.likes).toBe(1);
      expect(post.likes).toHaveLength(1);
      const guestView = (await client(app).get(`/api/posts/${id}`)).body;
      expect(guestView._count.likes).toBe(1);
      expect(guestView.likes).toBeUndefined();
    });
  });
});
