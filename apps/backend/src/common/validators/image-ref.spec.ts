import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { validate } from 'class-validator';
import { UpdateUserDto } from '../../users/dto/update-user.dto';
import { UpdateCommunityDto } from '../../communities/dto/community.dto';
import { ALLOWED_IMAGE_HOSTS } from '../allowed-image-hosts';
import { isImageRef } from './image-ref';

const VALID = [
  'abc123.jpg',
  'a-b_c.PNG',
  '2f6c1d8e-1b7a-4f4e-9d1e-5d8c2f3a4b5c.jpg',
  'photo.webp',
  'anim.gif',
  'https://res.cloudinary.com/demo/image/upload/v1/breadit/abc.jpg',
  'https://picsum.photos/seed/u_human01/200/200',
];

const INVALID: Array<[string, unknown]> = [
  ['an unknown host', 'https://evil.example/x.png'],
  ['http instead of https', 'http://res.cloudinary.com/x.jpg'],
  ['a host that only starts like an allowed one', 'https://res.cloudinary.com.evil.example/x.jpg'],
  ['credentials in front of the host', 'https://res.cloudinary.com@evil.example/x.jpg'],
  ['a javascript: URL', 'javascript:alert(1)'],
  ['a data: URL', 'data:image/png;base64,AAAA'],
  ['a path with ..', '../../etc/passwd'],
  ['a file name inside a folder', 'a/b.jpg'],
  ['a file that is not an image', 'script.html'],
  ['a name that starts with a dot', '.htaccess.jpg'],
  ['an empty string', ''],
  ['more than 300 characters', `${'a'.repeat(300)}.jpg`],
  ['a number', 42],
  ['an object', { url: 'x.jpg' }],
];

describe('isImageRef (N4)', () => {
  it.each(VALID)('accepts %s', (value) => {
    expect(isImageRef(value)).toBe(true);
  });

  it.each(INVALID)('rejects %s', (_label, value) => {
    expect(isImageRef(value)).toBe(false);
  });
});

describe('DTOs use @IsImageRef (N4)', () => {
  const build = <T extends object>(Cls: new () => T, data: Partial<Record<string, unknown>>) =>
    Object.assign(new Cls(), data);

  it.each([
    ['UpdateUserDto', UpdateUserDto],
    ['UpdateCommunityDto', UpdateCommunityDto],
  ] as const)('%s rejects a bad avatar and cover, and accepts good ones', async (_name, Cls) => {
    for (const field of ['img', 'cover']) {
      const bad = await validate(build(Cls as any, { [field]: 'https://evil.example/x.png' }));
      expect(bad.map((e) => e.property)).toContain(field);
      const good = await validate(build(Cls as any, { [field]: 'abc123.jpg' }));
      expect(good.map((e) => e.property)).not.toContain(field);
    }
  });

  it('both fields stay optional', async () => {
    expect(await validate(build(UpdateUserDto, { displayName: 'Only a name' }))).toHaveLength(0);
    expect(await validate(build(UpdateCommunityDto, { description: 'Only text' }))).toHaveLength(0);
  });
});

describe('ALLOWED_IMAGE_HOSTS', () => {
  it('lists only hosts that next.config.ts also allows (otherwise next/image throws)', () => {
    const nextConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../../frontend/next.config.ts'),
      'utf8',
    );
    expect(ALLOWED_IMAGE_HOSTS.length).toBeGreaterThan(0);
    for (const host of ALLOWED_IMAGE_HOSTS) {
      expect(nextConfig).toMatch(new RegExp(`hostname:\\s*["']${host.replace(/\./g, '\\.')}["']`));
    }
  });
});
