# Data Dictionary - Breadit

Below is the detailed specification of the database tables, categorized into 5 major Modules according to the system architecture.

## 1. Users & Social Graph Module

<table>
  <tr>
    <td valign="top" width="50%">
      <b>• User</b><br><br>
      <b>Description:</b> Core table representing all platform users, storing personal information and security states.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, String, cuid)</li>
        <li><code>email</code> (String, unique)</li>
        <li><code>username</code> (String, unique)</li>
        <li><code>password</code> (String, nullable) - Null when using OAuth</li>
        <li><code>role</code> (Enum: USER, ADMIN) - System authorization</li>
        <li><code>banned</code> (Boolean, default: false) - Global ban flag</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>One-to-Many with interaction tables (Post, Comment, Like, etc.)</li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <b>• VerificationToken</b><br><br>
      <b>Description:</b> Stores single-use OTP tokens for email verification or password reset flows.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>identifier</code> (PK, String) - e.g., "email-verify:user123"</li>
        <li><code>token</code> (PK, String) - 6-digit OTP or UUID string</li>
        <li><code>expires</code> (DateTime) - Expiration timestamp</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>No explicit Foreign Key (Uses identifier to implicitly map to users for security decoupling)</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• Follow</b><br><br>
      <b>Description:</b> Manages the social graph edges (who is following whom).<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int, auto-increment)</li>
        <li><code>followerId</code> (FK, String) - The user initiating the follow</li>
        <li><code>followingId</code> (FK, String) - The user being followed</li>
        <li><code>notify</code> (Boolean) - Push notification preference toggle</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code> (twice, representing both ends of the edge)</li>
      </ul>
    </td>
    <td valign="top">
      <b>• Block</b><br><br>
      <b>Description:</b> Stores block lists, preventing interactions between two specific users.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>blockerId</code> (FK, String) - The user initiating the block</li>
        <li><code>blockedId</code> (FK, String) - The user being blocked</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code> (twice)</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• Notification</b><br><br>
      <b>Description:</b> Stores all system alerts (bells) for users.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>type</code> (Enum: REPLY, LIKE, FOLLOW, MENTION...)</li>
        <li><code>recipientId</code> (FK, String) - The user receiving the alert</li>
        <li><code>actorId</code> (FK, String) - The user triggering the event</li>
        <li><code>postId</code> / <code>commentId</code> (FK, Int, nullable) - Target entity</li>
        <li><code>readAt</code> (DateTime, nullable) - Tracks read/unread status</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code>, <code>Post</code>, <code>Comment</code></li>
      </ul>
    </td>
    <td valign="top">
    </td>
  </tr>
</table>

## 2. Content & Engagement Module

<table>
  <tr>
    <td valign="top" width="50%">
      <b>• Post</b><br><br>
      <b>Description:</b> The backbone data table of the Feed, containing original content, Reposts, and Quotes.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>userId</code> (FK, String) - The author</li>
        <li><code>communityId</code> (FK, Int, nullable) - The community it belongs to</li>
        <li><code>desc</code> (String, nullable) - Text content</li>
        <li><code>isSensitive</code> (Boolean) - NSFW flag</li>
        <li><code>isApproved</code> (Boolean) - Moderation approval flag</li>
        <li><code>rePostId</code> (FK, Int, nullable) - Original post ID if this is a Repost</li>
        <li><code>parentPostId</code> (FK, Int, nullable) - Supports n-level threading</li>
        <li><code>deletedAt</code> (DateTime, nullable) - Soft Delete flag</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Self-referencing for threading and reposting.</li>
        <li>Many-to-One with <code>User</code> and <code>Community</code></li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <b>• PostMedia</b><br><br>
      <b>Description:</b> Stores images/videos attached to a Post.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>postId</code> (FK, Int)</li>
        <li><code>url</code> (String) - Media path (Cloudinary/S3)</li>
        <li><code>type</code> (String: IMAGE, VIDEO)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>Post</code> (Cascade delete)</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• Comment</b><br><br>
      <b>Description:</b> Stores user replies to a Post.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>userId</code> (FK, String) - The author</li>
        <li><code>body</code> (String) - Comment text</li>
        <li><code>postId</code> (FK, Int) - The parent post</li>
        <li><code>parentCommentId</code> (FK, Int, nullable) - Parent comment for building Reply Trees</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Self-referencing for Nested Comments.</li>
      </ul>
    </td>
    <td valign="top">
      <b>• CommentMedia</b><br><br>
      <b>Description:</b> File attachments inside comments.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>commentId</code> (FK, Int)</li>
        <li><code>url</code> (String)</li>
        <li><code>type</code> (String: IMAGE, VIDEO)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>Comment</code></li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• Hashtag</b><br><br>
      <b>Description:</b> Normalized registry of tags to serve the Trending feature.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>tag</code> (String, unique) - Stored in lowercase</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>One-to-Many with <code>PostTag</code></li>
      </ul>
    </td>
    <td valign="top">
      <b>• PostTag</b><br><br>
      <b>Description:</b> Join Table resolving the Many-to-Many relationship between Posts and Hashtags.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>postId</code> (PK, FK, Int)</li>
        <li><code>hashtagId</code> (PK, FK, Int)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Composite Primary Key consisting of 2 FKs.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• Like & CommentLike</b><br><br>
      <b>Description:</b> Records user "likes" (hearts) for Posts or Comments.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>userId</code> (FK, String)</li>
        <li><code>postId</code> or <code>commentId</code> (FK, Int)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Implicit Unique Constraint to prevent double-liking.</li>
      </ul>
    </td>
    <td valign="top">
      <b>• Mention & SavedPosts</b><br><br>
      <b>Description:</b> Records @username mentions and user Bookmarks.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>userId</code> (FK, String) - The user saving the post or being mentioned</li>
        <li><code>username</code> (String) - Stored directly for Mention retrieval</li>
        <li><code>postId</code> / <code>commentId</code> (FK, Int, nullable)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code>, <code>Post</code>, <code>Comment</code></li>
      </ul>
    </td>
  </tr>
</table>

## 3. Direct Messaging Module

<table>
  <tr>
    <td valign="top" width="50%">
      <b>• Conversation</b><br><br>
      <b>Description:</b> Represents a single chat thread/box.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>createdAt</code> (DateTime)</li>
        <li><code>updatedAt</code> (DateTime) - Used for sorting the inbox (latest message on top)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>One-to-Many with <code>Message</code> and <code>ConversationMember</code></li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <b>• ConversationMember</b><br><br>
      <b>Description:</b> Join table connecting Users to Conversations, tracks read states.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>conversationId</code> (PK, FK, Int)</li>
        <li><code>userId</code> (PK, FK, String)</li>
        <li><code>lastReadAt</code> (DateTime) - Crucial for calculating the "Unread messages" badge count</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Composite PK: a user exists only once per conversation.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• Message</b><br><br>
      <b>Description:</b> Stores the content of individual messages sent via Socket.IO.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>conversationId</code> (FK, Int)</li>
        <li><code>senderId</code> (FK, String)</li>
        <li><code>body</code> (String, nullable) - Text message</li>
        <li><code>mediaUrl</code> (String, nullable) - Image/File message</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>Conversation</code></li>
      </ul>
    </td>
    <td valign="top">
    </td>
  </tr>
</table>

## 4. Communities Module

<table>
  <tr>
    <td valign="top" width="50%">
      <b>• Community</b><br><br>
      <b>Description:</b> Represents a Sub-reddit style group, a shared space for members with common interests.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>slug</code> (String, unique) - URL identifier (e.g., breadit.com/r/technology)</li>
        <li><code>name</code> (String) - Display name</li>
        <li><code>description</code> (String, nullable)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Contains multiple <code>Post</code> and <code>CommunityRule</code> records</li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <b>• CommunityMember</b><br><br>
      <b>Description:</b> Manages group members and their administrative roles.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>userId</code> (FK, String)</li>
        <li><code>communityId</code> (FK, Int)</li>
        <li><code>role</code> (Enum: MEMBER, MOD, OWNER) - Grants moderation privileges</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Unique Constraint: 1 User can join a specific community only once.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• CommunityRule</b><br><br>
      <b>Description:</b> Custom rules and regulations set by Community Admins.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>communityId</code> (FK, Int)</li>
        <li><code>title</code> (String) - Rule headline</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>Community</code></li>
      </ul>
    </td>
    <td valign="top">
    </td>
  </tr>
</table>

## 5. Administration & Moderation Module

<table>
  <tr>
    <td valign="top" width="50%">
      <b>• Report</b><br><br>
      <b>Description:</b> Content reporting system allowing users to flag violations for Global Admins.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>reporterId</code> (FK, String)</li>
        <li><code>postId</code> (FK, Int)</li>
        <li><code>reason</code> (String) - Report reason (Spam, Hate speech, etc.)</li>
        <li><code>status</code> (Enum: PENDING, RESOLVED, DISMISSED)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Tied to a specific <code>Post</code> suspected of violation.</li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <b>• CommunityBannedUser</b><br><br>
      <b>Description:</b> Blacklist for individual Communities, enforced by local Moderators.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>reason</code> (String, nullable) - Ban reason</li>
        <li><code>userId</code> (FK, String) - The banned user</li>
        <li><code>communityId</code> (FK, Int)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Isolates the user from the community space without suspending their global platform account.</li>
      </ul>
    </td>
  </tr>
</table>
