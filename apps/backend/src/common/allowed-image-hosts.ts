/**
 * Hosts a user may use for an avatar or cover image, besides files uploaded to this server.
 *
 * KEEP IN SYNC with `images.remotePatterns` in `apps/frontend/next.config.ts`: `next/image`
 * throws on any other host, and that error makes whole pages return 500 (finding N4).
 * A unit test (`image-ref.spec.ts`) fails if a host here is missing from `next.config.ts`.
 */
export const ALLOWED_IMAGE_HOSTS = ['res.cloudinary.com', 'picsum.photos'];
