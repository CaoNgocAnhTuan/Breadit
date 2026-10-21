import { BannedUserGuard } from './banned-user.guard';
import { JwtAuthGuard } from './jwt.guard';
import { PostsController } from '../posts/posts.controller';
import { CommentsController } from '../comments/comments.controller';
import { MessagesController } from '../messages/messages.controller';
import { UploadsController } from '../uploads/uploads.controller';
import { CommunitiesController } from '../communities/communities.controller';

const guardsOf = (target: object): unknown[] => Reflect.getMetadata('__guards__', target) ?? [];

/**
 * S3: a ban must stop every write. These routes were missing the guard once.
 * The guard needs `req.user`, so it must come after JwtAuthGuard.
 */
describe('BannedUserGuard coverage (S3)', () => {
  const routes: Array<[string, object]> = [
    ['PostsController.create', PostsController.prototype.create],
    ['CommentsController.create', CommentsController.prototype.create],
    ['UploadsController.upload', UploadsController.prototype.upload],
    ['CommunitiesController.create', CommunitiesController.prototype.create],
    ['MessagesController (whole class)', MessagesController],
  ];

  it.each(routes)('%s has BannedUserGuard after JwtAuthGuard', (_name, target) => {
    const guards = guardsOf(target);
    const jwt = guards.indexOf(JwtAuthGuard);
    const banned = guards.indexOf(BannedUserGuard);
    expect(banned).toBeGreaterThanOrEqual(0);
    if (jwt >= 0) expect(jwt).toBeLessThan(banned);
  });

  it('MessagesController keeps JwtAuthGuard first at class level', () => {
    expect(guardsOf(MessagesController)[0]).toBe(JwtAuthGuard);
  });
});
