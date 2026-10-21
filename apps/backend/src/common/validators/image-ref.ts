import { registerDecorator, ValidationOptions } from 'class-validator';
import { ALLOWED_IMAGE_HOSTS } from '../allowed-image-hosts';

/** A file this server saved: `/api/uploads` returns a bare name like `3f2a….jpg`. */
const UPLOADED_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(jpe?g|png|webp|gif)$/i;

/**
 * True for an uploaded file name, or an `https://` URL on an allowed image host.
 * Anything else (other hosts, http, javascript:, paths, non-images) is refused (finding N4).
 */
export function isImageRef(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0 || value.length > 300) return false;
  if (UPLOADED_FILE.test(value)) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      ALLOWED_IMAGE_HOSTS.includes(url.hostname)
    );
  } catch {
    return false;
  }
}

/** Validates an `img` or `cover` field. Combine with `@IsOptional()` when it may be left out. */
export function IsImageRef(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isImageRef',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isImageRef(value),
        defaultMessage: () =>
          '$property must be an uploaded file name or an https URL on an allowed image host',
      },
    });
  };
}
