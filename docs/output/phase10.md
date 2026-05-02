# Phase 10 — Direct Messaging & Multi-media

## What Was Implemented

Phase 10 delivers a complete 1:1 Direct Messaging system and significantly upgrades the posting experience with Multi-media support. It also introduces a `MediaViewer` for a high-quality full-screen media experience.

---

## Prerequisites Applied

```bash
npx prisma migrate dev --name add_post_media \
  --schema=apps/backend/prisma/schema.prisma
```

---

## Backend

### Schema Changes

**File:** `apps/backend/prisma/schema.prisma`

Introduced 1:1 messaging models and a dedicated `PostMedia` table:

```prisma
model Conversation {
  id        Int      @id @default(autoincrement())
  members   ConversationMember[]
  messages  Message[]
}

model ConversationMember {
  conversationId Int
  userId         String
  lastReadAt     DateTime @default(now())
}

model Message {
  id             Int      @id @default(autoincrement())
  conversationId Int
  senderId       String
  body           String?
  mediaUrl       String?
}

model PostMedia {
  id     Int    @id @default(autoincrement())
  url    String
  type   String   // 'IMAGE' | 'VIDEO'
  postId Int
}
```

Legacy `Post.img` and `Post.video` columns were dropped in favor of the `media PostMedia[]` relation.

---

### New: `MessagesModule`

Handles 1:1 private conversations.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/conversations` | `GET` | Lists conversations for the current user. |
| `/api/conversations` | `POST` | Finds or creates a conversation with another user. |
| `/api/conversations/:id/messages` | `GET` | Fetches paginated messages for a conversation. |
| `/api/conversations/:id/messages` | `POST` | Sends a message (text or media). |
| `/api/conversations/:id/read` | `PATCH` | Marks a conversation as read. |
| `/api/conversations/unread-count` | `GET` | Returns count of conversations with unread messages. |

**Real-time:** `MessagesService` emits a `newMessage` event via `NotificationsGateway` to the recipient's personal room.

---

### Updated: `PostsModule`

Updated to handle multiple files per post. The `create` and `createComment` methods now iterate through all uploaded parts, saving each to Cloudinary/Local storage and creating multiple `PostMedia` records.

The Fastify multipart limit was increased to `files: 10` in `main.ts` to support this.

---

## Frontend

### New: `MediaViewer.tsx`

A high-performance lightbox component using `fixed` positioning, backdrop blur, and smooth animations.
- Supports **Images** and **Videos**.
- **Keyboard support**: `Escape` to close.
- **Scroll locking**: Prevents background scrolling when open.
- Integrated into both `MessageThread.tsx` and `Post.tsx`.

### New: `Messages` Route

- **`[conversationId]/page.tsx`**: SSR page that fetches initial messages.
- **`MessageThread.tsx`**: Client-side thread with real-time socket updates, infinite scroll, and media attachments (pasted or dragged).

### Updated: `Share.tsx` (Multi-media Posting)

- Supports selecting up to 10 files.
- **Grid Preview**: Shows thumbnails of all attached media before posting.
- **Individual Editing**: Users can open the `ImageEditor` for any specific image in the selection.
- **File Removal**: Easy ✕ button to remove specific items before submission.

### Updated: `Post.tsx` (Grid Layout)

- Multiple media items are rendered in a CSS Grid (2x2, etc.) depending on the count.
- Each item is clickable, opening the `MediaViewer`.

---

## Use Cases Delivered

| Use Case | Description | Status |
|----------|-------------|--------|
| UC-U-MG-01 | Start a 1:1 conversation | ✅ |
| UC-U-MG-02 | Send/Receive text and media messages | ✅ |
| UC-U-PM-01-ext-d | Post multiple images/videos in one post | ✅ |
| UC-U-PM-01-ext-e | Full-screen media viewer (Lightbox) | ✅ |

---

## Phase 10 Exit Checklist

- [x] Send message in one browser, appears in another in real-time.
- [x] Unread badge on "Messages" sidebar item updates correctly.
- [x] Drag & drop multiple images into the Share box; they all upload and render in a grid.
- [x] Clicking a 4-minute video in a post opens the large viewer and plays correctly.
- [x] ESC key closes the media viewer.
- [x] `npm run typecheck` — clean.
