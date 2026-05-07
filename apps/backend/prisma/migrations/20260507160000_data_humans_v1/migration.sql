-- Human-like demo data (append-only, idempotent).
-- Notes:
-- - No Cloudinary, no videos: only PostMedia.type = 'IMAGE'
-- - Uses deterministic usernames (human01..human50) to avoid colliding with seed.ts (admin, user1..user5)
-- - Idempotency: relies on uniques where available; otherwise WHERE NOT EXISTS checks.

BEGIN;

-- 1) Users (50)
WITH user_seed AS (
  SELECT
    ('human' || lpad(i::text, 2, '0'))           AS username,
    (('human' || lpad(i::text, 2, '0')) || '@example.com') AS email,
    format('Human %s', i)                        AS display_name,
    CASE (i % 6)
      WHEN 0 THEN 'Frontend Developer'
      WHEN 1 THEN 'Backend Engineer'
      WHEN 2 THEN 'UI/UX Designer'
      WHEN 3 THEN 'Photographer'
      WHEN 4 THEN 'Food Writer'
      ELSE 'Product Engineer'
    END                                          AS job,
    CASE (i % 8)
      WHEN 0 THEN 'Ho Chi Minh City'
      WHEN 1 THEN 'Hanoi'
      WHEN 2 THEN 'Da Nang'
      WHEN 3 THEN 'Tokyo'
      WHEN 4 THEN 'Seoul'
      WHEN 5 THEN 'London'
      WHEN 6 THEN 'San Francisco'
      ELSE 'Singapore'
    END                                          AS location,
    format('https://picsum.photos/seed/u_%s/200/200', ('human' || lpad(i::text, 2, '0'))) AS img,
    format('https://picsum.photos/seed/c_%s/1200/400', ('human' || lpad(i::text, 2, '0'))) AS cover,
    format('I build things, take notes, and share what I learn. (%s)', ('human' || lpad(i::text, 2, '0'))) AS bio
  FROM generate_series(1, 50) AS s(i)
),
users_upsert AS (
  INSERT INTO "User" ("id", "email", "username", "password", "emailVerified", "displayName", "bio", "location", "job", "website", "img", "cover", "role", "banned", "updatedAt")
  SELECT
    us.username,         -- deterministic string id for migration users
    us.email,
    us.username,
    NULL,                -- password optional in schema; keep NULL for migration users
    NOW(),
    us.display_name,
    us.bio,
    us.location,
    us.job,
    'https://breadit.dev',
    us.img,
    us.cover,
    'USER'::"Role",
    FALSE,
    NOW()
  FROM user_seed us
  ON CONFLICT ("username") DO UPDATE
  SET
    "email"       = EXCLUDED."email",
    "displayName" = EXCLUDED."displayName",
    "bio"         = EXCLUDED."bio",
    "location"    = EXCLUDED."location",
    "job"         = EXCLUDED."job",
    "website"     = EXCLUDED."website",
    "img"         = EXCLUDED."img",
    "cover"       = EXCLUDED."cover",
    "emailVerified" = COALESCE("User"."emailVerified", EXCLUDED."emailVerified"),
    "updatedAt"   = NOW()
  RETURNING id, username
)
SELECT 1;

-- 2) Communities (10) + basic rules
WITH community_seed AS (
  SELECT *
  FROM (VALUES
    ('webdev',      'Web Dev',       'Shipping web apps, sharing patterns, and reviewing code.'),
    ('foodlovers',  'Food Lovers',   'Recipes, restaurants, and cooking experiments that actually work.'),
    ('wanderlust',  'Wanderlust',    'Trips, itineraries, and practical travel lessons.'),
    ('designcraft', 'Design Craft',  'UI/UX, product design, and visual systems.'),
    ('photography', 'Photography',   'Light, composition, editing, and storytelling.'),
    ('startups',    'Startups',      'Building products, talking to users, and learning fast.'),
    ('books',       'Books',         'Reading notes, recommendations, and tiny reviews.'),
    ('fitness',     'Fitness',       'Training plans, habits, and sustainable progress.'),
    ('music',       'Music',         'Practice logs, gear notes, and favorite tracks.'),
    ('gaming',      'Gaming',        'Game reviews, tips, and co-op stories.')
  ) AS t(slug, name, description)
),
communities_upsert AS (
  INSERT INTO "Community" ("slug", "name", "description", "img", "cover", "updatedAt")
  SELECT
    cs.slug,
    cs.name,
    cs.description,
    format('https://picsum.photos/seed/community_%s/256/256', cs.slug),
    format('https://picsum.photos/seed/community_%s_cover/1200/400', cs.slug),
    NOW()
  FROM community_seed cs
  ON CONFLICT ("slug") DO UPDATE
  SET
    "name"        = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "img"         = EXCLUDED."img",
    "cover"       = EXCLUDED."cover",
    "updatedAt"   = NOW()
  RETURNING id, slug
),
users AS (
  SELECT id, username FROM "User" WHERE username LIKE 'human%'
),
role_assign AS (
  SELECT
    cu.id AS community_id,
    cu.slug,
    ('human' || lpad((row_number() OVER (ORDER BY cu.slug))::text, 2, '0')) AS owner_username
  FROM communities_upsert cu
),
insert_owner AS (
  INSERT INTO "CommunityMember" ("role", "userId", "communityId")
  SELECT 'OWNER'::"CommunityRole", u.id, ra.community_id
  FROM role_assign ra
  JOIN users u ON u.username = ra.owner_username
  ON CONFLICT ("userId","communityId") DO NOTHING
  RETURNING 1
),
insert_mods AS (
  -- 2 mods per community: deterministic selection based on slug hash-ish order
  INSERT INTO "CommunityMember" ("role", "userId", "communityId")
  SELECT
    'MOD'::"CommunityRole",
    u.id,
    cu.id
  FROM communities_upsert cu
  JOIN LATERAL (
    SELECT id
    FROM users
    WHERE username IN (
      ('human' || lpad((10 + ((abs(hashtext(cu.slug)) % 40) + 1))::text, 2, '0')),
      ('human' || lpad((10 + (((abs(hashtext(cu.slug)) / 7) % 40) + 1))::text, 2, '0'))
    )
    LIMIT 2
  ) u ON TRUE
  ON CONFLICT ("userId","communityId") DO NOTHING
  RETURNING 1
),
insert_members AS (
  -- Add ~25 members/community (deterministic spread; overlaps are fine due to unique constraint)
  INSERT INTO "CommunityMember" ("role", "userId", "communityId")
  SELECT
    'MEMBER'::"CommunityRole",
    u.id,
    cu.id
  FROM communities_upsert cu
  JOIN users u ON (abs(hashtext(u.username || ':' || cu.slug)) % 2) = 0
  ON CONFLICT ("userId","communityId") DO NOTHING
  RETURNING 1
),
rule_seed AS (
  SELECT
    cu.id AS community_id,
    r.title,
    r.description
  FROM communities_upsert cu
  JOIN LATERAL (
    VALUES
      ('Be respectful', 'Assume good intent. Disagree without being rude.'),
      ('Add context', 'Screenshots are helpful, but include what you tried and why.'),
      ('No spam', 'Promotions are fine only when clearly relevant and transparent.')
  ) AS r(title, description) ON TRUE
),
insert_rules AS (
  INSERT INTO "CommunityRule" ("title", "description", "communityId")
  SELECT rs.title, rs.description, rs.community_id
  FROM rule_seed rs
  WHERE NOT EXISTS (
    SELECT 1
    FROM "CommunityRule" cr
    WHERE cr."communityId" = rs.community_id
      AND cr."title" = rs.title
  )
  RETURNING 1
)
SELECT 1;

-- 3) Hashtags (stable set)
WITH hashtag_seed AS (
  SELECT tag
  FROM (VALUES
    ('webdev'),('react'),('typescript'),('frontend'),('backend'),
    ('ux'),('design'),('photography'),('travel'),('foodie'),
    ('homecooking'),('ramen'),('coffee'),('books'),('fitness'),
    ('startups'),('opensource'),('productivity'),('music'),('gaming')
  ) AS t(tag)
),
hashtags_upsert AS (
  INSERT INTO "Hashtag" ("tag")
  SELECT hs.tag FROM hashtag_seed hs
  ON CONFLICT ("tag") DO UPDATE SET "tag" = EXCLUDED."tag"
  RETURNING id, tag
)
SELECT 1;

-- 4) Posts (~200), PostMedia (images only), PostTag, Mentions
WITH users AS (
  SELECT id, username
  FROM "User"
  WHERE username LIKE 'human%'
),
communities AS (
  SELECT id, slug
  FROM "Community"
  WHERE slug IN ('webdev','foodlovers','wanderlust','designcraft','photography','startups','books','fitness','music','gaming')
),
hashtags AS (
  SELECT id, tag FROM "Hashtag"
),
post_seed AS (
  SELECT
    gs.n                                           AS n,
    ('human' || lpad((((gs.n - 1) % 50) + 1)::text, 2, '0')) AS author_username,
    CASE WHEN (gs.n % 5) = 0 THEN NULL
         ELSE (ARRAY['webdev','foodlovers','wanderlust','designcraft','photography','startups','books','fitness','music','gaming'])[((gs.n - 1) % 10) + 1]
    END                                            AS community_slug,
    CASE (gs.n % 10)
      WHEN 0 THEN 'Small win today: refactored a gnarly component and the tests finally read like a story.'
      WHEN 1 THEN 'Quick note from cooking: if you salt earlier, the flavors don’t just get stronger — they get deeper.'
      WHEN 2 THEN 'Tried a new photo workflow this week: fewer presets, more intention. The results feel calmer.'
      WHEN 3 THEN 'Travel lesson: planning less made the trip better. I left room for a random café and it became the highlight.'
      WHEN 4 THEN 'Design thought: consistency isn’t about sameness, it’s about predictable choices.'
      WHEN 5 THEN 'Reading habit: 20 pages a day beats a perfect weekend plan that never happens.'
      WHEN 6 THEN 'Fitness check-in: I stopped chasing max intensity and my progress got more consistent.'
      WHEN 7 THEN 'Startup diary: talking to users was uncomfortable — and it clarified everything in 15 minutes.'
      WHEN 8 THEN 'Music practice: slowing down exposed the mistakes I was hiding with speed.'
      ELSE 'Gaming note: co-op is way more fun when everyone agrees on the objective before rushing in.'
    END                                            AS base_text,
    CASE
      WHEN gs.n % 6 = 0 THEN 0
      WHEN gs.n % 6 = 1 THEN 1
      WHEN gs.n % 6 = 2 THEN 2
      WHEN gs.n % 6 = 3 THEN 3
      ELSE 4
    END                                            AS media_count,
    CASE (gs.n % 8)
      WHEN 0 THEN ARRAY['webdev','react']
      WHEN 1 THEN ARRAY['foodie','homecooking','coffee']
      WHEN 2 THEN ARRAY['travel','photography']
      WHEN 3 THEN ARRAY['design','ux']
      WHEN 4 THEN ARRAY['books','productivity']
      WHEN 5 THEN ARRAY['fitness']
      WHEN 6 THEN ARRAY['startups']
      ELSE ARRAY['music','gaming']
    END                                            AS tags,
    CASE
      WHEN gs.n % 9 = 0 THEN ARRAY[('human' || lpad((((gs.n + 7) % 50) + 1)::text, 2, '0'))]
      WHEN gs.n % 13 = 0 THEN ARRAY[
        ('human' || lpad((((gs.n + 19) % 50) + 1)::text, 2, '0')),
        ('human' || lpad((((gs.n + 3) % 50) + 1)::text, 2, '0'))
      ]
      ELSE ARRAY[]::text[]
    END                                            AS mention_usernames
  FROM generate_series(1, 200) AS gs(n)
),
post_seed_rendered AS (
  SELECT
    ps.*,
    NULLIF(
      trim(
        regexp_replace(
          concat_ws(
            ' ',
            ps.base_text,
            NULLIF(array_to_string(ARRAY(SELECT '@' || m FROM unnest(ps.mention_usernames) m), ' '), ''),
            NULLIF(array_to_string(ARRAY(SELECT '#' || t FROM unnest(ps.tags) t), ' '), '')
          ),
          '\\s+',
          ' ',
          'g'
        )
      ),
      ''
    )::varchar(255) AS desc_text
  FROM post_seed ps
),
insert_posts AS (
  INSERT INTO "Post" ("desc", "userId", "communityId", "isSensitive", "isApproved", "updatedAt")
  SELECT
    psr.desc_text,
    u.id,
    c.id,
    FALSE,
    TRUE,
    NOW()
  FROM post_seed_rendered psr
  JOIN users u ON u.username = psr.author_username
  LEFT JOIN communities c ON c.slug = psr.community_slug
  WHERE NOT EXISTS (
    SELECT 1 FROM "Post" p
    WHERE p."userId" = u.id AND p."desc" = psr.desc_text
  )
  RETURNING id, "userId", "desc", "communityId"
),
posts_with_seed AS (
  SELECT
    ip.id AS post_id,
    u.username AS author_username,
    psr.n,
    psr.media_count,
    psr.tags,
    psr.mention_usernames
  FROM insert_posts ip
  JOIN users u ON u.id = ip."userId"
  JOIN post_seed_rendered psr ON psr.author_username = u.username AND psr.desc_text = ip."desc"
),
insert_media AS (
  INSERT INTO "PostMedia" ("url", "type", "height", "width", "postId")
  SELECT
    format('https://picsum.photos/seed/p_%s_%s/900/700', pws.n, img.i) AS url,
    'IMAGE' AS type,
    700 AS height,
    900 AS width,
    pws.post_id AS postId
  FROM posts_with_seed pws
  JOIN LATERAL generate_series(1, pws.media_count) AS img(i) ON TRUE
  WHERE NOT EXISTS (
    SELECT 1 FROM "PostMedia" pm
    WHERE pm."postId" = pws.post_id
      AND pm."url" = format('https://picsum.photos/seed/p_%s_%s/900/700', pws.n, img.i)
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

