import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEFAULT_PROFILE = {
    id: 1,
    district_name: 'Piskent tumani',
    hero_image: '',
    population: '',
    working_population: '',
    mahallas: '',
    area_km2: '',
    electricity_percent: '',
    gas_percent: '',
    water_percent: '',
    roads_percent: '',
    description: '',
    description_uz: '',
    description_ru: '',
    description_en: '',
    description_zh: '',
    mayor_name: '',
    mayor_photo: '',
    deputy_name: '',
    deputy_photo: '',
    investment_department_name: 'Investitsiyalar, sanoat va savdo bo‘limi',
    investment_head_name: '',
    investment_phone: '',
    investment_phone2: '',
    updated_at: null,
};

const ALLOWED_FIELDS = [
    'district_name',
    'hero_image',
    'population',
    'working_population',
    'mahallas',
    'area_km2',
    'electricity_percent',
    'gas_percent',
    'water_percent',
    'roads_percent',
    'description',
    'description_uz',
    'description_ru',
    'description_en',
    'description_zh',
    'mayor_name',
    'mayor_photo',
    'deputy_name',
    'deputy_photo',
    'investment_department_name',
    'investment_head_name',
    'investment_phone',
    'investment_phone2',
];

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('district_profile')
            .select('*')
            .eq('id', 1)
            .maybeSingle();

        if (error) throw error;

        return NextResponse.json({ ...DEFAULT_PROFILE, ...(data || {}) }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: `Ошибка чтения паспорта района: ${error.message}` },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const updateData = ALLOWED_FIELDS.reduce((acc: Record<string, unknown>, field) => {
            if (Object.prototype.hasOwnProperty.call(body || {}, field)) {
                acc[field] = body[field];
            }
            return acc;
        }, {});

        const { data, error } = await supabase
            .from('district_profile')
            .upsert({ id: 1, ...updateData, updated_at: new Date().toISOString() }, { onConflict: 'id' })
            .select('*')
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, profile: { ...DEFAULT_PROFILE, ...data } });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: `Ошибка обновления паспорта района: ${error.message}` },
            { status: 500 }
        );
    }
}
