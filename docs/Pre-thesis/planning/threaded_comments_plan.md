# Implementation Plan: Twitter-style Threaded Comments

## Goal
To refactor the current comment system to resemble Twitter's (X's) threaded conversation view. This involves moving away from a flat list and implementing hierarchical nesting with visual cues (connecting lines) and proper depth control.

## Current State Analysis
- **Database:** Prisma schema already supports self-relation (`parentPostId`).
- **Backend:** `PostsService.findOne` currently fetches the first level of comments (`post.comments`). It does NOT recursively fetch nested replies.
- **Frontend:**
  - `[username]/status/[postId]/page.tsx` renders the main `<Post />` and a single `<Comments />` component.
  - `Comments.tsx` maps over the immediate replies and renders them as individual `<Post type="comment" />` components.
  - **Issue (from `docs/bugs_report.md`):** Deep nesting is currently handled poorly. Navigating into a deep comment renders it as a new "status" page, losing the broader context of the thread.

## Requirements for Twitter-style Threading

### 1. Backend: Fetching the Thread Tree
We need to adjust how we fetch comments. Twitter typically loads a few levels deep and then offers a "Show more replies" button.
- **Update `PostsService.findOne`:** Modify the `include` object for comments to fetch at least one or two levels deep of nested comments.
  ```typescript
  // Example concept
  comments: {
    include: {
      ...include, // User info, counts
      comments: { // Nested replies
        include: { ...include }
      }
    }
  }
  ```
- *Alternative:* Consider a recursive CTE (raw SQL) if Prisma's nested includes become too heavy, but Prisma's nested includes are fine for 1-2 levels.

### 2. Frontend: Recursive Rendering
- The `<Comments />` component needs to be able to render itself recursively if a comment has its own `comments` array.
- Pass a `depth` prop down to control visual indentation.

### 3. Frontend: Visual Connecting Lines
This is the hallmark of Twitter's UI.
- Use CSS to draw a vertical line connecting the avatar of the parent post to the avatar of the reply.
- This requires careful styling in `Post.tsx` (when `type="comment"`) or within a new wrapper component. We need relative positioning and a border element that spans the height of the component.
- The line should stop at the last reply in a specific thread branch.

### 4. Context Preservation (The "Thread" View)
When a user clicks on a deep reply, they shouldn't just see that reply in isolation.
- **Parent Context:** The backend needs to fetch the chain of parents upwards to the root post.
- **UI Update:** The `StatusPage` should render:
  1. The ancestors (the thread leading up to the target reply) with connecting lines.
  2. The target reply (highlighted as the main focus).
  3. The descendants (replies to the target).

## Action Plan

### Phase 1: Backend Nested Fetching
- Update `PostsService.findOne` to fetch nested comments (e.g., 2 levels deep).
- Ensure the types in `packages/shared` reflect this nested structure so the frontend knows `comments` can contain `comments`.

### Phase 2: Visual Hierarchy & Rendering
- Refactor `<Post type="comment">` to support a visual vertical line.
- Update `<Comments>` to map through the nested structure.

### Phase 3: The Upward Ancestor Chain (Advanced)
- Create a new endpoint or update `findOne` to return an `ancestors` array.
- Update `StatusPage` to render the ancestors above the main focused post.

## Open Questions & Decisions
1. **Depth Limit:** How deep should we render replies by default before forcing the user to click "Show more"? (Twitter usually stops at 1 or 2 levels below the main focus).
2. **Performance:** Nested Prisma queries can be slow. We must monitor performance and potentially switch to a separate `GET /api/posts/:id/thread` endpoint that specifically builds the tree efficiently.
