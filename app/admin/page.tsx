'use client';
/// <reference types="react" />
import React, { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Загружаем карту динамически для админки, исключая ошибки рендеринга на сервере (SSR)
const MyInvestmentMap = dynamic(() => import('../components/MyInvestmentMap'), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-[#0b1329] flex items-center justify-center text-xs text-slate-400">Xarita yuklanmoqda...</div>
});

const OWNERSHIP_TYPE_OPTIONS = [
    '🏛 Davlat obyekti',
    '⚖️ E-Auksion',
    '🏢 Xususiy obyekt'
];
const PROPERTY_TYPE_OPTIONS = [
    { value: 'land', label: 'Yer maydoni' },
    { value: 'building', label: 'Bino' },
    { value: 'land_building', label: 'Bino va yer maydoni' }
];
const BASIC_INFRA_OPTIONS = ['Mavjud', 'Mavjud emas', 'Aniqlanmoqda'];
const ROAD_INFRA_OPTIONS = ['Asfalt', 'Shag‘al', 'Tuproq yo‘l', 'Aniqlanmoqda'];
const normalizePropertyType = (value: unknown) => {
    const normalizedValue = String(value || '').trim();
    return PROPERTY_TYPE_OPTIONS.some((option) => option.value === normalizedValue) ? normalizedValue : 'land';
};
const normalizeInfraOption = (value: unknown, options: string[]) => {
    const normalizedValue = String(value || '').trim();
    return options.includes(normalizedValue) ? normalizedValue : 'Aniqlanmoqda';
};

const compressImage = (file: File) => new Promise<File>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, 1200 / image.naturalWidth, 1200 / image.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

        const context = canvas.getContext('2d');
        if (!context) {
            reject(new Error('Rasmni siqib bo‘lmadi.'));
            return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const supportsWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp');
        const outputType = supportsWebp ? 'image/webp' : 'image/jpeg';

        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Rasmni siqib bo‘lmadi.'));
                return;
            }

            const extension = outputType === 'image/webp' ? 'webp' : 'jpg';
            resolve(new File([blob], `plot-image.${extension}`, { type: outputType }));
        }, outputType, 0.75);
    };

    image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Rasm faylini ochib bo‘lmadi.'));
    };
    image.src = objectUrl;
});

export default function AdminPage() {
    // Внутренняя языковая переменная проекта
    const lang = 'uz';
    const [inputPassword, setInputPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const handleLogin = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (inputPassword === 'Piskent2026!') {
            setIsAuthenticated(true);
        } else {
            alert('Секретный код неверный!');
        }
    };

    // Стейты для управления массивом лотов и выбранным ID лота
    const [plots, setPlots] = useState<any[]>([]);
    const [editingPlot, setEditingPlot] = useState<any | null>(null);
    const [mapRefreshKey, setMapRefreshKey] = useState(0);
    const [isMounted, setIsMounted] = useState(false);
    // Поля формы для ручного создания нового объекта (оригинальная верстка и стейты Акмаля)
    const [name, setName] = useState('');
    const [area, setArea] = useState('');
    const [buildingAreaM2, setBuildingAreaM2] = useState('');
    const [industry, setIndustry] = useState('Sanoat / Ishlab chiqarish');
    const [status, setStatus] = useState('Mavjud');
    const [ownershipType, setOwnershipType] = useState(OWNERSHIP_TYPE_OPTIONS[0]);
    const [propertyType, setPropertyType] = useState('land');
    const [auksionUrl, setAuksionUrl] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [photoUploadStatus, setPhotoUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [photoUploadMessage, setPhotoUploadMessage] = useState('');
    // Поля инфраструктуры лота
    const [gas, setGas] = useState('Mavjud');
    const [power, setPower] = useState('Mavjud');
    const [water, setWater] = useState('Mavjud');
    const [road, setRoad] = useState('Asfalt');

    // Стейты для хранения координат клика и показа успешного баннера
    const [markerCoords, setMarkerCoords] = useState<[number, number] | null>(null);
    const [successMessage, setSuccessMessage] = useState(false);

    const resetForm = () => {
        setName('');
        setArea('');
        setBuildingAreaM2('');
        setIndustry('Sanoat / Ishlab chiqarish');
        setStatus('Mavjud');
        setOwnershipType(OWNERSHIP_TYPE_OPTIONS[0]);
        setPropertyType('land');
        setAuksionUrl('');
        setImageUrl('');
        setPhotoUploadStatus('idle');
        setPhotoUploadMessage('');
        setGas('Mavjud');
        setPower('Mavjud');
        setWater('Mavjud');
        setRoad('Asfalt');
        setMarkerCoords(null);
        setEditingPlot(null);
    };

    // Главный хук инициализации данных ГИС
    useEffect(() => {
        if (!isAuthenticated) {
            setIsMounted(false);
            return;
        }

        // Запрашиваем данные из нашей новой онлайн-базы через API-роут
        fetch('/api/save-plots')
            .then(res => {
                if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
                return res.json();
            })
            .then(async (data) => {

                console.log('TOTAL:', data.length);

                const ids = data.map((x: any) => x.id);
                console.log('UNIQUE:', new Set(ids).size);

                if (Array.isArray(data) && data.length > 0) {
                    console.log(`Успешно загружено ${data.length} лотов из Supabase.`);
                    console.log('DATA LENGTH:', data.length);
                    console.log('FIRST ID:', data[0]?.id);
                    setPlots(data);
                    console.log('PLOTS STATE:', data);
                    console.log('SET PLOTS DONE');
                }
            })
            .catch(err => {
                console.error("Критическая ошибка ГИС при инициализации:", err);
            })
            .finally(() => {
                // Сигнализируем, что клиент готов и можно безопасно рендерить карту Leaflet
                setIsMounted(true);
            });
    }, [isAuthenticated]);

    // Функция срабатывает, когда пользователь производит клик по Leaflet-карте справа
    const handleMapClick = (lat: number, lng: number) => {
        setMarkerCoords([lat, lng]);
    };

    const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setPhotoUploadStatus('error');
            setPhotoUploadMessage('Faqat JPG, PNG yoki WEBP rasm tanlang.');
            return;
        }

        if (file.size > 15 * 1024 * 1024) {
            setPhotoUploadStatus('error');
            setPhotoUploadMessage('Fayl juda katta. 15 MB gacha rasm yuklang.');
            return;
        }

        setPhotoUploadStatus('uploading');
        setPhotoUploadMessage('Yuklanmoqda...');

        try {
            const compressedFile = await compressImage(file);
            if (compressedFile.size > 2 * 1024 * 1024) {
                throw new Error('Rasm hajmi katta. Boshqa rasm tanlang.');
            }

            const formData = new FormData();
            formData.append('file', compressedFile);
            const response = await fetch('/api/upload-plot-image', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.imageUrl) {
                throw new Error(result.error || 'Rasmni yuklab bo‘lmadi.');
            }

            setImageUrl(result.imageUrl);
            setPhotoUploadStatus('success');
            setPhotoUploadMessage('Foto yuklandi');
        } catch (error) {
            setPhotoUploadStatus('error');
            setPhotoUploadMessage(error instanceof Error ? error.message : 'Xatolik yuz berdi');
        }
    };

    const handleSelectPlotForEdit = (plot: any) => {
        const infrastructure = plot.infrastructure || {};
        const polygonCoordinates = plot.polygonCoordinates || plot.polygon_coords;
        const firstPoint = Array.isArray(polygonCoordinates?.[0])
            ? polygonCoordinates[0]
            : polygonCoordinates;

        setEditingPlot(plot);
        setName(plot.name || '');
        setArea(plot.area !== undefined && plot.area !== null ? String(plot.area) : '');
        setBuildingAreaM2(plot.building_area_m2 !== undefined && plot.building_area_m2 !== null ? String(plot.building_area_m2) : String(plot.buildingAreaM2 ?? ''));
        setImageUrl(plot.image || plot.image_url || plot.photo_url || '');
        setAuksionUrl(plot.auksionUrl || plot.auksion_url || plot.auction_url || '');
        setIndustry(plot.industry || 'Production');
        setStatus(plot.status || 'Mavjud');
        setOwnershipType(plot.ownership_type || OWNERSHIP_TYPE_OPTIONS[0]);
        setPropertyType(normalizePropertyType(plot.property_type || plot.propertyType));
        setGas(normalizeInfraOption(infrastructure.gas, BASIC_INFRA_OPTIONS));
        setPower(normalizeInfraOption(infrastructure.power || infrastructure.electricity, BASIC_INFRA_OPTIONS));
        setWater(normalizeInfraOption(infrastructure.water, BASIC_INFRA_OPTIONS));
        setRoad(normalizeInfraOption(infrastructure.road, ROAD_INFRA_OPTIONS));

        if (Array.isArray(firstPoint) && firstPoint.length >= 2) {
            setMarkerCoords([Number(firstPoint[0]), Number(firstPoint[1])]);
        } else {
            setMarkerCoords(null);
        }
    };


    // СПОСОБ №2: СОЗДАНИЕ СОВЕРШЕННО НОВОГО ЛОТА ЧЕРЕЗ ФОРМУ ВРУЧНУЮ
    const handleSavePlot = async (e: React.FormEvent) => {
        e.preventDefault();
        const isEditing = Boolean(editingPlot);

        if (isEditing) {
            if (!name || !area || !imageUrl) {
                alert('Заполните обязательные поля (Название, Площадь, Фото)!');
                return;
            }

            const updatedPlot = {
                ...editingPlot,
                name,
                area: parseFloat(area),
                building_area_m2: buildingAreaM2 ? parseFloat(buildingAreaM2) : null,
                industry,
                status,
                ownership_type: ownershipType,
                property_type: propertyType,
                image: imageUrl,
                auksionUrl: auksionUrl || '',
                infrastructure: { gas, power, water, road },
                polygonCoordinates: editingPlot.polygonCoordinates || editingPlot.polygon_coords || []
            };

            try {
                const res = await fetch('/api/save-plots', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedPlot)
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || `Код ответа сервера: ${res.status}`);
                }

                const data = await res.json();
                if (data.success) {
                    setPlots(prev => prev.map(plot => plot.id === updatedPlot.id ? updatedPlot : plot));
                    setSuccessMessage(true);
                    resetForm();
                    setMapRefreshKey(prev => prev + 1);
                    setTimeout(() => setSuccessMessage(false), 4000);
                }
            } catch (err: any) {
                alert(`Ошибка при сохранении изменений: ${err.message}`);
            }
            return;
        }

        if (!name || !area || !imageUrl || !markerCoords) {
            alert('Заполните обязательные поля (Название, Площадь, Фото) и кликните на карту!');
            return;
        }

        const lat = markerCoords[0];
        const lng = markerCoords[1];
        const offset = 0.0015;

        // Строим четыре точки полигона для новой зоны
        const generatedPolygon = [
            [lat, lng],
            [lat + offset, lng],
            [lat + offset, lng + offset * 1.5],
            [lat, lng + offset * 1.5]
        ];

        // Формируем структуру нового объекта
        const newPlot = {
            id: Date.now(), // Уникальный ID на базе времени создания
            name,
            area: parseFloat(area),
            building_area_m2: buildingAreaM2 ? parseFloat(buildingAreaM2) : null,
            industry,
            status,
            ownership_type: ownershipType,
            property_type: propertyType,
            image: imageUrl,
            auksionUrl: auksionUrl || '',
            infrastructure: { gas, power, water, road },
            polygonCoordinates: generatedPolygon
        };

        // Вживляем новый лот в начало текущего списка
        const updatedPlots = [newPlot, ...plots];
        setPlots(updatedPlots);

        // Отправляем финальный массив на бэкенд-сохранение
        try {
            const res = await fetch('/api/save-plots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedPlots)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Код ответа сервера: ${res.status}`);
            }

            const data = await res.json();
            if (data.success) {
                setSuccessMessage(true);
                // Зачищаем форму после успешной отправки данных
                setName(''); setArea(''); setBuildingAreaM2(''); setImageUrl('');
                setPropertyType('land');
                setMarkerCoords(null);
                setMapRefreshKey(prev => prev + 1);
                setTimeout(() => setSuccessMessage(false), 4000);
            }
        } catch (err: any) {
            alert(`Ошибка при добавлении нового лота: ${err.message}`);
        }
    };

    const handleDeletePlot = async () => {
        if (!editingPlot) return;

        const confirmed = window.confirm('Вы действительно хотите удалить этот объект? Это действие нельзя отменить.');
        if (!confirmed) return;

        try {
            const res = await fetch('/api/save-plots', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingPlot.id })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Код ответа сервера: ${res.status}`);
            }

            const data = await res.json();
            if (data.success) {
                setPlots(prev => prev.filter(plot => plot.id !== editingPlot.id));
                setSuccessMessage(true);
                resetForm();
                setMapRefreshKey(prev => prev + 1);
                setTimeout(() => setSuccessMessage(false), 4000);
            }
        } catch (err: any) {
            alert(`Ошибка при удалении объекта: ${err.message}`);
        }
    };

    // 1. Добавляем проверку условия перед твоим новым кодом:
    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900 p-4 font-sans">
                <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-sm w-full border border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <h2 className="text-xl font-bold text-white tracking-tight">Piskent Invest AI</h2>
                    </div>
                    <p className="text-xs text-slate-400 mb-6 font-medium">Вход в панель управления хокимията</p>

                    <input
                        type="password"
                        placeholder="Секретный код доступа"
                        value={inputPassword}
                        onChange={(e) => setInputPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition mb-4 text-black"
                    />

                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-900/20">
                        Войти в систему
                    </button>
                </form>
            </div>
        );
    } // <-- Обязательно закрываем фигурную скобку условия здесь!

    // 2. Дальше идет твой главный нетронутый return страницы:
    return (
        <div className="flex h-screen w-full bg-[#030712] text-slate-100 font-sans overflow-hidden">

            {/* СЕКЦИЯ ИНТЕРФЕЙСА И ФОРМЫ СЛЕВА */}
            <div className="w-1/2 h-full bg-[#0b1329] border-r border-slate-800 p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                <div>
                    <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-6">
                        <div>
                            <h1 className="text-base font-black text-white uppercase tracking-wider">Piskent Invest AI</h1>
                            <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mt-0.5">Админ-панель отдела инвестиций</p>
                        </div>
                        <Link href="/" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-[11px] font-bold text-slate-300 transition-all">
                            ◀ На сайт инвестора
                        </Link>
                    </div>

                    {successMessage && (
                        <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs rounded-xl font-bold animate-fade-in">
                            🎉 Данные успешно сохранены в общую базу проекта!
                        </div>
                    )}



                    {/* ФОРМА ИНСТРУМЕНТА №2 */}
                    <form onSubmit={handleSavePlot} className="space-y-4 mt-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">НАЗВАНИЕ ОБЪЕКТА / ЛОТА</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Новая текстильная фабрика" className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">ПЛОЩАДЬ (В ГЕКТАРАХ)</label>
                                <input type="number" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} placeholder="4.5" className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Bino maydoni, m²</label>
                                <input type="number" step="0.1" value={buildingAreaM2} onChange={(e) => setBuildingAreaM2(e.target.value)} placeholder="Masalan: 450" className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                URL ФОТО ОБЪЕКТА
                            </label>
                            <input
                                type="url"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                placeholder="https://..."
                                className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                            />
                            <p className="mt-1 text-[10px] text-slate-500">
                                Faqat to‘g‘ridan-to‘g‘ri rasm havolasi kiriting: .jpg, .png, .webp
                            </p>
                            <label className="text-[10px] font-bold text-slate-400 block mt-3 mb-1">
                                Foto yuklash
                            </label>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handlePhotoUpload}
                                disabled={photoUploadStatus === 'uploading'}
                                className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-900 file:px-3 file:py-1 file:text-xs file:font-bold file:text-cyan-100 disabled:opacity-60"
                            />
                            <p className="mt-1 text-[10px] text-slate-500">
                                JPG, PNG yoki WEBP. Rasm avtomatik siqiladi.
                            </p>
                            {photoUploadStatus !== 'idle' && (
                                <p className={`mt-1 text-[10px] font-bold ${photoUploadStatus === 'error' ? 'text-red-400' : photoUploadStatus === 'success' ? 'text-emerald-400' : 'text-cyan-400'}`}>
                                    {photoUploadMessage}
                                </p>
                            )}
                            {imageUrl && (
                                <img
                                    src={imageUrl}
                                    alt="Obyekt fotosi"
                                    className="mt-3 max-h-48 w-full rounded-xl border border-slate-800 object-cover"
                                />
                            )}
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                ССЫЛКА НА E-AUKSION / НЕОБЯЗАТЕЛЬНО
                            </label>
                            <input
                                type="url"
                                value={auksionUrl}
                                onChange={(e) => setAuksionUrl(e.target.value)}
                                placeholder="https://e-auksion.uz/..."
                                className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">ОТРАСЛЬ БИЗНЕСА</label>
                                <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer">
                                    <option value="Production">Sanoat (Производство)</option>
                                    <option value="Textile">To'qimachilik (Текстиль)</option>
                                    <option value="Agro">Qishloq xo'jaligi (Агро)</option>
                                    <option value="Logistics">Logistika (Транспорт)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">ТЕКУЩИЙ СТАТУС ЗЕМЛИ</label>
                                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer">
                                    <option value="Mavjud">Mavjud (Свободен)</option>
                                    <option value="E-auksion">E-auksion (На торгах)</option>
                                    <option value="Band">Band (Зарезервирован)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">ФОРМА СОБСТВЕННОСТИ</label>
                                <select value={ownershipType} onChange={(e) => setOwnershipType(e.target.value)} className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer">
                                    {OWNERSHIP_TYPE_OPTIONS.map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Obyekt turi</label>
                                <select value={propertyType} onChange={(e) => setPropertyType(normalizePropertyType(e.target.value))} className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer">
                                    {PROPERTY_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>

                        </div>

                        <div className="bg-[#040814] p-4 rounded-xl border border-slate-800 space-y-3">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Подключение коммуникаций:</h3>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <label className="block">
                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">🔥 Gaz</span>
                                    <select value={gas} onChange={(e) => setGas(e.target.value)} className="w-full bg-[#0b1329] border border-slate-800 rounded-lg p-2 text-white cursor-pointer">
                                        {BASIC_INFRA_OPTIONS.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">⚡ Elektr</span>
                                    <select value={power} onChange={(e) => setPower(e.target.value)} className="w-full bg-[#0b1329] border border-slate-800 rounded-lg p-2 text-white cursor-pointer">
                                        {BASIC_INFRA_OPTIONS.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">💧 Suv</span>
                                    <select value={water} onChange={(e) => setWater(e.target.value)} className="w-full bg-[#0b1329] border border-slate-800 rounded-lg p-2 text-white cursor-pointer">
                                        {BASIC_INFRA_OPTIONS.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">🛣 Yo‘l</span>
                                    <select value={road} onChange={(e) => setRoad(e.target.value)} className="w-full bg-[#0b1329] border border-slate-800 rounded-lg p-2 text-white cursor-pointer">
                                        {ROAD_INFRA_OPTIONS.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div className="p-3 bg-cyan-950/20 border border-cyan-900/40 rounded-xl flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-bold">ТОЧКА КЛИКА НА КАРТЕ:</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${markerCoords ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                                {markerCoords ? `📌 Снято: ${markerCoords[0].toFixed(4)}` : '❌ Не отмечено'}
                            </span>
                        </div>

                        {editingPlot ? (
                            <div className="grid grid-cols-2 gap-3">
                                <button type="submit" className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all">
                                    💾 Сохранить изменения
                                </button>
                                <button type="button" onClick={handleDeletePlot} className="w-full py-3 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all">
                                    Удалить объект
                                </button>
                            </div>
                        ) : (
                            <button type="submit" className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all">
                                💾 Создать и внедрить в общую базу
                            </button>
                        )}
                    </form>

                </div>
            </div>

            {/* СЕКЦИЯ С ИНТЕРАКТИВНОЙ КАРТОЙ СПРАВА */}
            <div className="flex-1 h-full relative bg-[#040814]">
                {isMounted && (
                    <MyInvestmentMap
                        key={`admin-map-${mapRefreshKey}`}
                        viewport={null}
                        selectedPlot={editingPlot}
                        onSelectPlot={handleSelectPlotForEdit}
                        lang={lang}
                        isAdminMode={true}
                        onMapClick={handleMapClick}
                        adminMarkerCoords={markerCoords}
                    />
                )}
            </div>
        </div>
    );
}
