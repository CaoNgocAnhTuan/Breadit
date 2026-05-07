export type NotificationType = 'LIKE' | 'REPLY' | 'REPOST' | 'FOLLOW' | 'MENTION' | 'COMMUNITY_POST' | 'COMMUNITY_NEW_POST' | 'REPORT' | 'COMMUNITY_MOD_ADDED';

export type NotificationItem = {
  id: number;
  type: NotificationType;
  readAt: string | null;
  createdAt: string;
  actor: { id: string; username: string; displayName: string | null; img: string | null };
  post: { id: number; user: { username: string } } | null;
};

export type Role = 'USER' | 'ADMIN';

export type User = {
  id: string;
  username: string;
  displayName: string | null;
  img: string | null;
  role: Role;
  banned: boolean;
};

export type MessageItem = {
  id: number;
  body: string | null;
  mediaUrl: string | null;
  senderId: string;
  createdAt: string;
};

export type ConversationListItem = {
  id: number;
  updatedAt: string;
  otherMember: { id: string; username: string; displayName: string | null; img: string | null };
  lastMessage: MessageItem | null;
  unreadCount: number;
};

export type PostMedia = {
  id: number;
  url: string;
  type: string;
  height: number | null;
  width: number | null;
};

export type CommentMedia = {
  id: number;
  url: string;
  type: string;
  height: number | null;
  width: number | null;
};

export type MentionEntity = {
  username: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    img: string | null;
  };
};

export type Post = {
  id: number;
  desc: string | null;
  media: PostMedia[];
  mentions?: MentionEntity[];
  isSensitive: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  user: User;
  _count?: {
    likes: number;
    rePosts: number;
    comments: number;
  };
  isLiked?: boolean;
  isReposted?: boolean;
  isSaved?: boolean;
};

export type Comment = {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  userId: string;
  postId: number;
  parentCommentId: number | null;
  media?: CommentMedia[];
  user: {
    username: string;
    displayName: string | null;
    img: string | null;
  };
  _count: {
    replies: number;
    likes: number;
  };
  likes?: { id: number }[];
  mentions?: MentionEntity[];
  replies?: Comment[];
  post?: {
    id: number;
    desc: string | null;
    createdAt: string;
    userId: string;
    user: { username: string; displayName: string | null; img: string | null };
  };
};
