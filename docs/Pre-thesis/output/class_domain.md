# Breadit Domain Classes

This document details the Domain Classes for the Breadit system, organized into 5 logical domains. The format closely follows the requested structural layout, highlighting descriptions, attributes, key methods, and relationships.

<br>

### 1. Identity & Access Domain Classes

<table border="1" cellspacing="0" cellpadding="10" width="100%">
  <tr>
    <td valign="top" width="50%">
      <ul style="margin-top: 0; padding-left: 20px;">
        <li><b><u>User</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Core entity representing every platform account, storing identity and system-level access state.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: String (PK)</li>
                <li><code>email</code>: String</li>
                <li><code>username</code>: String</li>
                <li><code>password</code>: String</li>
                <li><code>emailVerified</code>: DateTime</li>
                <li><code>displayName</code>: String</li>
                <li><code>role</code>: Role</li>
                <li><code>banned</code>: Boolean</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>register()</code>: Registers a new user</li>
                <li><code>login()</code>: Authenticates the user</li>
                <li><code>verifyEmail()</code>: Verifies user's email address</li>
                <li><code>updateProfile()</code>: Updates user profile details</li>
                <li><code>toggleFollow()</code>: Follows or unfollows another user</li>
                <li><code>toggleBlock()</code>: Blocks or unblocks another user</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Composition -&gt; Account (one-to-many)</li>
                <li>Composition -&gt; Session (one-to-many)</li>
                <li>Association -&gt; Follow</li>
                <li>Association -&gt; Block</li>
                <li>Association -&gt; CommunityMember</li>
                <li>Association -&gt; Post</li>
                <li>Association -&gt; Comment</li>
                <li>Association -&gt; Notification</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <ul style="margin-top: 0; padding-left: 20px;">
        <li><b><u>VerificationToken</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Stores single-use OTP codes for email verification and password reset.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>identifier</code>: String (PK)</li>
                <li><code>token</code>: String</li>
                <li><code>expires</code>: DateTime</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>None</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>None</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>Account</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: NextAuth.js OAuth provider link record.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: String (PK)</li>
                <li><code>userId</code>: String (FK)</li>
                <li><code>provider</code>: String</li>
                <li><code>providerAccountId</code>: String</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>Session</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Database-backed session record.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: String (PK)</li>
                <li><code>userId</code>: String (FK)</li>
                <li><code>sessionToken</code>: String</li>
                <li><code>expires</code>: DateTime</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </td>
  </tr>
</table>
<div align="center"><b>Table 1. Identity & Access Domain Classes</b></div>

<br><br>

### 2. Content Domain Classes

<table border="1" cellspacing="0" cellpadding="10" width="100%">
  <tr>
    <td valign="top" width="50%">
      <ul style="margin-top: 0; padding-left: 20px;">
        <li><b><u>Post</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Represents original posts, reposts, and quote-reposts.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>userId</code>: String (FK)</li>
                <li><code>communityId</code>: Int (FK)</li>
                <li><code>desc</code>: String</li>
                <li><code>isApproved</code>: Boolean</li>
                <li><code>rePostId</code>: Int (FK)</li>
                <li><code>parentPostId</code>: Int (FK)</li>
                <li><code>createdAt</code>: DateTime</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>create()</code>: Creates a new post</li>
                <li><code>remove()</code>: Soft deletes the post</li>
                <li><code>getFeed()</code>: Retrieves post feed</li>
                <li><code>report()</code>: Reports the post</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
                <li>Association -&gt; Community</li>
                <li>Composition -&gt; PostMedia (one-to-many)</li>
                <li>Composition -&gt; Comment (one-to-many)</li>
                <li>Association -&gt; PostTag (one-to-many)</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>PostMedia</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Stores image and video attachments for a Post.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>postId</code>: Int (FK)</li>
                <li><code>url</code>: String</li>
                <li><code>type</code>: String</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>upload()</code>: Uploads media file</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; Post</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <ul style="margin-top: 0; padding-left: 20px;">
        <li><b><u>Comment</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: User replies to a Post, supporting nested comment threads.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>postId</code>: Int (FK)</li>
                <li><code>userId</code>: String (FK)</li>
                <li><code>parentCommentId</code>: Int (FK)</li>
                <li><code>body</code>: String</li>
                <li><code>createdAt</code>: DateTime</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>create()</code>: Adds a comment</li>
                <li><code>remove()</code>: Removes a comment</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
                <li>Association -&gt; Post</li>
                <li>Composition -&gt; CommentMedia (one-to-many)</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>CommentMedia</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: File attachments embedded inside comments.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>commentId</code>: Int (FK)</li>
                <li><code>url</code>: String</li>
                <li><code>type</code>: String</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; Comment</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>Hashtag</u> &amp; <u>PostTag</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Registry of tags and the junction class linking Posts to Hashtags.</li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>getPostsByTag()</code>: Retrieves posts by hashtag</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; Post</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </td>
  </tr>
</table>
<div align="center"><b>Table 2. Content Domain Classes</b></div>

<br><br>

### 3. Social Engagement Domain Classes

<table border="1" cellspacing="0" cellpadding="10" width="100%">
  <tr>
    <td valign="top" width="50%">
      <ul style="margin-top: 0; padding-left: 20px;">
        <li><b><u>Follow</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Directed social graph edge for user following.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>followerId</code>: String (FK)</li>
                <li><code>followingId</code>: String (FK)</li>
                <li><code>notify</code>: Boolean</li>
                <li><code>createdAt</code>: DateTime</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>toggleFollow()</code>: Follows or unfollows a user</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>Block</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Mutual blacklist between two users.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>blockerId</code>: String (FK)</li>
                <li><code>blockedId</code>: String (FK)</li>
                <li><code>createdAt</code>: DateTime</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>toggleBlock()</code>: Blocks or unblocks a user</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>Mention</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Records @username tags inside content.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>userId</code>: String (FK)</li>
                <li><code>postId</code>: Int (FK)</li>
                <li><code>commentId</code>: Int (FK)</li>
                <li><code>username</code>: String</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User, Post, Comment</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <ul style="margin-top: 0; padding-left: 20px;">
        <li><b><u>Like</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Records a User's reaction on a Post.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>userId</code>: String (FK)</li>
                <li><code>postId</code>: Int (FK)</li>
                <li><code>createdAt</code>: DateTime</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>toggleLike()</code>: Likes or unlikes a post</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
                <li>Association -&gt; Post</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>SavedPosts</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: User's personal bookmark list.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>userId</code>: String (FK)</li>
                <li><code>postId</code>: Int (FK)</li>
                <li><code>createdAt</code>: DateTime</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>toggleSave()</code>: Saves or unsaves a post</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
                <li>Association -&gt; Post</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>CommentLike</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Records a User's reaction on a Comment.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>userId</code>: String (FK)</li>
                <li><code>commentId</code>: Int (FK)</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
                <li>Association -&gt; Comment</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </td>
  </tr>
</table>
<div align="center"><b>Table 3. Social Engagement Domain Classes</b></div>

<br><br>

### 4. Community & Moderation Domain Classes

<table border="1" cellspacing="0" cellpadding="10" width="100%">
  <tr>
    <td valign="top" width="50%">
      <ul style="margin-top: 0; padding-left: 20px;">
        <li><b><u>Community</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: A shared space for members with a common interest.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>name</code>: String</li>
                <li><code>slug</code>: String</li>
                <li><code>description</code>: String</li>
                <li><code>createdAt</code>: DateTime</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>create()</code>: Creates a new community</li>
                <li><code>update()</code>: Updates community details</li>
                <li><code>delete()</code>: Deletes the community</li>
                <li><code>join()</code>: Joins or leaves the community</li>
                <li><code>banUser()</code>: Bans a user from the community</li>
                <li><code>moderatePost()</code>: Approves or rejects a post</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Composition -&gt; CommunityMember (one-to-many)</li>
                <li>Composition -&gt; CommunityRule (one-to-many)</li>
                <li>Composition -&gt; CommunityBannedUser (one-to-many)</li>
                <li>Composition -&gt; Post (one-to-many)</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>CommunityBannedUser</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Community-level blacklist enforced by Moderators.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>userId</code>: String (FK)</li>
                <li><code>communityId</code>: Int (FK)</li>
                <li><code>reason</code>: String</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
                <li>Association -&gt; Community</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <ul style="margin-top: 0; padding-left: 20px;">
        <li><b><u>CommunityMember</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Manages community members and their roles.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>userId</code>: String (FK)</li>
                <li><code>communityId</code>: Int (FK)</li>
                <li><code>role</code>: CommunityRole</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>promoteMember()</code>: Promotes a member to moderator</li>
                <li><code>transferOwnership()</code>: Transfers community ownership</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
                <li>Association -&gt; Community</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>CommunityRule</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Custom rules set by the community.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>communityId</code>: Int (FK)</li>
                <li><code>title</code>: String</li>
                <li><code>description</code>: String</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>addRule()</code>: Adds a new rule</li>
                <li><code>removeRule()</code>: Removes a rule</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; Community</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </td>
  </tr>
</table>
<div align="center"><b>Table 4. Community & Moderation Domain Classes</b></div>

<br><br>

### 5. Communication Domain Classes

<table border="1" cellspacing="0" cellpadding="10" width="100%">
  <tr>
    <td valign="top" width="50%">
      <ul style="margin-top: 0; padding-left: 20px;">
        <li><b><u>Conversation</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Represents a direct message thread.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>updatedAt</code>: DateTime</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>getConversations()</code>: Retrieves user conversations</li>
                <li><code>findOrCreate()</code>: Finds or creates a conversation thread</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Composition -&gt; ConversationMember (one-to-many)</li>
                <li>Composition -&gt; Message (one-to-many)</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>ConversationMember</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Junction class tracking conversation participants.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>conversationId</code>: Int (FK)</li>
                <li><code>userId</code>: String (FK)</li>
                <li><code>lastReadAt</code>: DateTime</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
                <li>Association -&gt; Conversation</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>Message</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Individual message within a conversation.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>conversationId</code>: Int (FK)</li>
                <li><code>senderId</code>: String (FK)</li>
                <li><code>body</code>: String</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>sendMessage()</code>: Sends a new message</li>
                <li><code>markRead()</code>: Marks message as read</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
                <li>Association -&gt; Conversation</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <ul style="margin-top: 0; padding-left: 20px;">
        <li><b><u>Notification</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: System-generated alert for users.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>recipientId</code>: String (FK)</li>
                <li><code>actorId</code>: String (FK)</li>
                <li><code>type</code>: NotificationType</li>
                <li><code>readAt</code>: DateTime</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>emit()</code>: Emits real-time notification</li>
                <li><code>markRead()</code>: Marks notification as read</li>
                <li><code>markAllRead()</code>: Marks all notifications as read</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
                <li>Association -&gt; Post</li>
                <li>Association -&gt; Comment</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <hr style="margin: 20px 0;">
      <ul style="padding-left: 20px;">
        <li><b><u>Report</u></b>
          <ul style="list-style-type: circle; padding-left: 20px; margin-top: 8px;">
            <li>Description: Content flagging system for moderation.</li>
            <li>Attributes:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>id</code>: Int (PK)</li>
                <li><code>reporterId</code>: String (FK)</li>
                <li><code>postId</code>: Int (FK)</li>
                <li><code>status</code>: ReportStatus</li>
                <li><code>reason</code>: String</li>
              </ul>
            </li>
            <li>Key Methods:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li><code>getReports()</code>: Retrieves list of open reports</li>
                <li><code>dismiss()</code>: Dismisses a report</li>
                <li><code>deleteReportedPost()</code>: Deletes the reported post</li>
              </ul>
            </li>
            <li>Relationships:
              <ul style="list-style-type: disc; padding-left: 20px;">
                <li>Association -&gt; User</li>
                <li>Association -&gt; Post</li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </td>
  </tr>
</table>
<div align="center"><b>Table 5. Communication Domain Classes</b></div>
