/**
 * S4: the only video types the app keeps, with the extension that is stored for each.
 * The stored extension comes from the checked type, never from the client's file name.
 */
export const VIDEO_EXT: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/ogg': '.ogv',
};

/** `image/*` is an image, a type in `VIDEO_EXT` is a video, anything else is `null` and is refused. */
export function mediaKind(mimetype: string): 'image' | 'video' | null {
  if (mimetype.startsWith('image/')) return 'image';
  if (Object.prototype.hasOwnProperty.call(VIDEO_EXT, mimetype)) return 'video';
  return null;
}
