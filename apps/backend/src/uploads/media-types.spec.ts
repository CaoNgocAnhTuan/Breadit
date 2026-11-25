import { VIDEO_EXT, mediaKind } from './media-types';

// TC6 (S4). `mediaKind` decides what the upload service keeps. Anything that is not an image or a known video is null.

describe('mediaKind (S4, TC6)', () => {
  it('image types are images', () => {
    expect(mediaKind('image/png')).toBe('image');
    expect(mediaKind('image/jpeg')).toBe('image');
    expect(mediaKind('image/webp')).toBe('image');
  });

  it('the four listed video types are videos', () => {
    for (const t of ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']) {
      expect(mediaKind(t)).toBe('video');
    }
  });

  it('everything else is null', () => {
    for (const t of ['text/html', 'application/octet-stream', 'application/javascript', 'video/x-unknown', '']) {
      expect(mediaKind(t)).toBeNull();
    }
  });

  it('VIDEO_EXT gives the stored extension of each video type', () => {
    expect(VIDEO_EXT['video/mp4']).toBe('.mp4');
    expect(VIDEO_EXT['video/webm']).toBe('.webm');
    expect(VIDEO_EXT['video/quicktime']).toBe('.mov');
    expect(VIDEO_EXT['video/ogg']).toBe('.ogv');
  });
});
