'use client';
/// <reference types="react" />
import React, { useState, useEffect, type FormEvent } from 'react';
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
const BASIC_INFRA_OPTIONS = ['Mavjud', 'Mavjud emas', 'Aniqlanmoqda'];
const ROAD_INFRA_OPTIONS = ['Asfalt', 'Shag‘al', 'Tuproq yo‘l', 'Aniqlanmoqda'];
const normalizeInfraOption = (value: unknown, options: string[]) => {
    const normalizedValue = String(value || '').trim();
    return options.includes(normalizedValue) ? normalizedValue : 'Aniqlanmoqda';
};
const DISTRICT_PROFILE_DEFAULTS = {
    district_name: '',
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
    investment_department_name: '',
    investment_head_name: '',
    investment_phone: '',
    investment_phone2: '',
};
const DISTRICT_PROFILE_FIELDS = [
    ['district_name', 'Название района'],
    ['hero_image', 'Hero image URL'],
    ['population', 'Население'],
    ['working_population', 'Трудоспособное население'],
    ['mahallas', 'Количество махаллей'],
    ['area_km2', 'Площадь, км²'],
    ['electricity_percent', 'Электричество, %'],
    ['gas_percent', 'Газ, %'],
    ['water_percent', 'Вода, %'],
    ['roads_percent', 'Дороги, %'],
    ['mayor_name', 'ФИО хокима'],
    ['mayor_photo', 'Фото хокима URL'],
    ['deputy_name', 'ФИО заместителя'],
    ['deputy_photo', 'Фото заместителя URL'],
    ['investment_department_name', 'Название отдела инвестиций'],
    ['investment_head_name', 'Руководитель отдела инвестиций'],
    ['investment_phone', 'Телефон'],
    ['investment_phone2', 'Телефон 2'],
];
const DISTRICT_DESCRIPTION_FIELDS = [
    ['description_uz', 'Описание UZ'],
    ['description_ru', 'Описание RU'],
    ['description_en', 'Описание EN'],
    ['description_zh', 'Описание ZH'],
];

export default function AdminPage() {
    // Внутренняя языковая переменная проекта
    const lang = 'uz';
    const [inputPassword, setInputPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [adminSection, setAdminSection] = useState<'plots' | 'profile'>('plots');
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
    const [industry, setIndustry] = useState('Sanoat / Ishlab chiqarish');
    const [status, setStatus] = useState('Mavjud');
    const [ownershipType, setOwnershipType] = useState(OWNERSHIP_TYPE_OPTIONS[0]);
    const [auksionUrl, setAuksionUrl] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    // Поля инфраструктуры лота
    const [gas, setGas] = useState('Mavjud');
    const [power, setPower] = useState('Mavjud');
    const [water, setWater] = useState('Mavjud');
    const [road, setRoad] = useState('Asfalt');

    // Стейты для хранения координат клика и показа успешного баннера
    const [markerCoords, setMarkerCoords] = useState<[number, number] | null>(null);
    const [successMessage, setSuccessMessage] = useState(false);
    const [districtProfile, setDistrictProfile] = useState<Record<string, any>>(DISTRICT_PROFILE_DEFAULTS);

    const resetForm = () => {
        setName('');
        setArea('');
        setIndustry('Sanoat / Ishlab chiqarish');
        setStatus('Mavjud');
        setOwnershipType(OWNERSHIP_TYPE_OPTIONS[0]);
        setAuksionUrl('');
        setImageUrl('');
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

    useEffect(() => {
        if (!isAuthenticated) return;

        fetch('/api/district-profile')
            .then(res => {
                if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
                return res.json();
            })
            .then(data => setDistrictProfile({ ...DISTRICT_PROFILE_DEFAULTS, ...(data || {}) }))
            .catch(err => {
                console.error('Ошибка загрузки паспорта района:', err);
                setDistrictProfile(DISTRICT_PROFILE_DEFAULTS);
            });
    }, [isAuthenticated]);

    // Функция срабатывает, когда пользователь производит клик по Leaflet-карте справа
    const handleMapClick = (lat: number, lng: number) => {
        setMarkerCoords([lat, lng]);
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
        setImageUrl(plot.image || plot.image_url || plot.photo_url || '');
        setAuksionUrl(plot.auksionUrl || plot.auksion_url || plot.auction_url || '');
        setIndustry(plot.industry || 'Production');
        setStatus(plot.status || 'Mavjud');
        setOwnershipType(plot.ownership_type || OWNERSHIP_TYPE_OPTIONS[0]);
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
                industry,
                status,
                ownership_type: ownershipType,
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
            industry,
            status,
            ownership_type: ownershipType,
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
                setName(''); setArea(''); setImageUrl('');
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

    const handleDistrictProfileChange = (field: string, value: string) => {
        setDistrictProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveDistrictProfile = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const res = await fetch('/api/district-profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(districtProfile)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Код ответа сервера: ${res.status}`);
            }

            const data = await res.json();
            if (data.success) {
                setDistrictProfile({ ...DISTRICT_PROFILE_DEFAULTS, ...(data.profile || {}) });
                setSuccessMessage(true);
                setTimeout(() => setSuccessMessage(false), 4000);
            }
        } catch (err: any) {
            alert(`Ошибка при сохранении паспорта района: ${err.message}`);
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



                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <button type="button" onClick={() => setAdminSection('plots')} className={`py-2 rounded-xl text-xs font-bold border transition-all ${adminSection === 'plots' ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/30' : 'bg-[#040814] text-slate-400 border-slate-800'}`}>
                            Объекты
                        </button>
                        <button type="button" onClick={() => setAdminSection('profile')} className={`py-2 rounded-xl text-xs font-bold border transition-all ${adminSection === 'profile' ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/30' : 'bg-[#040814] text-slate-400 border-slate-800'}`}>
                            Паспорт района
                        </button>
                    </div>

                    {/* ФОРМА ИНСТРУМЕНТА №2 */}
                    <form onSubmit={handleSavePlot} className={`${adminSection === 'plots' ? 'block' : 'hidden'} space-y-4 mt-4`}>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">НАЗВАНИЕ ОБЪЕКТА / ЛОТА</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Новая текстильная фабрика" className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">ПЛОЩАДЬ (В ГЕКТАРАХ)</label>
                                <input type="number" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} placeholder="4.5" className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
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
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Тип объекта</label>
                                <select value={ownershipType} onChange={(e) => setOwnershipType(e.target.value)} className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer">
                                    {OWNERSHIP_TYPE_OPTIONS.map((type) => (
                                        <option key={type} value={type}>{type}</option>
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

                    <form onSubmit={handleSaveDistrictProfile} className={`${adminSection === 'profile' ? 'block' : 'hidden'} space-y-4 mt-4`}>
                        <div className="p-4 bg-[#040814] rounded-xl border border-slate-800">
                            <h2 className="text-sm font-black text-white mb-1">Паспорт района</h2>
                            <p className="text-[11px] text-slate-500">Данные для публичного раздела “О районе”.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {DISTRICT_DESCRIPTION_FIELDS.map(([field, label]) => (
                                <label key={field} className="block">
                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">{label}</span>
                                    <textarea
                                        value={districtProfile[field] || ''}
                                        onChange={(e) => handleDistrictProfileChange(field, e.target.value)}
                                        rows={5}
                                        className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                                    />
                                </label>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {DISTRICT_PROFILE_FIELDS.map(([field, label]) => (
                                <label key={field} className="block">
                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">{label}</span>
                                    <input
                                        type={String(field).includes('percent') || ['population', 'working_population', 'mahallas', 'area_km2'].includes(String(field)) ? 'number' : String(field).includes('image') || String(field).includes('photo') ? 'url' : 'text'}
                                        value={districtProfile[field] || ''}
                                        onChange={(e) => handleDistrictProfileChange(field, e.target.value)}
                                        className="w-full bg-[#040814] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                                    />
                                </label>
                            ))}
                        </div>

                        <button type="submit" className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all">
                            💾 Сохранить паспорт района
                        </button>
                    </form>
                </div>
            </div>

            {/* СЕКЦИЯ С ИНТЕРАКТИВНОЙ КАРТОЙ СПРАВА */}
            <div className="flex-1 h-full relative bg-[#040814]">
                {adminSection === 'profile' ? (
                    <div className="h-full p-6 overflow-y-auto">
                        <div className="h-full rounded-xl border border-slate-800 bg-[#0b1329] p-6 flex flex-col justify-center">
                            <span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-2">Публичный раздел</span>
                            <h2 className="text-2xl font-black text-white mb-3">{districtProfile.district_name || 'Piskent tumani'}</h2>
                            <p className="text-sm text-slate-400 leading-7">{districtProfile.description_uz || districtProfile.description || 'Описание района появится здесь после сохранения.'}</p>
                        </div>
                    </div>
                ) : isMounted && (
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
