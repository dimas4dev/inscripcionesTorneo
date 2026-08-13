'use client';

import { useState } from 'react';
import HeroBanner from './HeroBanner';
import TournamentForm from './TournamentForm';
import IndividualForm from './IndividualForm';

type Mode = 'equipo' | 'individual';

export default function HomeView() {
  const [mode, setMode] = useState<Mode>('equipo');

  return (
    <div className="min-h-screen bg-gray-50">
      <HeroBanner />

      {/* Selector de modo */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex">
            <button
              onClick={() => setMode('equipo')}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold border-b-2 transition-colors ${
                mode === 'equipo'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Registrar Equipo
            </button>
            <button
              onClick={() => setMode('individual')}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold border-b-2 transition-colors ${
                mode === 'individual'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Inscripción Individual
              <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                Lista de espera
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Formulario activo */}
      {mode === 'equipo' ? <TournamentForm /> : <IndividualForm />}
    </div>
  );
}
