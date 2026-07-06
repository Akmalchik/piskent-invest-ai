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
    const [industry, setIndustry] = useState('Sanoat / Ishlab chiqarish');
    const [status, setStatus] = useState('Mavjud');
    const [auksionUrl, setAuksionUrl] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    // Поля инфраструктуры лота
    const [gas, setGas] = useState('Mavjud');
    const [power, setPower] = useState('100 кВт');
    const [water, setWater] = useState('Mavjud');
    const [road, setRoad] = useState('Asfalt');

    // Стейты для хранения координат клика и показа успешного баннера
    const [markerCoords, setMarkerCoords] = useState<[number, number] | null>(null);
    const [successMessage, setSuccessMessage] = useState(false);

    const resetForm = () => {
        setName('');
        setArea('');
        setIndustry('Sanoat / Ishlab chiqarish');
        setStatus('Mavjud');
        setAuksionUrl('');
        setImageUrl('');
        setGas('Mavjud');
        setPower('100 кВт');
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
        setGas(infrastructure.gas || 'Mavjud');
        setPower(infrastructure.power || infrastructure.electricity || '100 кВт');
        setWater(infrastructure.water || 'Mavjud');
        setRoad(infrastructure.road || 'Asfalt');

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

                        </div>

                        <div className="bg-[#040814] p-4 rounded-xl border border-slate-800 space-y-3">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Подключение коммуникаций:</h3>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <label className="block">
                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">🔥 Gaz</span>
                                    <input type="text" value={gas} onChange={(e) => setGas(e.target.value)} placeholder="Masalan: Mavjud / Yo‘q / 50 metr" className="w-full bg-[#0b1329] border border-slate-800 rounded-lg p-2 text-white" />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">⚡ Elektr</span>
                                    <input type="text" value={power} onChange={(e) => setPower(e.target.value)} placeholder="Masalan: 100 kVt / 500 kVt / Yo‘q" className="w-full bg-[#0b1329] border border-slate-800 rounded-lg p-2 text-white" />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">💧 Suv</span>
                                    <input type="text" value={water} onChange={(e) => setWater(e.target.value)} placeholder="Masalan: Mavjud / Quduq / Yo‘q" className="w-full bg-[#0b1329] border border-slate-800 rounded-lg p-2 text-white" />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">🛣 Yo‘l</span>
                                    <input type="text" value={road} onChange={(e) => setRoad(e.target.value)} placeholder="Masalan: Asfalt / Shag‘al / Tuproq" className="w-full bg-[#0b1329] border border-slate-800 rounded-lg p-2 text-white" />
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
