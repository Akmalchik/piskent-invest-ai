import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_SESSION_COOKIE = 'piskent_admin_session';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function getSigningSecret() {
    return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

function sign(payload: string, secret: string) {
    return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyAdminPassword(password: unknown) {
    const configuredPassword = process.env.ADMIN_PASSWORD;
    if (!configuredPassword || typeof password !== 'string') return false;

    return safeEqual(password, configuredPassword);
}

export function createAdminSessionToken() {
    const secret = getSigningSecret();
    if (!secret) return null;

    const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS;
    const payload = `${expiresAt}.${randomBytes(16).toString('base64url')}`;
    return `${payload}.${sign(payload, secret)}`;
}

export async function verifyAdminSession() {
    const secret = getSigningSecret();
    if (!secret) return false;

    const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
    if (!token) return false;

    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [expiresAtText, nonce, signature] = parts;
    const expiresAt = Number(expiresAtText);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;

    const payload = `${expiresAtText}.${nonce}`;
    return safeEqual(signature, sign(payload, secret));
}
