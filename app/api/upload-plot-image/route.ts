import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

export async function POST(request: Request) {
    try {
        const adminSession = request.headers.get('X-Admin-Session')?.trim();
        if (!adminSession) {
            return NextResponse.json({ error: 'Avval admin panelga kiring.' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Rasm fayli topilmadi.' }, { status: 400 });
        }

        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
            return NextResponse.json({ error: 'Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.' }, { status: 400 });
        }

        const extension = EXTENSIONS[file.type];
        const randomPart = crypto.randomUUID().replaceAll('-', '');
        const filePath = `plots/${Date.now()}-${randomPart}.${extension}`;
        const fileBytes = await file.arrayBuffer();
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
