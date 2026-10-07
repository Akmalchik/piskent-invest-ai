import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/adminAuth';

export async function GET() {
    return NextResponse.json(
        { authenticated: await verifyAdminSession() },
        {
            headers: {
                'Cache-Control': 'private, no-store, max-age=0',
                'Vary': 'Cookie',
            },
        },
    );
}
