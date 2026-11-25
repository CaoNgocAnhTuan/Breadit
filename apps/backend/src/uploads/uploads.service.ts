import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary, type UploadApiOptions } from 'cloudinary';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { VIDEO_EXT, mediaKind } from './media-types';

export type BufferedFile = {
  buffer: Buffer;
  mimetype: string;
  filename: string;
};

function tryExtractCloudinaryPublicId(url: string) {
  // Example: https://res.cloudinary.com/<cloud>/image/upload/v123/breadit/abc.jpg
  // We want: breadit/abc (no extension, no version segment)
  const match = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/.exec(url);
  if (!match) return null;
  return match[1];
}

function uploadToCloudinary(
  buffer: Buffer,
  options: UploadApiOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err || !result) return reject(err ?? new Error('No result from Cloudinary'));
      resolve(result.secure_url);
    });
    stream.end(buffer);
  });
}

@Injectable()
export class UploadsService {
  private readonly uploadDir: string;
  private readonly useCloudinary: boolean;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR ?? '/var/lib/breadit/uploads';
    // Evaluated in constructor so ConfigModule.forRoot() has already loaded .env
    this.useCloudinary = !!process.env.CLOUDINARY_CLOUD_NAME;

    if (this.useCloudinary) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    } else {
      fs.mkdir(this.uploadDir, { recursive: true }).catch(() => null);
    }
  }

  async saveFile(file: BufferedFile, imgType?: string): Promise<string> {
    // S4: every upload (posts, comments, communities, /api/uploads) comes through here, on disk and on Cloudinary.
    if (mediaKind(file.mimetype) === null) throw new BadRequestException('Unsupported file type');
    if (this.useCloudinary) {
      return this.saveToCloudinary(file, imgType);
    }
    return this.saveToLocalDisk(file, imgType);
  }

  async deleteFile(pathOrUrl: string) {
    if (!pathOrUrl) return;

    if (this.useCloudinary) {
      const publicId = tryExtractCloudinaryPublicId(pathOrUrl);
      if (!publicId) return;
      // Best-effort: try image + video resource types
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' as const }).catch(() => null);
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' as const }).catch(() => null);
      return;
    }

    // Local disk: treat as filename or URL ending with filename
    const filename = path.basename(pathOrUrl);
    if (!filename) return;
    await fs.unlink(path.join(this.uploadDir, filename)).catch(() => null);
  }

  private async saveToCloudinary(file: BufferedFile, imgType?: string): Promise<string> {
    if (file.mimetype.startsWith('image/')) {
      let transformation: object[];
      if (imgType === 'square') transformation = [{ width: 600, height: 600, crop: 'fill' }];
      else if (imgType === 'wide') transformation = [{ width: 600, height: 338, crop: 'fill' }];
      else transformation = [{ width: 1200, crop: 'limit' }];

      return uploadToCloudinary(file.buffer, {
        resource_type: 'image' as const,
        format: 'jpg',
        quality: 'auto',
        transformation,
        folder: 'breadit',
      });
    }

    // video
    return uploadToCloudinary(file.buffer, {
      resource_type: 'video' as const,
      folder: 'breadit',
    });
  }

  private async saveToLocalDisk(file: BufferedFile, imgType?: string): Promise<string> {
    if (mediaKind(file.mimetype) === 'image') {
      let image = sharp(file.buffer);
      if (imgType === 'square') {
        image = image.resize(600, 600, { fit: 'cover' });
      } else if (imgType === 'wide') {
        image = image.resize(600, 338, { fit: 'cover' });
      } else {
        image = image.resize(600);
      }
      let output: Buffer;
      try {
        output = await image.jpeg({ quality: 80 }).toBuffer();
      } catch {
        // F8: a file that says it is an image but is not. Nothing is written.
        throw new BadRequestException('The file is not a valid image');
      }
      const filename = `${randomUUID()}.jpg`;
      await fs.writeFile(path.join(this.uploadDir, filename), output);
      return filename;
    }

    // S4: the extension comes from the checked type (saveFile has refused every type outside VIDEO_EXT).
    const filename = `${randomUUID()}${VIDEO_EXT[file.mimetype]}`;
    await fs.writeFile(path.join(this.uploadDir, filename), file.buffer);
    return filename;
  }

  isVideo(file: BufferedFile): boolean {
    return mediaKind(file.mimetype) === 'video';
  }
}
