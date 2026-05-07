-- Patch: add personal (non-community) posts for human users
-- Purpose: Profile tab "posts" filters communityId = NULL, so ensure every human user has visible posts.
-- Constraints:
-- - Append-only, idempotent
-- - No videos: PostMedia.type = 'IMAGE' only
-- - Keep posts short/meaningful

BEGIN;

-- Ensure base hashtags exist (idempotent)
WITH hashtag_seed AS (
  SELECT tag
  FROM (VALUES
    ('webdev'),('react'),('typescript'),('frontend'),('backend'),
    ('ux'),('design'),('photography'),('travel'),('foodie'),
    ('coffee'),('books'),('fitness'),('startups'),('opensource'),
    ('productivity'),('music'),('gaming')
  ) AS t(tag)
)
INSERT INTO "Hashtag" ("tag")
SELECT tag FROM hashtag_seed
ON CONFLICT ("tag") DO UPDATE SET "tag" = EXCLUDED."tag";

-- Insert 2 personal posts per human user (100 total), only if missing.
WITH users AS (
  SELECT id, username
  FROM "User"
  WHERE username LIKE 'human%'
),
hashtags AS (
  SELECT id, tag FROM "Hashtag"
),
post_seed AS (
  SELECT
    u.id AS user_id,
    u.username,
    v.kind,
    -- short, human-ish texts
    CASE v.kind
      WHEN 1 THEN
        ('Tiny win today: I simplified a workflow and it feels lighter to maintain.' ||
         ' ' || '#productivity' || ' ' || '#opensource')
      ELSE
        ('Weekend notes: fewer tabs, more focus. One task at a time actually works.' ||
         ' ' || '#productivity' || ' ' || '#coffee')
    END::varchar(255) AS desc_text,
    CASE
      WHEN (abs(hashtext(u.username || ':' || v.kind::text)) % 3) = 0 THEN 0
      WHEN (abs(hashtext(u.username || ':' || v.kind::text)) % 3) = 1 THEN 1
      ELSE 2
    END AS media_count,
    CASE v.kind
      WHEN 1 THEN ARRAY['productivity','opensource']
      ELSE ARRAY['productivity','coffee']
    END AS tags,
    CASE
      -- some posts include one mention (deterministic)
      WHEN (abs(hashtext(u.username)) % 10) = 0 THEN ARRAY['human01']::text[]
      ELSE ARRAY[]::text[]
    END AS mention_usernames
  FROM users u
  CROSS JOIN (VALUES (1), (2)) AS v(kind)
),
insert_posts AS (
  INSERT INTO "Post" ("desc", "userId", "communityId", "parentPostId", "deletedAt", "isSensitive", "isApproved", "updatedAt")
  SELECT
    ps.desc_text,
    ps.user_id,
    NULL,
    NULL,
    NULL,
    FALSE,
    TRUE,
    NOW()
  FROM post_seed ps
  WHERE NOT EXISTS (
    SELECT 1
    FROM "Post" p
    WHERE p."userId" = ps.user_id
      AND p."desc" = ps.desc_text
      AND p."communityId" IS NULL
      AND p."parentPostId" IS NULL
      AND p."deletedAt" IS NULL
  )
  RETURNING id, "userId", "desc"
),
posts_with_seed AS (
  SELECT
    ip.id AS post_id,
    u.username,
    ps.kind,
    ps.media_count,
    ps.tags,
    ps.mention_usernames
  FROM insert_posts ip
  JOIN users u ON u.id = ip."userId"
  JOIN post_seed ps ON ps.user_id = u.id AND ps.desc_text = ip."desc"
),
insert_media AS (
  INSERT INTO "PostMedia" ("url", "type", "height", "width", "postId")
  SELECT
    format('https://picsum.photos/seed/p_personal_%s_%s_%s/900/700', pws.username, pws.kind, img.i) AS url,
    'IMAGE' AS type,
    700 AS height,
    900 AS width,
    pws.post_id
  FROM posts_with_seed pws
  JOIN LATERAL generate_series(1, pws.media_count) AS img(i) ON TRUE
  WHERE NOT EXISTS (
    SELECT 1
    FROM "PostMedia" pm
    WHERE pm."postId" = pws.post_id
      AND pm."url" = format('https://picsum.photos/seed/p_personal_%s_%s_%s/900/700', pws.username, pws.kind, img.i)
  )
  RETURNING 1
),
insert_post_tags AS (
  INSERT INTO "PostTag" ("postId", "hashtagId")
  SELECT
    pws.post_id,
    h.id
  FROM posts_with_seed pws
  JOIN LATERAL unnest(pws.tags) AS t(tag) ON TRUE
  JOIN hashtags h ON h.tag = t.tag
  ON CONFLICT ("postId","hashtagId") DO NOTHING
  RETURNING 1
),
insert_mentions AS (
  INSERT INTO "Mention" ("postId", "commentId", "userId", "username")
  SELECT
    pws.post_id,
    NULL,
    mu.id,
    mu.username
  FROM posts_with_seed pws
  JOIN LATERAL unnest(pws.mention_usernames) AS m(username) ON TRUE
  JOIN users mu ON mu.username = m.username
  WHERE NOT EXISTS (
    SELECT 1
    FROM "Mention" mn
    WHERE mn."postId" = pws.post_id
      AND mn."userId" = mu.id
      AND mn."username" = mu.username
  )
  RETURNING 1
)
SELECT 1;

COMMIT;

