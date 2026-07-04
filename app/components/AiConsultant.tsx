'use client';

import React, { useState, useEffect, useRef } from 'react';
import { translations } from './translations';

export default function AiConsultant({ onSelectPlot, lang = 'uz', isChatLayout = false }: any) {
    // Явно указываем тип ключа для объекта переводов
    const t = (translations as any)[lang] || translations['uz'];
    // Твой бесплатный API Ключ от Google AI Studio (Вставь сюда свой рабочий токен AIzaSy...)
    const GEMINI_API_KEY = "";

    const [industry, setIndustry] = useState("Production");
    const [results, setResults] = useState<any[]>([]);

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

    // Загружаем данные из public/scraped_plots.json
    useEffect(() => {
        fetch('/scraped_plots.json')
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('No scraped data');
            })
            .then(scrapedData => {
                if (scrapedData && scrapedData.length > 0) {
                    setPlots(scrapedData);
                } else {
                    loadFallbackPlots();
                }
            })
            .catch(() => {
                loadFallbackPlots();
            });

        function loadFallbackPlots() {
            setPlots([]); // Принудительно очищаем список
        }
    }, [lang]);

    const handleAiSearch = () => {
        const found = plots.filter(plot => !industry || plot.industry === industry);
        setResults(found);
    };

    const handleSendMessage = async (textToSend?: string) => {
        const messageText = textToSend || chatInput;
        if (!messageText.trim()) return;

        const newMessages = [...chatMessages, { sender: 'user', text: messageText }];
        setChatMessages(newMessages);
        setChatInput("");
        setIsTyping(true);

        const textLower = messageText.toLowerCase().trim();

        const isGibberish = textLower.length < 3 || (/^[asdfghjklqwertyuiopzxcvbnmйцукенгшщзхъфывапролджэячсмитьбю]+$/.test(textLower) &&
            !textLower.includes('agro') && !textLower.includes('textil') && !textLower.includes('lot') && !textLower.includes('yer') && !textLower.includes('цех'));

        let matchedPlot = null;
        let isGeneralGreeting = false;

        if (textLower === 'привет' || textLower === 'hello' || textLower === 'salom' || textLower === 'assalomu alaykum' || textLower.includes('你好')) {
            isGeneralGreeting = true;
        }

        if (textLower.includes('textil') || textLower.includes('текстиль') || textLower.includes('цех') || textLower.includes('🧵') || textLower.includes('纺织')) {
            matchedPlot = plots.find(p => p.industry === 'Textile' || p.name.toLowerCase().includes('textil'));
        } else if (textLower.includes('sanoat') || textLower.includes('производство') || textLower.includes('завод') || textLower.includes('🏭') || textLower.includes('пром') || textLower.includes('工业')) {
            matchedPlot = plots.find(p => p.industry === 'Production' || p.name.toLowerCase().includes('sanoat'));
        } else if (textLower.includes('agro') || textLower.includes('агро') || textLower.includes('🌾') || textLower.includes('qishloq') || textLower.includes('农业')) {
            matchedPlot = plots.find(p => p.industry === 'Agro' || p.name.toLowerCase().includes('agro'));
        }

        const isContextRequest = textLower.includes('infratuzilma') || textLower.includes('kommunikatsiya') || textLower.includes('⚡') ||
            textLower.includes('инфраструктур') || textLower.includes('коммуникац') || textLower.includes('基础') || textLower.includes('设施') ||
            textLower.includes('ish') || textLower.includes('orin') || textLower.includes('💼') ||
            textLower.includes('рабоч') || textLower.includes('мест') || textLower.includes('就业') || textLower.includes('岗位');

        if (!matchedPlot && !isContextRequest && !isGibberish && !isGeneralGreeting && textToSend && plots.length > 0) {
            matchedPlot = plots[0];
        }

        const systemInstruction = `
            Ты — официальный ИИ-помощник Хокимията Пискентского района Ташкентской области (Piskent District / Piskent Invest AI).
            Выбранный язык ответа инвестору: "${lang}". Отвечай строго на этом языке!
            
            ПРАВИЛА:
            1. Используй только этот реальный список свободных земель: ${JSON.stringify(plots, null, 2)}
            2. Если пользователь пишет бред (например: "тшьф"), случайные буквы или нерелевантный текст, вежливо скажи на языке "${lang}", что ты ИИ-консультант Хокимията, не понял фразу, и попроси выбрать сферу (производство, текстиль, агро). Не выдумывай лоты!
            3. Если ты рекомендуешь конкретный лот, обязательно добавь в самый конец своего ответа этот скрытый тег: "[RECOMMEND_ID: номер_id]".
        `;

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

            let finalPlot = null;
            const match = aiText.match(/\[RECOMMEND_ID:\s*(\d+)\]/);
            if (match) {
                const recommendedId = parseInt(match[1]);
                finalPlot = plots.find((p: any) => p.id === recommendedId);
                aiText = aiText.replace(/\[RECOMMEND_ID:\s*\d+\]/, '').trim();
            }

            setIsTyping(false);
            setChatMessages([
                ...newMessages,
                {
                    sender: 'ai',
                    text: aiText,
                    recommendedPlot: finalPlot || (textToSend ? plots[0] : null),
                    suggestions:
                        lang === 'ru' ? ['⚡ Инфраструктура', '💼 Рабочие места'] :
                            lang === 'zh' ? ['⚡ 基础设施', '💼 创造就业'] :
                                lang === 'en' ? ['⚡ Infrastructure', '💼 Jobs Created'] :
                                    ['⚡ Infratuzilma', '💼 Ish o\'rinlari'],
                },
            ]);

        }
        catch (error: any) {
            console.log("Gemini API Offline, запуск локального предохранителя.");

            let backupText = "";
            let nextSuggestions: string[] = [];
            let includeButtons = false;


            if (lang === 'ru') {
                if (isGibberish || (!matchedPlot && !isContextRequest && !isGeneralGreeting)) {
                    backupText = "Я не смог распознать ваш запрос. Пожалуйста, укажите сферу вашего инвест-проекта (например: Производство, Текстиль, Агро) или используйте готовые кнопки ниже.";
                    nextSuggestions = ["🏭 Промышленные зоны", "🧵 Текстильные лоты"];
                } else if (isGeneralGreeting) {
                    backupText = "Здравствуйте! Я официальный ИИ-консультант Хокимията Пискентского района. Какое направление бизнеса вас интересует?";
                    nextSuggestions = ["🏭 Промышленные зоны", "🧵 Текстильные лоты"];
                } else if (textLower.includes('инфраструктур') || textLower.includes('коммуникац') || textLower.includes('⚡')) {
                    const currentPlot = matchedPlot || plots[0];
                    backupText = `Инфраструктура лота «${currentPlot.name}»:\n• Газ: ${currentPlot.infrastructure.gas}\n• Энергосеть: ${currentPlot.infrastructure.power}\n• Водоснабжение: ${currentPlot.infrastructure.water}\n• Дорога: ${currentPlot.infrastructure.road}.`;
                    nextSuggestions = ["💼 Создание рабочих мест", "🔄 Сбросить чат"];
                } else if (textLower.includes('рабоч') || textLower.includes('мест') || textLower.includes('💼')) {
                    const currentPlot = matchedPlot || plots[0];
                    backupText = `Запуск производства на данном участке позволит развернуть проект и создать порядка ${currentPlot.jobs} новых рабочих мест в Пискенте.`;
                    nextSuggestions = ["⚡ Инфраструктура лота", "🔄 Сбросить чат"];
                } else {
                    const currentPlot = matchedPlot || plots[0];
                    backupText = `Приветствую инвестора! В нашей базе e-auksion обнаружен лот: «${currentPlot.name}» (Площадь: ${currentPlot.area} га). Вы можете изучить его параметры инфраструктуры или открыть карту.`;
                    nextSuggestions = ["⚡ Инфраструктура лота", "💼 Создание рабочих мест"];
                    includeButtons = true;
                }
            } else if (lang === 'zh') {
                if (isGibberish || (!matchedPlot && !isContextRequest && !isGeneralGreeting)) {
                    backupText = "抱歉，我无法识别您的请求。请说明您的投资项目领域（例如：工业、纺织、农业），或使用下方的快捷按钮。";
                    nextSuggestions = ["🏭 工业园区", "🧵 纺织土地"];
                } else if (isGeneralGreeting) {
                    backupText = "您好！我是 Piskent 区政府的官方投资 AI 顾问。请问您对哪个商业方向（工业、纺织或农业）感兴趣？";
                    nextSuggestions = ["🏭 工业园区", "🧵 纺织土地"];
                } else if (textLower.includes('infratuzilma') || textLower.includes('kommunikatsiya') || textLower.includes('⚡') || textLower.includes('基础') || textLower.includes('设施')) {
                    const currentPlot = matchedPlot || plots[0];
                    backupText = `“${currentPlot.name}” 土地的基础设施状况：\n• 天然气: ${currentPlot.infrastructure.gas}\n• 电力供应: ${currentPlot.infrastructure.power}\n• 供水系统: ${currentPlot.infrastructure.water}\n• 道路交通: ${currentPlot.infrastructure.road}。`;
                    nextSuggestions = ["💼 创造就业机会", "🔄 清空聊天"];
                } else if (textLower.includes('ish') || textLower.includes('orin') || textLower.includes('💼') || textLower.includes('就业') || textLower.includes('岗位')) {
                    const currentPlot = matchedPlot || plots[0];
                    backupText = `在该投资土地 “${currentPlot.name}” 上启动生产，将为 Piskent 地区居民创造约 ${currentPlot.jobs} 个全新的固定就业岗位。`;
                    nextSuggestions = ["⚡ 基础设施指标", "🔄 清空聊天"];
                } else {
                    const currentPlot = matchedPlot || plots[0];
                    backupText = `您好！Piskent 投资 AI 系统已成功为您筛选出符合条件的政府投资土地：“${currentPlot.name}”（面积: ${currentPlot.area} 公顷）。您可以通过下方按钮检查基础设施 or 打开地图查看。`;
                    nextSuggestions = ["⚡ 基础设施指标", "💼 创造就业机会"];
                    includeButtons = true;
                }
            } else if (lang === 'en') {
                if (isGibberish || (!matchedPlot && !isContextRequest && !isGeneralGreeting)) {
                    backupText = "Sorry, I could not understand your request. Please specify the branch of your investment project (e.g., Industry, Textile, Agro) or use the quick buttons below.";
                    nextSuggestions = ["🏭 Industrial Zones", "🧵 Textile Plots"];
                } else if (isGeneralGreeting) {
                    backupText = "Hello! I am the official AI Investment Consultant of the Piskent District Khokimiyat. Which business sector are you interested in?";
                    nextSuggestions = ["🏭 Industrial Zones", "🧵 Textile Plots"];
                } else if (textLower.includes('infratuzilma') || textLower.includes('kommunikatsiya') || textLower.includes('⚡') || textLower.includes('infrastructure')) {
                    const currentPlot = matchedPlot || plots[0];
                    backupText = `Infrastructure status for plot "${currentPlot.name}":\n• Gas: ${currentPlot.infrastructure.gas}\n• Power Grid: ${currentPlot.infrastructure.power}\n• Water Supply: ${currentPlot.infrastructure.water}\n• Roads: ${currentPlot.infrastructure.road}.`;
                    nextSuggestions = ["💼 Jobs Created", "🔄 Reset Chat"];
                } else if (textLower.includes('ish') || textLower.includes('orin') || textLower.includes('💼') || textLower.includes('jobs')) {
                    const currentPlot = matchedPlot || plots[0];
                    backupText = `Launching production on this investment plot "${currentPlot.name}" will create approximately ${currentPlot.jobs} new permanent jobs for the population of Piskent district.`;
                    nextSuggestions = ["⚡ Infrastructure Specs", "🔄 Reset Chat"];
                } else {
                    const currentPlot = matchedPlot || plots[0];
                    backupText = `Hello! Piskent Invest AI system found a matching government plot for your project: "${currentPlot.name}" (Area: ${currentPlot.area} ha). Check the infrastructure specs using the buttons below.`;
                    nextSuggestions = ["⚡ Infrastructure Specs", "💼 Jobs Created"];
                    includeButtons = true;
                }
            } else {
                if (isGibberish || (!matchedPlot && !isContextRequest && !isGeneralGreeting)) {
                    backupText = "Kechirasiz, so'rovingizni tushuna olmadim. Iltimos, investitsiya loyihangiz yo'nalishini ko'rsating (Sanoat, Tekstil, Agro) yoki quyidagi tayyor tugmalardan foydalaning.";
                    nextSuggestions = ["🏭 Sanoat zonalari", "🧵 To'qimachilik lotlari"];
                } else if (isGeneralGreeting) {
                    backupText = "Assalomu alaykum! Men Piskent tumani hokimligining investitsiyalar bo'yicha rasmiy AI-maslahatchisiman. Sizni qaysi soha qiziqtirmoqda?";
                    nextSuggestions = ["🏭 Sanoat zonalari", "🧵 To'qimachilik lotlari"];
                } else if (textLower.includes('infratuzilma') || textLower.includes('kommunikatsiya') || textLower.includes('⚡')) {
                    const currentPlot = matchedPlot || plots[0];
                    backupText = `"${currentPlot.name}" lotining infratuzilma holati:\n• Gaz ta'minoti: ${currentPlot.infrastructure.gas}\n• Elektr quvvati: ${currentPlot.infrastructure.power}\n• Suv: ${currentPlot.infrastructure.water}\n• Yo'l: ${currentPlot.infrastructure.road}.`;
                    nextSuggestions = ["💼 Ish o'rinlari soni", "🔄 Chatni tozalash"];
                } else if (textLower.includes('ish') || textLower.includes('orin') || textLower.includes('💼')) {
                    const currentPlot = plots.find(p => p.id === matchedPlot?.id) || plots[0];
                    backupText = `Ushbu investitsiya maydonida korxonani tashkil etish orqali Piskent tumanida ${currentPlot.jobs} ta yangi doimiy ish o'rinlarini yaratish imkoniyati mavjud.`;
                    nextSuggestions = ["⚡ Infratuzilma ko'rsatkichlari", "🔄 Chatni tozalash"];
                } else {
                    const currentPlot = matchedPlot || plots[0];
                    backupText = `Assalomu alaykum! Piskent Invest AI tizimi loyihangiz uchun mos keladigan davlat lotini aniqladi: "${currentPlot.name}" (Maydoni: ${currentPlot.area} ga). Infratuzilma ko'rsatkichlarini pastdagi tugmalar orqali tekshiring.`;
                    nextSuggestions = ["⚡ Infratuzilma ko'rsatkichlari", "💼 Ish o'rinlari soni"];
                    includeButtons = true;
                }
            }

            setIsTyping(false);
            setChatMessages([
                ...newMessages,
                {
                    sender: 'ai',
                    text: backupText,
                    recommendedPlot: includeButtons ? (matchedPlot || plots[0]) : null,
                    suggestions: nextSuggestions
                }
            ]);
        }
    };

    const resetChat = () => {
        setChatMessages([]);
    };

    // СВЕРХНАДЁЖНЫЙ ЛОКАЛЬНЫЙ СЛОВАРЬ ДЛЯ ВНУТРЕННЕГО ИНТЕРФЕЙСА ЧАТА (НА ВСЕ ЯЗЫКИ)
    const chatLabels: Record<string, any> = {
        uz: {
            title: "AI Investitsiya Maslahatchisi",
            sync: "E-Auksion Sync Active",
            online: "E-Auksion AI Online",
            desc: "Biznes g'oyangizni, faoliyat turi va byudjetingizni yozing — men rasmiy ma'lumotlar asosida Piskent tumanidagi eng mos yer maydonini tavsiya qilaman.",
            p1: "Sanoat zonalari",
            p2: "To'qimachilik lotlari",
            mapBtn: "Xaritada ko‘rsatish",
            pageBtn: "Auksion sahifasi"
        },
        ru: {
            title: "AI Инвестиционный Консультант",
            sync: "Синхронизация с E-Auksion Активна",
            online: "E-Auksion AI Онлайн",
            desc: "Опишите вашу бизнес-идею, отрасль и бюджет — я на основе официальных данных порекомендую наиболее подходящий земельный участок в Пискентском районе.",
            p1: "Промышленные зоны",
            p2: "Текстильные лоты",
            mapBtn: "Показать на карте",
            pageBtn: "Страница аукциона"
        },
        en: {
            title: "AI Investment Consultant",
            sync: "E-Auksion Sync Active",
            online: "E-Auksion AI Online",
            desc: "Describe your business idea, industry, and budget — I will recommend the most suitable plot of land in Piskent district based on official data.",
            p1: "Industrial Zones",
            p2: "Textile Plots",
            mapBtn: "Show on Map",
            pageBtn: "Auction Page"
        },
        zh: {
            title: "AI 投资顾问",
            sync: "电子拍卖数据同步激活",
            online: "电子拍卖 AI 在线",
            desc: "请描述您的商业想法、行业和预算 — 我将根据官方实时数据为您推荐皮斯肯特地区最合适的投资土地。",
            p1: "工业园区土地",
            p2: "纺织印染土地",
            mapBtn: "在地图上查看",
            pageBtn: "拍卖官方页面"
        }
    };

    // Правильное извлечение языка в переменную labels
    const labels = chatLabels[lang] || chatLabels['uz'];

    if (isChatLayout) {
        return (
            <div className="flex flex-col h-full bg-[#040814] rounded-2xl border border-slate-950 overflow-hidden relative min-h-[400px] shadow-2xl">
                <div className="p-4 bg-[#0b1329]/90 backdrop-blur-md border-b border-slate-900 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-tr from-cyan-600 to-blue-500 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20 relative animate-pulse">
                            🤖
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0b1329] rounded-full"></span>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-white tracking-wide">{chatLabels.title}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] text-emerald-400 font-medium">{chatLabels.sync}</span>
                            </div>
                        </div>
                    </div>
                    {chatMessages.length > 0 && (
                        <button onClick={resetChat} className="text-[10px] font-semibold text-slate-500 hover:text-rose-400 transition-all bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-800">
                            {lang === 'ru' ? 'Очистить' : lang === 'zh' ? '清空' : 'Tozalash'}
                        </button>
                    )}
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gradient-to-b from-[#040814] to-[#060c1f]">
                    {chatMessages.length === 0 ? (
                        <div className="text-center my-auto flex flex-col items-center justify-center h-full pt-4 animate-fade-in px-4">
                            <div className="w-12 h-12 bg-gradient-to-b from-cyan-500/10 to-blue-500/5 text-cyan-400 border border-cyan-500/20 rounded-2xl flex items-center justify-center text-xl mb-4 shadow-xl shadow-cyan-950/50">🤖</div>
                            <h4 className="text-sm font-bold text-white mb-2 tracking-wide">Piskent Invest AI</h4>
                            <p className="text-[11px] text-slate-400 max-w-xs mb-6 leading-relaxed">
                                {lang === 'ru' ? "Привет! Я помощник хокимията. Спросите меня о свободных лотах или инвестиционных площадках." : "Salom! Men hokimlik yordamchisiman. Bo'sh yer maydonlari haqida so'rang."}
                            </p>

                            <div className="flex flex-col gap-2 w-full max-w-xs">
                                <button onClick={() => handleSendMessage(lang === 'ru' ? "Покажи промышленные зоны" : "Sanoat zonalari")} className="p-3 bg-[#0b1329]/80 hover:bg-[#111c3a] border border-slate-900 rounded-xl text-left text-[11px] font-medium text-slate-300 transition-all shadow-md flex items-center gap-2">🏭 <span>{lang === 'ru' ? "Промышленные зоны" : "Sanoat zonalari"}</span></button>
                                <button onClick={() => handleSendMessage(lang === 'ru' ? "Покажи текстильные лоты" : "To'qimachilik lotlari")} className="p-3 bg-[#0b1329]/80 hover:bg-[#111c3a] border border-slate-900 rounded-xl text-left text-[11px] font-medium text-slate-300 transition-all shadow-md flex items-center gap-2">🧵 <span>{lang === 'ru' ? "Текстильные лоты" : "To'qimachilik lotlari"}</span></button>
                            </div>
                        </div>
                    ) : (
                        chatMessages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                                <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-lg ${msg.sender === 'user'
                                    ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white rounded-tr-none'
                                    : 'bg-[#0b1329]/90 border border-slate-800/80 text-slate-200 rounded-tl-none backdrop-blur-sm relative'
                                    }`}>
                                    <div className="whitespace-pre-line">{msg.text}</div>
                                    {msg.sender === 'ai' && msg.recommendedPlot && (
                                        <div className="mt-3.5 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row gap-2 justify-end">
                                            {msg.recommendedPlot.auksionUrl && (
                                                <a href={msg.recommendedPlot.auksionUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5">
                                                    <span>{chatLabels.pageBtn}</span> 🌐
                                                </a>
                                            )}
                                            <button onClick={() => onSelectPlot(msg.recommendedPlot)} className="px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20">
                                                <span>{chatLabels.mapBtn}</span> 📍
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {msg.sender === 'ai' && msg.suggestions && (
                                    <div className="flex flex-wrap gap-1.5 mt-2 max-w-[85%]">
                                        {msg.suggestions.map((suggestion: string, sIdx: number) => (
                                            <button key={sIdx} onClick={() => suggestion.includes('Сбросить') || suggestion.includes('Очистить') ? resetChat() : handleSendMessage(suggestion)} className="px-3 py-1.5 bg-[#111c3a]/50 hover:bg-[#17264e] border border-cyan-500/10 rounded-xl text-[10px] font-semibold text-cyan-400 transition-all shadow-sm">
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                )}
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

                <div className="p-3 bg-[#0b1329]/80 backdrop-blur-md border-t border-slate-900 flex gap-2">
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={t.inputPlaceholder}
                        className="flex-1 bg-[#040814] border border-slate-800/80 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-600 transition-all"
                    />
                    <button onClick={() => handleSendMessage()} className="px-4 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95">
                        {t.sendBtn}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col justify-center max-w-md mx-auto py-2">
            <div className="mb-4">
                <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-2 py-0.5 rounded">
                    {lang === 'zh' ? '🚀 AI 推荐系统' : lang === 'ru' ? '🚀 AI Система Рекомендаций' : lang === 'en' ? '🚀 AI Recommendation System' : '🚀 AI Tavsiya Tizimi'}
                </span>
                <h2 className="text-base md:text-lg font-bold text-white mt-2">{t.filterTitle}</h2>
            </div>

            <div className="space-y-4 bg-[#0b1329] p-4 md:p-5 rounded-2xl border border-slate-800 shadow-xl">
                <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">💼 {t.industryLabel}</label>
                    <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full bg-[#040814] border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer">
                        {lang === 'zh' ? (
                            <>
                                <option value="Production">🏭 工业与制造</option>
                                <option value="Textile">🧵 纺织与服装加工</option>
                                <option value="Logistics">📦 物流与仓储运输</option>
                                <option value="Agro">🌾 农业与食品加工</option>
                            </>
                        ) : lang === 'ru' ? (
                            <>
                                <option value="Production">🏭 Промышленность и производство</option>
                                <option value="Textile">🧵 Текстиль и ткачество</option>
                                <option value="Logistics">📦 Логистика и транспорт</option>
                                <option value="Agro">🌾 Сельское хозяйство и агро</option>
                            </>
                        ) : lang === 'en' ? (
                            <>
                                <option value="Production">🏭 Industry & Manufacturing</option>
                                <option value="Textile">🧵 Textile & Clothing</option>
                                <option value="Logistics">📦 Logistics & Transport</option>
                                <option value="Agro">🌾 Agriculture & Agro</option>
                            </>
                        ) : (
                            <>
                                <option value="Production">Sanoat va ishlab chiqarish</option>
                                <option value="Textile">To'qimachilik va tekstil</option>
                                <option value="Logistics">Logistika va transport</option>
                                <option value="Agro">Qishloq xo'jaligi va agro</option>
                            </>
                        )}
                    </select>
                </div>

                <button onClick={handleAiSearch} className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold text-xs uppercase text-white shadow-lg shadow-cyan-950 transition-all active:scale-95">
                    ⚙️ {t.analyzeBtn}
                </button>
            </div>

            {results.length > 0 && (
                <div className="mt-4 space-y-2">
                    <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t.foundTitle}:</h3>
                    {results.map(plot => (
                        <div key={plot.id} className="p-3 bg-[#0b1329] border border-slate-800 rounded-xl flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-white text-[11px]">{plot.name}</h4>
                                <p className="text-[10px] text-slate-400 mt-0.5">{plot.area} ga • {plot.status}</p>
                            </div>
                            <button onClick={() => onSelectPlot(plot)} className="px-2.5 py-1 bg-cyan-600/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-[10px] font-semibold hover:bg-cyan-600 hover:text-white transition-all">
                                {t.showMap} 📍
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
