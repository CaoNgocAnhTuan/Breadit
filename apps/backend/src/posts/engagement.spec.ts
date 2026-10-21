import { engagementSelect } from './engagement';

describe('engagementSelect', () => {
  it('T1: counts only reposts that are not soft-deleted', () => {
    const sel = engagementSelect('u1');
    expect(sel._count.select.rePosts).toEqual({ where: { deletedAt: null } });
  });

  it('T2: counts only comments that are not soft-deleted', () => {
    const sel = engagementSelect('u1');
    expect(sel._count.select.comments).toEqual({ where: { deletedAt: null } });
  });

  it('keeps counting every like (likes are hard-deleted, there is no deletedAt)', () => {
    expect(engagementSelect('u1')._count.select.likes).toBe(true);
  });

  it('T1: the "I reposted" flag ignores soft-deleted reposts', () => {
    const sel = engagementSelect('u1');
    expect(sel.rePosts).toEqual({ where: { userId: 'u1', deletedAt: null }, select: { id: true } });
  });

  it('adds the viewer flags for likes and saves', () => {
    const sel = engagementSelect('u1');
    expect(sel.likes).toEqual({ where: { userId: 'u1' }, select: { id: true } });
    expect(sel.saves).toEqual({ where: { userId: 'u1' }, select: { id: true } });
  });

  it('has no viewer flags for a guest, but keeps the filtered counts', () => {
    const sel = engagementSelect();
    expect(sel.likes).toBe(false);
    expect(sel.rePosts).toBe(false);
    expect(sel.saves).toBe(false);
    expect(sel._count.select.rePosts).toEqual({ where: { deletedAt: null } });
  });
});
