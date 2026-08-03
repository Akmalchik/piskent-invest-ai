import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/adminAuth';

export async function GET() {
    return NextResponse.json({ authenticated: await verifyAdminSession() });
}
