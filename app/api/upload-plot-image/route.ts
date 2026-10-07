import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { verifyAdminSession } from '@/lib/adminAuth';
import { isSameOriginRequest } from '@/lib/requestSecurity';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

export async function POST(request: Request) {
    if (!isSameOriginRequest(request)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!(await verifyAdminSession())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = getSupabaseAdminClient();
        const formData = await request.formData();
        const file = formData.get('file');

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Rasm fayli topilmadi.' }, { status: 400 });
        }

        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
            return NextResponse.json({ error: 'Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.' }, { status: 400 });
        }

        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'Rasm hajmi 5 MB dan oshmasligi kerak.' }, { status: 413 });
        }

        const extension = EXTENSIONS[file.type];
        const randomPart = crypto.randomUUID().replaceAll('-', '');
        const filePath = `plots/${Date.now()}-${randomPart}.${extension}`;
        const fileBytes = await file.arrayBuffer();
        if (!hasValidImageSignature(new Uint8Array(fileBytes), file.type)) {
            return NextResponse.json({ error: 'Содержимое файла не соответствует формату изображения.' }, { status: 400 });
        }
        const { error } = await supabase.storage
            .from('plot-images')
            .upload(filePath, fileBytes, {
                contentType: file.type,
                upsert: false,
            });

        if (error) throw error;

        const { data } = supabase.storage.from('plot-images').getPublicUrl(filePath);
        return NextResponse.json({ imageUrl: data.publicUrl });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Rasmni yuklab bo‘lmadi.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

function hasValidImageSignature(bytes: Uint8Array, mimeType: string) {
    if (mimeType === 'image/jpeg') {
        return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (mimeType === 'image/png') {
        const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
    }
    if (mimeType === 'image/webp') {
        return bytes.length >= 12
            && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
            && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    }
    return false;
}
