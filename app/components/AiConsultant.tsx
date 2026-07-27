'use client';

import React, { useState, useEffect, useRef } from 'react';
import { translations } from './translations';

export default function AiConsultant({ onSelectPlot, lang = 'uz', isChatLayout = false }: any) {
    const t = (translations as any)[lang] || translations['uz'];

    const [chatInput, setChatInput] = useState("");
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [plots, setPlots] = useState<any[]>([]);
    const [isTyping, setIsTyping] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages, isTyping]);

    useEffect(() => {
        setChatMessages([]);
        setChatInput("");
        setIsTyping(false);
    }, [lang]);

    // Загружаем те же нормализованные данные, что использует карта
    useEffect(() => {
        if (!isChatLayout) return;

        fetch('/api/save-plots')
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('No plots data');
            })
            .then(apiPlots => {
                if (Array.isArray(apiPlots) && apiPlots.length > 0) {
                    setPlots(apiPlots);
                } else {
                    setPlots([]);
                }
            })
            .catch(() => {
                setPlots([]);
            });
    }, [isChatLayout]);

    const handleSendMessage = async (textToSend?: string) => {
        const messageText = textToSend || chatInput;
        if (!messageText.trim()) return;

        const newMessages = [...chatMessages, { sender: 'user', text: messageText }];
        setChatMessages(newMessages);
        setChatInput("");
        setIsTyping(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: messageText, plots, lang }),
            });

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const data = await response.json();
            let aiText = data.text || '';
            if (!aiText) throw new Error('Empty response');

            const recommendedIds = Array.from(
                new Set([...aiText.matchAll(/\[RECOMMEND_ID:\s*([^\]\s]+)\]/g)].map(match => match[1]))
            );
            const recommendedPlots = recommendedIds
                .map(id => plots.find((plot: any) => String(plot.id) === id))
                .filter(Boolean);
            aiText = aiText.replace(/\[RECOMMEND_ID:\s*[^\]\s]+\]/g, '').trim();

            setIsTyping(false);
            setChatMessages([
                ...newMessages,
                {
                    sender: 'ai',
                    text: aiText,
                    recommendedPlots,
                },
            ]);
        } catch (error) {
            console.error('AI chat request failed:', error);
            setIsTyping(false);
            setChatMessages([
                ...newMessages,
                {
                    sender: 'ai',
                    text: labels.errorText,
                }
            ]);
        }
    };

    const resetChat = () => {
        setChatMessages([]);
    };

    const chatLabels: Record<string, any> = {
        uz: {
            title: "AI Investitsiya Maslahatchisi",
            sync: "E-Auksion Sync Active",
            mapBtn: "Xaritada ko‘rsatish",
            pageBtn: "Auksion sahifasi",
            starterTitle: "AI Investitsiya Maslahatchisi",
            starterIntro: "Piskent tumanidagi investitsiya obyektlari bo‘yicha savol bering.",
            errorText: "AI Investitsiya Maslahatchisi vaqtincha mavjud emas. Investitsiya obyektlarini xarita orqali ko‘rishingiz mumkin."
        },
        ru: {
            title: "Цифровой инвестиционный консультант",
            sync: "Синхронизация с E-Auksion Активна",
            mapBtn: "Показать на карте",
            pageBtn: "Страница аукциона",
            starterTitle: "Цифровой инвестиционный консультант",
            starterIntro: "Предоставляет официальную информацию и рекомендации по инвестиционным объектам Пискентского района.",
            errorText: "Цифровой инвестиционный консультант временно недоступен. Инвестиционные объекты можно посмотреть на карте."
        },
        en: {
            title: "Digital Investment Consultant",
            sync: "E-Auksion Sync Active",
            mapBtn: "Show on map",
            pageBtn: "Auction Page",
            starterTitle: "Digital Investment Consultant",
            starterIntro: "Provides official information and recommendations on investment properties in Piskent district.",
            errorText: "The Digital Investment Consultant is temporarily unavailable. Investment properties can be viewed on the map."
        },
        zh: {
            title: "数字投资顾问",
            sync: "电子拍卖数据同步激活",
            mapBtn: "在地图上显示",
            pageBtn: "拍卖官方页面",
            starterTitle: "数字投资顾问",
            starterIntro: "提供皮斯肯特区投资项目的官方信息和建议。",
            errorText: "数字投资顾问暂时不可用。您仍然可以在投资地图上查看项目。"
        }
    };

    const labels = chatLabels[lang] || chatLabels['uz'];
    const isStarterScreen = chatMessages.length === 0;
    const starterPromptsByLang: Record<string, string[]> = {
        uz: [
            '🏭 Sanoat uchun obyekt',
            '🏨 Turizm uchun obyekt',
            '💼 Kichik biznes uchun obyekt',
            '🏢 Bino va yer maydoni',
            '⚡ Gaz va elektr mavjud obyektlar'
        ],
        ru: [
            '🏭 Объект под производство',
            '🏨 Объект под туризм',
            '💼 Объект для малого бизнеса',
            '🏢 Здание с участком',
            '⚡ Объекты с газом и электричеством'
        ],
        en: [
            '🏭 Land area for an industrial project',
            '🏨 Location for hotel construction',
            '🚛 Property for logistics',
            '⚡ Properties with gas and electricity'
        ],
        zh: [
            '🏭 工业项目用地',
            '🏨 酒店建设选址',
            '🚛 物流用途项目',
            '⚡ 具备天然气和电力的项目'
        ],
    };
    const starterPrompts = starterPromptsByLang[lang] || starterPromptsByLang.uz;

    if (!isChatLayout) return null;

    return (
        <div className="flex flex-col h-full bg-[#070d18] rounded-xl border border-slate-700/60 overflow-hidden relative min-h-[400px] shadow-lg shadow-black/20">
            <div className="p-4 bg-[#0a1324] border-b border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-cyan-950 text-cyan-300 border border-cyan-700/50 rounded-lg flex items-center justify-center font-bold relative">
                        🤖
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0b1329] rounded-full"></span>
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-white tracking-wide">{labels.title}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-emerald-400 font-medium">{labels.sync}</span>
                        </div>
                    </div>
                </div>
                {chatMessages.length > 0 && (
                    <button onClick={resetChat} className="text-[10px] font-semibold text-slate-400 hover:text-slate-100 transition-colors bg-slate-900/60 px-2.5 py-1 rounded-md border border-slate-700/70">
                        {lang === 'ru' ? 'Очистить' : lang === 'zh' ? '清空' : 'Tozalash'}
                    </button>
                )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#070d18]">
                {isStarterScreen ? (
                    <div className="text-center my-auto flex flex-col items-center justify-center h-full pt-4 animate-fade-in px-4">
                        <div className="w-12 h-12 bg-cyan-950/50 text-cyan-300 border border-cyan-700/40 rounded-xl flex items-center justify-center text-xl mb-4">🤖</div>
                        <h4 className="text-sm font-bold text-white mb-2 tracking-wide">{labels.starterTitle}</h4>
                        <p className="text-[11px] text-slate-400 max-w-xs mb-6 leading-relaxed">
                            {labels.starterIntro}
                        </p>

                        <div className="flex flex-col gap-2 w-full max-w-sm">
                            {starterPrompts.map((prompt) => (
                                <button key={prompt} onClick={() => handleSendMessage(prompt)} className="p-3 bg-[#0a1324] hover:bg-[#0d182b] border border-slate-700/60 rounded-lg text-left text-[11px] font-medium text-slate-300 transition-colors flex items-center gap-2">
                                    <span>{prompt}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    chatMessages.map((msg, idx) => (
                        <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                            <div className={`max-w-[85%] p-3.5 rounded-xl text-xs leading-relaxed ${msg.sender === 'user'
                                ? 'bg-cyan-800 text-white rounded-tr-sm border border-cyan-700'
                                : 'bg-[#0a1324] border border-slate-700/60 text-slate-200 rounded-tl-sm relative'
                                }`}>
                                <div className="whitespace-pre-line">{msg.text}</div>
                                {msg.sender === 'ai' && msg.recommendedPlots?.length > 0 && (
                                    <div className="mt-3.5 pt-3 border-t border-slate-800/60 space-y-2">
                                        {msg.recommendedPlots.map((plot: any) => (
                                            <div key={plot.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                {plot.name && (
                                                    <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-300" title={plot.name}>
                                                        {plot.name}
                                                    </span>
                                                )}
                                                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                                                    {plot.auksionUrl && (
                                                        <a href={plot.auksionUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5">
                                                            <span>{labels.pageBtn}</span> 🌐
                                                        </a>
                                                    )}
                                                    <button onClick={() => onSelectPlot(plot)} className="px-3.5 py-2 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5">
                                                        <span>{labels.mapBtn}</span> 📍
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
                {isTyping && (
                    <div className="flex justify-start animate-fade-in">
                        <div className="bg-[#0b1329]/80 border border-slate-800/60 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-[#0a1324] border-t border-slate-700/60 flex gap-2">
                <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={t.inputPlaceholder}
                    className="flex-1 bg-[#060c18] border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-600 transition-colors"
                />
                <button onClick={() => handleSendMessage()} className="px-4 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-xs font-bold text-white transition-colors active:scale-95">
                    {t.sendBtn}
                </button>
            </div>
        </div>
    );
}
