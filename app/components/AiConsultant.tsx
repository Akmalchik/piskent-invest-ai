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
            const messageParts: any[] = [];
            const markerRegex = /\[RECOMMEND_ID:\s*([^\]\s]+)\]/g;
            let cursor = 0;
            for (const match of aiText.matchAll(markerRegex)) {
                const index = match.index ?? 0;
                if (index > cursor) messageParts.push({ type: 'text', text: aiText.slice(cursor, index) });
                const plot = plots.find((item: any) => String(item.id) === match[1]);
                if (plot) messageParts.push({ type: 'recommendation', plot });
                cursor = index + match[0].length;
            }
            if (cursor < aiText.length) messageParts.push({ type: 'text', text: aiText.slice(cursor) });
            aiText = aiText.replace(markerRegex, '').replace(/\*\*/g, '').trim();

            setIsTyping(false);
            setChatMessages([
                ...newMessages,
                {
                    sender: 'ai',
                    text: aiText,
                    recommendedPlots,
                    parts: messageParts,
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
            sync: "Obyektlar bazasi asosida tavsiya beradi",
            mapBtn: "Xaritada ko‘rsatish",
            pageBtn: "Auksion sahifasi",
            clear: "Tozalash",
            loading: "Mos obyektlar saralanmoqda...",
            starterTitle: "AI Investitsiya Maslahatchisi",
            starterIntro: "Piskent tumanidagi investitsiya obyektlarini bazadagi ma’lumotlar asosida tanlashga yordam beraman.",
            errorText: "AI Investitsiya Maslahatchisi vaqtincha mavjud emas. Investitsiya obyektlarini xarita orqali ko‘rishingiz mumkin."
        },
        ru: {
            title: "Цифровой инвестиционный консультант",
            sync: "Подбирает объекты на основе базы",
            mapBtn: "Показать на карте",
            pageBtn: "Страница аукциона",
            clear: "Очистить",
            loading: "Подбираются подходящие объекты...",
            starterTitle: "Цифровой инвестиционный консультант",
            starterIntro: "Помогу подобрать инвестиционные объекты Пискентского района на основе данных каталога.",
            errorText: "Цифровой инвестиционный консультант временно недоступен. Инвестиционные объекты можно посмотреть на карте."
        },
        en: {
            title: "Digital Investment Consultant",
            sync: "Recommends objects based on the database",
            mapBtn: "Show on map",
            pageBtn: "Auction Page",
            clear: "Clear",
            loading: "Selecting suitable objects...",
            starterTitle: "Digital Investment Consultant",
            starterIntro: "I can help select investment properties in Piskent district using the catalogue database.",
            errorText: "The Digital Investment Consultant is temporarily unavailable. Investment properties can be viewed on the map."
        },
        zh: {
            title: "数字投资顾问",
            sync: "基于数据库推荐项目",
            mapBtn: "在地图上显示",
            pageBtn: "拍卖官方页面",
            clear: "清空",
            loading: "正在筛选合适项目...",
            starterTitle: "数字投资顾问",
            starterIntro: "我可以根据项目数据库帮助筛选皮斯肯特区的投资项目。",
            errorText: "数字投资顾问暂时不可用。您仍然可以在投资地图上查看项目。"
        }
    };

    const labels = chatLabels[lang] || chatLabels['uz'];
    const isStarterScreen = chatMessages.length === 0;
    const starterPromptsByLang: Record<string, string[]> = {
        uz: [
            'Yer maydoni kerak',
            'Tayyor bino kerak',
            'Sanoat uchun obyekt',
            'Kichik biznes uchun joy'
        ],
        ru: [
            'Нужен земельный участок',
            'Нужно готовое здание',
            'Объект для производства',
            'Место для малого бизнеса'
        ],
        en: [
            'I need a land plot',
            'I need a ready building',
            'Property for manufacturing',
            'Location for a small business'
        ],
        zh: [
            '需要土地',
            '需要现成建筑',
            '工业生产项目',
            '小型企业场所'
        ],
    };
    const starterPrompts = starterPromptsByLang[lang] || starterPromptsByLang.uz;

    if (!isChatLayout) return null;

    return (
        <div className="flex flex-col h-full bg-[#070d18] rounded-xl border border-slate-700/60 overflow-hidden relative min-h-[400px] shadow-lg shadow-black/20">
            <div className="p-4 bg-[#0a1324] border-b border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-cyan-950 border border-cyan-700/50 rounded-lg flex items-center justify-center relative">
                        <span className="grid h-4 w-4 grid-cols-2 gap-0.5" aria-hidden="true">
                            <span className="rounded-[2px] bg-cyan-300/90" />
                            <span className="rounded-[2px] bg-cyan-300/45" />
                            <span className="rounded-[2px] bg-cyan-300/45" />
                            <span className="rounded-[2px] bg-cyan-300/90" />
                        </span>
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
                        {labels.clear}
                    </button>
                )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#070d18]">
                {isStarterScreen ? (
                    <div className="text-center my-auto flex flex-col items-center justify-center h-full py-6 animate-fade-in px-4">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-700/40 bg-cyan-950/40 shadow-inner shadow-cyan-300/5">
                            <span className="grid h-5 w-5 grid-cols-2 gap-0.5" aria-hidden="true">
                                <span className="rounded-[2px] bg-cyan-300/90" />
                                <span className="rounded-[2px] bg-cyan-300/40" />
                                <span className="rounded-[2px] bg-cyan-300/40" />
                                <span className="rounded-[2px] bg-cyan-300/90" />
                            </span>
                        </div>
                        <h4 className="mb-2 text-sm font-bold tracking-wide text-white">{labels.starterTitle}</h4>
                        <p className="mb-6 max-w-sm text-[11px] leading-5 text-slate-400">
                            {labels.starterIntro}
                        </p>

                        <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                            {starterPrompts.map((prompt, index) => (
                                <button key={prompt} onClick={() => handleSendMessage(prompt)} className="group flex min-h-11 items-center gap-3 rounded-lg border border-slate-700/60 bg-[#0a1324] p-3 text-left text-[11px] font-medium text-slate-300 transition-colors hover:border-cyan-700/50 hover:bg-[#0d182b] hover:text-slate-100">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-cyan-800/50 bg-cyan-950/40 text-[8px] font-bold text-cyan-400">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <span className="leading-4">{prompt}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    chatMessages.map((msg, idx) => (
                        <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                            <div className={`max-w-[88%] p-3.5 rounded-xl text-xs leading-6 ${msg.sender === 'user'
                                ? 'bg-cyan-800 text-white rounded-tr-sm border border-cyan-700'
                                : 'bg-[#0a1324] border border-slate-700/60 text-slate-200 rounded-tl-sm relative'
                                }`}>
                                {msg.sender === 'ai' && msg.parts?.length > 0 ? (
                                    <div className="space-y-1">
                                        {msg.parts.map((part: any, partIndex: number) => part.type === 'text' ? (
                                            <div key={`text-${partIndex}`} className="whitespace-pre-wrap py-0.5">{part.text.replace(/\*\*/g, '')}</div>
                                        ) : (
                                            <div key={`plot-${part.plot.id}-${partIndex}`} className="my-3 flex flex-col gap-2 rounded-r-lg border-l-2 border-cyan-700/60 bg-cyan-950/10 py-1.5 pl-3 pr-1 sm:flex-row sm:items-center">
                                                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-300" title={part.plot.name}>
                                                    {part.plot.name}
                                                </span>
                                                <button onClick={() => onSelectPlot(part.plot)} className="px-3.5 py-2 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5">
                                                    <span>{labels.mapBtn}</span> 📍
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap">{msg.text}</div>
                                )}
                            </div>
                        </div>
                    ))
                )}
                {isTyping && (
                    <div className="flex justify-start animate-fade-in">
                        <div className="flex items-center gap-3 rounded-xl rounded-tl-sm border border-slate-700/60 bg-[#0a1324] px-4 py-3">
                            <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '250ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '500ms' }}></span>
                            </div>
                            <span className="text-[10px] font-medium text-slate-400">{labels.loading}</span>
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
