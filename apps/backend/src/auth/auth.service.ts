import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import * as nodemailer from 'nodemailer';
import type { FastifyReply } from 'fastify';

const VERIFY_PREFIX = 'email-verify';
const RESET_PREFIX = 'password-reset';

function getJwtSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-in-prod');
}

async function signJwt(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT({ ...payload, jti: crypto.randomUUID() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());
}

export async function verifyJwt(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload;
}

/** Redis key for token blacklist entries */
export const BLACKLIST_PREFIX = 'auth:blacklist';

function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie('breadit_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    domain: process.env.COOKIE_DOMAIN,
    maxAge: 30 * 24 * 60 * 60,
  });
}

function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie('breadit_session', { path: '/' });
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private createTransporter() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  private async sendMail(to: string, subject: string, html: string) {
    const transporter = this.createTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'noreply@breadit.dev',
      to,
      subject,
      html,
    });
  }

  // ─── Token helpers ────────────────────────────────────────────────────────

  private generate6DigitCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async createVerificationCode(email: string): Promise<string> {
    const identifier = `${VERIFY_PREFIX}:${email}`;
    const code = this.generate6DigitCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await this.prisma.verificationToken.deleteMany({ where: { identifier } });
    // Prefix with email to guarantee uniqueness on the token field
    await this.prisma.verificationToken.create({
      data: { identifier, token: `${identifier}:${code}`, expires },
    });
    return code;
  }

  private async consumeVerificationCode(email: string, code: string) {
    const identifier = `${VERIFY_PREFIX}:${email}`;
    const tokenValue = `${identifier}:${code}`;
    const record = await this.prisma.verificationToken.findFirst({
      where: { identifier, token: tokenValue },
    });
    if (!record) return null;
    if (record.expires < new Date()) {
      await this.prisma.verificationToken.deleteMany({ where: { identifier } });
      return null;
    }
    await this.prisma.verificationToken.deleteMany({ where: { identifier } });
    return { email };
  }

  private async createPasswordResetToken(email: string): Promise<string> {
    const identifier = `${RESET_PREFIX}:${email}`;
    const code = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.prisma.verificationToken.deleteMany({ where: { identifier } });
    await this.prisma.verificationToken.create({
      data: { identifier, token: code, expires },
    });
    return code;
  }

  private async consumePasswordResetToken(token: string) {
    // token here is the raw UUID-style token from the reset link — kept for compat
    const record = await this.prisma.verificationToken.findFirst({
      where: { token },
    });
    if (!record || !record.identifier.startsWith(`${RESET_PREFIX}:`)) return null;
    if (record.expires < new Date()) {
      await this.prisma.verificationToken.delete({ where: { token: record.token } });
      return null;
    }
    await this.prisma.verificationToken.delete({ where: { token: record.token } });
    return { email: record.identifier.slice(RESET_PREFIX.length + 1) };
  }

  // ─── Email helpers ────────────────────────────────────────────────────────

  private async sendVerificationEmail(to: string, code: string) {
    await this.sendMail(
      to,
      'Your Breadit verification code',
      `<div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Verify your Breadit account</h2>
        <p>Enter this code in the app to activate your account:</p>
        <div style="font-size:40px;font-weight:bold;letter-spacing:12px;padding:16px 0">${code}</div>
        <p style="color:#888">This code expires in <strong>15 minutes</strong>. Do not share it with anyone.</p>
      </div>`,
    );
  }

  private async sendPasswordResetEmail(to: string, token: string) {
    const url = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/reset?token=${token}`;
    await this.sendMail(
      to,
      'Reset your Breadit password',
      `<h2>Reset your Breadit password</h2>
       <p>Click the link below to set a new password. It expires in 1 hour.</p>
       <a href="${url}">${url}</a>
       <p>If you did not request this, you can safely ignore this email.</p>`,
    );
  }

  // ─── Auth operations ──────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const dup = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (dup) throw new ConflictException('Email or username already taken');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email, username: dto.username, password: hashed, displayName: dto.username },
      select: { id: true },
    });

    try {
      const code = await this.createVerificationCode(dto.email);
      await this.sendVerificationEmail(dto.email, code);
    } catch (err) {
      console.error('Failed to send verification email:', err);
    }

    return { userId: user.id };
  }

  async login(dto: LoginDto, reply: FastifyReply) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, username: true, img: true, password: true, emailVerified: true, role: true, banned: true },
    });
    if (!user?.password) throw new UnauthorizedException('Invalid email or password');

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid email or password');

    const token = await signJwt({
      sub: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified?.toISOString() ?? null,
      role: user.role,
      banned: user.banned,
    });
    setSessionCookie(reply, token);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
        img: user.img,
        role: user.role,
        banned: user.banned,
      },
    };
  }

  async logout(reply: FastifyReply, token?: string) {
    // Blacklist the current token in Redis so it cannot be reused
    // even if someone copied the cookie before logout
    if (token) {
      try {
        const payload = await verifyJwt(token);
        const jti = payload['jti'] as string | undefined;
        const exp = payload.exp as number | undefined;
        if (jti && exp) {
          const ttl = exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await this.redis.set(`${BLACKLIST_PREFIX}:${jti}`, '1', 'EX', ttl);
          }
        }
      } catch {
        // token already invalid — nothing to blacklist
      }
    }
    clearSessionCookie(reply);
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerified: true,
        img: true,
        displayName: true,
        bio: true,
        location: true,
        job: true,
        website: true,
        cover: true,
        role: true,
        banned: true,
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  async verifyEmail(email: string, code: string) {
    const result = await this.consumeVerificationCode(email, code);
    if (!result) throw new BadRequestException('Invalid or expired code');
    await this.prisma.user.update({
      where: { email: result.email },
      data: { emailVerified: new Date() },
    });
    return { ok: true };
  }

  async resendVerificationCode(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });
    // Silent return — don't leak whether email exists
    if (!user || user.emailVerified) return { ok: true };
    try {
      const code = await this.createVerificationCode(email);
      await this.sendVerificationEmail(email, code);
    } catch (err) {
      console.error('Failed to resend verification email:', err);
    }
    return { ok: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      try {
        const token = await this.createPasswordResetToken(email);
        await this.sendPasswordResetEmail(email, token);
      } catch (err) {
        console.error('Failed to send reset email:', err);
      }
    }
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const result = await this.consumePasswordResetToken(token);
    if (!result) throw new BadRequestException('Token is invalid or has expired');
    const hashed = await bcrypt.hash(password, 10);
    await this.prisma.user.update({ where: { email: result.email }, data: { password: hashed } });
    return { ok: true };
  }
}

