'use client';

import React from 'react';

export default function Passport({ lang }: { lang: string }) {
    return (
        <div className="p-6 bg-[#070d1e] h-full text-white overflow-y-auto">
            <h2 className="text-xl font-bold">Investitsiya pasporti — Piskent tumani</h2>
            <p className="text-xs text-slate-400 mt-1">Piskent tumanining ijtimoiy-iqtisodiy salohiyati</p>
            <div className="bg-[#0b1329] p-5 rounded-xl border border-slate-800 mt-6">
                <p className="text-xs text-slate-300 leading-relaxed">
                    Piskent tumani 121,000 dan ortiq yosh, bilimli va mehnatga layoqatli kadrlarga (aholining 61% qismi) ega hududdir.
                </p>
            </div>
        </div>
    );
}