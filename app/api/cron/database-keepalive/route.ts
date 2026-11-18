import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function validCronAuthorization(header: string | null, secret: string): boolean {
    if (!header?.startsWith('Bearer ')) return false;
    const received = Buffer.from(header.slice(7));
    const expected = Buffer.from(secret);
    return received.length === expected.length && timingSafeEqual(received, expected);
}

// Authenticated scheduled lightweight read to keep free-tier database activity.
export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        console.error('Database keepalive disabled: CRON_SECRET is not configured');
        return NextResponse.json({ ok: false, error: 'Not configured' }, { status: 503 });
    }
    if (!validCronAuthorization(request.headers.get('authorization'), secret)) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { error } = await getSupabaseClient()
            .from('piskent_plots')
            .select('id')
            .limit(1);

        if (error) throw error;

        return NextResponse.json({ ok: true }, {
            headers: { 'Cache-Control': 'no-store' }
        });
    } catch (error) {
        console.error('Database keepalive failed:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
    }
}
