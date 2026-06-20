'use client';

import React from 'react';

export default function Dashboard({ lang }: { lang: string }) {
    return (
        <div className="p-6 bg-[#070d1e] h-full text-white overflow-y-auto">
            <h2 className="text-xl font-bold">Investitsiya tahlil paneli</h2>
            <p className="text-xs text-slate-400 mt-1">Piskent tumanidagi umumiy investitsiya ko'rsatkichlari (Demo)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-[#0b1329] p-4 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">MAVJUD YERLAR</span>
                    <span className="text-xl font-black text-cyan-400">521.3 ga</span>
                </div>
                <div className="bg-[#0b1329] p-4 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">LOYIHALAR</span>
                    <span className="text-xl font-black text-white">8 ta</span>
                </div>
            </div>
        </div>
    );
}