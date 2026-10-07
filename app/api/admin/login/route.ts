import { NextResponse } from 'next/server';
import {
    ADMIN_SESSION_COOKIE,
    ADMIN_SESSION_MAX_AGE_SECONDS,
    createAdminSessionToken,
    verifyAdminPassword,
} from '@/lib/adminAuth';
import { hasAcceptableJsonSize, isSameOriginRequest, requestIp } from '@/lib/requestSecurity';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; startedAt: number }>();

function getLoginRetryAfter(ip: string) {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || now - entry.startedAt >= LOGIN_WINDOW_MS) {
        loginAttempts.set(ip, { count: 0, startedAt: now });
        return null;
    }

    if (entry.count < LOGIN_MAX_ATTEMPTS) return null;
    return Math.max(1, Math.ceil((entry.startedAt + LOGIN_WINDOW_MS - now) / 1000));
}

function recordFailedLogin(ip: string) {
    const entry = loginAttempts.get(ip);
    if (entry) entry.count += 1;
}

export async function POST(request: Request) {
    if (!isSameOriginRequest(request)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!hasAcceptableJsonSize(request)) {
        return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    }

    const ip = requestIp(request);
    const retryAfter = getLoginRetryAfter(ip);
    if (retryAfter !== null) {
        return NextResponse.json(
            { error: 'Too many login attempts' },
            { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        );
    }

    const body = await request.json().catch(() => null);
    if (!verifyAdminPassword(body?.password)) {
        recordFailedLogin(ip);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = createAdminSessionToken();
    if (!token) {
        return NextResponse.json({ error: 'Admin authentication is not configured' }, { status: 503 });
    }

    const response = NextResponse.json({ authenticated: true });
    loginAttempts.delete(ip);
    response.cookies.set({
        name: ADMIN_SESSION_COOKIE,
        value: token,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
    return response;
}
