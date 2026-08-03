import { NextResponse } from 'next/server';
import {
    ADMIN_SESSION_COOKIE,
    ADMIN_SESSION_MAX_AGE_SECONDS,
    createAdminSessionToken,
    verifyAdminPassword,
} from '@/lib/adminAuth';

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    if (!verifyAdminPassword(body?.password)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = createAdminSessionToken();
    if (!token) {
        return NextResponse.json({ error: 'Admin authentication is not configured' }, { status: 503 });
    }

    const response = NextResponse.json({ authenticated: true });
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
