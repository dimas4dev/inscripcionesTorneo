'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Inscripcion, Individual, Disciplina } from '@/lib/types';

const MINIMOS: Record<Disciplina, number> = { Voleibol: 6, 'Microfútbol': 5 };

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(timestamp: Inscripcion['createdAt']): string {
  if (!timestamp) return '—';
  const date = timestamp.toDate();
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function exportToCSV(data: Inscripcion[]) {
  const headers = [
    '#',
    'Fecha Inscripción',
    'Equipo',
    'Disciplina',
    'Fecha Torneo',
    'Capitán',
    'Documento Capitán',
    'WhatsApp',
    'Email',
    'Total Jugadores',
    'Total a Pagar COP',
    'Comprobante URL',
    'Jugadores',
  ];

  const rows = data.map((ins, i) => [
    i + 1,
    ins.createdAt ? formatDate(ins.createdAt) : '',
    ins.equipoNombre,
    ins.disciplina,
    ins.fechaTorneo,
    ins.capitan.nombre,
    ins.capitan.documento,
    ins.capitan.telefono,
    ins.capitan.email,
    ins.totalJugadores,
    ins.totalPagarCOP,
    ins.comprobanteUrl,
    ins.jugadores.map((j) => `${j.nombre} (${j.documento})${j.esCapitan ? ' [C]' : ''}`).join(' | '),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inscripciones-torneo-agape-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Modal de jugadores ──────────────────────────────────────────────────────
interface PlayerModalProps {
  inscripcion: Inscripcion;
  onClose: () => void;
}

function PlayerModal({ inscripcion, onClose }: PlayerModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{inscripcion.equipoNombre}</h3>
              <span
                className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  inscripcion.disciplina === 'Voleibol'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {inscripcion.disciplina === 'Voleibol' ? '🏐' : '⚽'} {inscripcion.disciplina}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Capitán info */}
          <div className="bg-gray-50 rounded-xl p-3.5 mb-4 text-sm space-y-1">
            <p>
              <span className="font-medium text-gray-600">Capitán:</span>{' '}
              <span className="text-gray-900">{inscripcion.capitan.nombre}</span>
            </p>
            <p>
              <span className="font-medium text-gray-600">WhatsApp:</span>{' '}
              <a
                href={`https://wa.me/${inscripcion.capitan.telefono.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline"
              >
                {inscripcion.capitan.telefono}
              </a>
            </p>
            <p>
              <span className="font-medium text-gray-600">Email:</span>{' '}
              <span className="text-gray-900">{inscripcion.capitan.email}</span>
            </p>
          </div>

          {/* Lista de jugadores */}
          <h4 className="font-semibold text-gray-900 mb-3">
            Lista de Jugadores ({inscripcion.totalJugadores})
          </h4>
          <div className="space-y-2">
            {inscripcion.jugadores.map((j, i) => (
              <div
                key={j.id}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  j.esCapitan ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    j.esCapitan ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {j.esCapitan ? 'C' : i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{j.nombre}</p>
                  <p className="text-xs text-gray-500">Doc: {j.documento}</p>
                </div>
                {j.esCapitan && (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    Capitán
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-4 flex items-center justify-between p-3.5 bg-emerald-50 rounded-xl border border-emerald-100">
            <span className="text-sm font-medium text-gray-700">Total a pagar</span>
            <span className="font-extrabold text-emerald-700">{formatCOP(inscripcion.totalPagarCOP)}</span>
          </div>

          {/* Comprobante */}
          <a
            href={inscripcion.comprobanteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-700 font-semibold rounded-xl py-2.5 hover:bg-gray-50 transition text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Ver Comprobante de Pago
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Panel de Individuales ───────────────────────────────────────────────────
interface IndividualsPanelProps {
  individuales: Individual[];
  onRefresh: () => void;
}

function IndividualesPanel({ individuales, onRefresh }: IndividualsPanelProps) {
  const porDisciplina = useMemo(() => ({
    Voleibol: individuales.filter((i) => i.disciplina === 'Voleibol'),
    'Microfútbol': individuales.filter((i) => i.disciplina === 'Microfútbol'),
  }), [individuales]);

  return (
    <div className="space-y-5">
      {/* Progreso de cupos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(['Voleibol', 'Microfútbol'] as Disciplina[]).map((d) => {
          const count = porDisciplina[d].length;
          const min = MINIMOS[d];
          const pct = Math.min((count / min) * 100, 100);
          const complete = count >= min;
          return (
            <div
              key={d}
              className={`bg-white rounded-xl border p-5 ${
                complete ? 'border-emerald-300 shadow-emerald-100 shadow-md' : 'border-gray-100 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900">{d === 'Voleibol' ? '🏐' : '⚽'} {d}</p>
                  <p className="text-xs text-gray-500">
                    {d === 'Voleibol' ? 'Mixto · Sáb. 22 Ago' : 'Masculino · Dom. 23 Ago'}
                  </p>
                </div>
                <span className={`text-2xl font-extrabold ${complete ? 'text-emerald-600' : 'text-gray-900'}`}>
                  {count}<span className="text-sm font-normal text-gray-400">/{min}</span>
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    complete ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-purple-400'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {complete ? (
                <p className="mt-2 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  ¡Cupo completo! Contáctalos para confirmar participación.
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-400">
                  Faltan <strong>{min - count}</strong> personas para completar el cupo mínimo.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Tabla de individuales */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="font-semibold text-gray-700 text-sm">
            {individuales.length} persona{individuales.length !== 1 ? 's' : ''} en lista de espera
          </p>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
        </div>
        {individuales.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <p className="text-4xl mb-3">👤</p>
            <p className="font-medium">Aún no hay inscripciones individuales</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Nombre</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Documento</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">WhatsApp</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Disciplina</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {individuales.map((ind, i) => (
                  <tr key={ind.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{ind.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{ind.documento}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://wa.me/${ind.telefono.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:underline"
                      >
                        {ind.telefono}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        ind.disciplina === 'Voleibol'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {ind.disciplina === 'Voleibol' ? '🏐' : '⚽'} {ind.disciplina}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(ind.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard principal ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'equipos' | 'individuales'>('equipos');
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [individuales, setIndividuales] = useState<Individual[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [filterDisciplina, setFilterDisciplina] = useState<Disciplina | 'Todas'>('Todas');
  const [selected, setSelected] = useState<Inscripcion | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const [snapEq, snapInd] = await Promise.all([
        getDocs(query(collection(db, 'inscripciones'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'individuales'), orderBy('createdAt', 'desc'))),
      ]);
      setInscripciones(snapEq.docs.map((d) => ({ id: d.id, ...d.data() } as Inscripcion)));
      setIndividuales(snapInd.docs.map((d) => ({ id: d.id, ...d.data() } as Individual)));
    } catch (err: unknown) {
      console.error('Error cargando datos:', err);
      const code = (err as { code?: string }).code ?? '';
      if (code === 'permission-denied') {
        setFetchError(
          'Sin permisos para leer los datos. Ve a Firebase Console → Firestore → Reglas y asegúrate de que las lecturas estén permitidas para usuarios autenticados.'
        );
      } else {
        setFetchError('Error al cargar los datos. Intenta actualizar la página.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(
    () =>
      inscripciones.filter((ins) => {
        const term = search.toLowerCase();
        const matchSearch =
          !term ||
          ins.equipoNombre.toLowerCase().includes(term) ||
          ins.capitan.nombre.toLowerCase().includes(term);
        const matchDisciplina =
          filterDisciplina === 'Todas' || ins.disciplina === filterDisciplina;
        return matchSearch && matchDisciplina;
      }),
    [inscripciones, search, filterDisciplina]
  );

  const stats = useMemo(() => {
    const voleibol = inscripciones.filter((i) => i.disciplina === 'Voleibol').length;
    const microfutbol = inscripciones.filter((i) => i.disciplina === 'Microfútbol').length;
    const totalJugadores = inscripciones.reduce((s, i) => s + i.totalJugadores, 0);
    const totalRecaudado = inscripciones.reduce((s, i) => s + i.totalPagarCOP, 0);
    return { voleibol, microfutbol, totalJugadores, totalRecaudado };
  }, [inscripciones]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-500">
        <svg className="animate-spin w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p>Cargando inscripciones…</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <p className="text-4xl mb-3">🔒</p>
        <p className="font-bold text-red-800 mb-2">Error de permisos en Firestore</p>
        <p className="text-sm text-red-700 mb-4 max-w-lg mx-auto">{fetchError}</p>
        <div className="bg-white border border-red-100 rounded-xl p-4 text-left text-xs font-mono text-gray-700 mb-4 max-w-lg mx-auto">
          <p className="font-semibold text-gray-500 mb-2">Reglas correctas para Firestore:</p>
          <pre className="whitespace-pre-wrap">{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /inscripciones/{docId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
    match /individuales/{docId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
  }
}`}</pre>
        </div>
        <button
          onClick={fetchData}
          className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 transition"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex">
          {([
            { id: 'equipos', label: 'Equipos', count: inscripciones.length, icon: '🏆' },
            { id: 'individuales', label: 'Lista Individual', count: individuales.length, icon: '👤' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.count}
              </span>
              {tab.id === 'individuales' && individuales.length > 0 && (() => {
                const vComplete = individuales.filter(i => i.disciplina === 'Voleibol').length >= MINIMOS.Voleibol;
                const mComplete = individuales.filter(i => i.disciplina === 'Microfútbol').length >= MINIMOS['Microfútbol'];
                return (vComplete || mComplete) ? (
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" title="¡Cupo completo!" />
                ) : null;
              })()}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'individuales' ? (
        <IndividualesPanel individuales={individuales} onRefresh={fetchData} />
      ) : (
      <>
      {/* Estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Equipos</p>
          <p className="text-3xl font-extrabold text-gray-900">{inscripciones.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-1">🏐 Voleibol</p>
          <p className="text-3xl font-extrabold text-emerald-900">{stats.voleibol}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">⚽ Microfútbol</p>
          <p className="text-3xl font-extrabold text-blue-900">{stats.microfutbol}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-1">💰 Total Esperado</p>
          <p className="text-xl font-extrabold text-amber-900">{formatCOP(stats.totalRecaudado)}</p>
          <p className="text-xs text-amber-600 mt-0.5">{stats.totalJugadores} jugadores</p>
        </div>
      </div>

      {/* Buscador y filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por equipo o capitán…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['Todas', 'Voleibol', 'Microfútbol'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setFilterDisciplina(d)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                  filterDisciplina === d
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            onClick={() => exportToCSV(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar CSV
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
            title="Recargar datos"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
        </div>
        {filtered.length !== inscripciones.length && (
          <p className="text-xs text-gray-400 mt-2">
            Mostrando {filtered.length} de {inscripciones.length} inscripciones
          </p>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">📋</p>
            <p className="font-medium">
              {inscripciones.length === 0
                ? 'No hay inscripciones aún'
                : 'Sin resultados para esta búsqueda'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Equipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Disciplina</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Capitán</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">WhatsApp</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">Jug.</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500">Total</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 whitespace-nowrap">Fecha</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((ins, i) => (
                  <tr key={ins.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 max-w-[140px] truncate">
                      {ins.equipoNombre}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          ins.disciplina === 'Voleibol'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {ins.disciplina === 'Voleibol' ? '🏐' : '⚽'} {ins.disciplina}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[130px] truncate">{ins.capitan.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <a
                        href={`https://wa.me/${ins.capitan.telefono.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-emerald-600 transition"
                      >
                        {ins.capitan.telefono}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 bg-gray-100 rounded-full text-xs font-bold text-gray-700">
                        {ins.totalJugadores}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {formatCOP(ins.totalPagarCOP)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(ins.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelected(ins)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                          title="Ver jugadores"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </button>
                        <a
                          href={ins.comprobanteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                          title="Ver comprobante"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <PlayerModal inscripcion={selected} onClose={() => setSelected(null)} />}
      </>
      )}
    </div>
  );
}
