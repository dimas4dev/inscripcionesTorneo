'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { collection, deleteDoc, doc, getDocs, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Inscripcion, Individual, Disciplina, Genero, Jugador, Capitan } from '@/lib/types';

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

function isLikelyImage(url: string): boolean {
  if (!url) return false;
  if (/\.pdf(\?|#|$)/i.test(url)) return false;
  if (/\.(jpe?g|png|gif|webp|avif|bmp)(\?|#|$)/i.test(url)) return true;
  return url.includes('res.cloudinary.com');
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

function GenderToggle({
  value,
  onChange,
}: {
  value: Genero;
  onChange: (g: Genero) => void;
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
      {(['Masculino', 'Femenino'] as Genero[]).map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(g)}
          className={`flex-1 px-3 py-2 transition-colors ${
            value === g
              ? g === 'Masculino'
                ? 'bg-blue-500 text-white'
                : 'bg-rose-500 text-white'
              : 'bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          {g === 'Masculino' ? '♂ M' : '♀ F'}
        </button>
      ))}
    </div>
  );
}

function cloneRoster(ins: Inscripcion): Jugador[] {
  const list = (ins.jugadores ?? []).map((j) => ({
    ...j,
    id: j.id || generateId(),
    genero: j.genero ?? 'Masculino',
  }));
  if (!list.some((j) => j.esCapitan)) {
    list.unshift({
      id: generateId(),
      nombre: ins.capitan.nombre,
      documento: ins.capitan.documento,
      esCapitan: true,
      genero: ins.capitan.genero ?? 'Masculino',
    });
  }
  return list;
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
    'Monto Original COP',
    'Monto Abonado COP',
    'Pago Verificado',
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
    ins.montoOriginalCOP ?? ins.totalPagarCOP,
    ins.totalPagarCOP,
    ins.pagoVerificado ? 'Sí' : 'Pendiente',
    ins.comprobanteUrl,
    ins.jugadores.map((j) => `${j.nombre} (${j.documento})${j.genero ? ` [${j.genero === 'Masculino' ? 'M' : 'F'}]` : ''}${j.esCapitan ? ' [C]' : ''}`).join(' | '),
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
  onUpdateTotal: (id: string, totalPagarCOP: number) => Promise<void>;
  onReviewPayment: () => void;
  onUpdateRoster: (
    id: string,
    data: { equipoNombre: string; jugadores: Jugador[]; capitan: Capitan }
  ) => Promise<void>;
  startEditingRoster?: boolean;
}

function PlayerModal({
  inscripcion,
  onClose,
  onUpdateTotal,
  onReviewPayment,
  onUpdateRoster,
  startEditingRoster = false,
}: PlayerModalProps) {
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState(String(inscripcion.totalPagarCOP));
  const [savingTotal, setSavingTotal] = useState(false);
  const [totalError, setTotalError] = useState('');
  const [editingRoster, setEditingRoster] = useState(startEditingRoster);
  const [equipoNombre, setEquipoNombre] = useState(inscripcion.equipoNombre);
  const [draftPlayers, setDraftPlayers] = useState<Jugador[]>(() => cloneRoster(inscripcion));
  const [savingRoster, setSavingRoster] = useState(false);
  const [rosterError, setRosterError] = useState('');

  const startEditingTotal = () => {
    setTotalInput(String(inscripcion.totalPagarCOP));
    setTotalError('');
    setEditingTotal(true);
  };

  const cancelEditingTotal = () => {
    setEditingTotal(false);
    setTotalInput(String(inscripcion.totalPagarCOP));
    setTotalError('');
  };

  const handleSaveTotal = async () => {
    if (!inscripcion.id) return;
    const parsed = Number(String(totalInput).replace(/[^\d]/g, ''));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setTotalError('Ingresa un monto válido.');
      return;
    }
    setSavingTotal(true);
    setTotalError('');
    try {
      await onUpdateTotal(inscripcion.id, parsed);
      setEditingTotal(false);
    } catch {
      setTotalError('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSavingTotal(false);
    }
  };

  const startRosterEdit = () => {
    setEquipoNombre(inscripcion.equipoNombre);
    setDraftPlayers(cloneRoster(inscripcion));
    setRosterError('');
    setEditingRoster(true);
  };

  const cancelRosterEdit = () => {
    setEditingRoster(false);
    setEquipoNombre(inscripcion.equipoNombre);
    setDraftPlayers(cloneRoster(inscripcion));
    setRosterError('');
  };

  const updatePlayer = (index: number, patch: Partial<Jugador>) => {
    setDraftPlayers((prev) => prev.map((j, i) => (i === index ? { ...j, ...patch } : j)));
  };

  const addPlayer = () => {
    setDraftPlayers((prev) => [
      ...prev,
      { id: generateId(), nombre: '', documento: '', esCapitan: false, genero: 'Masculino' },
    ]);
  };

  const removePlayer = (index: number) => {
    setDraftPlayers((prev) => prev.filter((j, i) => i !== index || j.esCapitan));
  };

  const handleSaveRoster = async () => {
    if (!inscripcion.id) return;
    const nombreEquipo = equipoNombre.trim();
    if (nombreEquipo.length < 3) {
      setRosterError('El nombre del equipo debe tener al menos 3 caracteres.');
      return;
    }
    const capitanJugador = draftPlayers.find((j) => j.esCapitan);
    if (!capitanJugador?.nombre.trim()) {
      setRosterError('El capitán debe tener nombre.');
      return;
    }
    const jugadores = draftPlayers
      .map((j) => ({
        ...j,
        nombre: j.nombre.trim(),
        documento: j.documento.trim(),
      }))
      .filter((j) => j.esCapitan || j.nombre !== '');
    const extrasSinNombre = draftPlayers.filter((j) => !j.esCapitan && j.nombre.trim() === '');
    if (extrasSinNombre.length > 0 && extrasSinNombre.some((j) => j.documento.trim() !== '')) {
      setRosterError('Cada jugador adicional debe tener al menos el nombre.');
      return;
    }

    const capitan: Capitan = {
      ...inscripcion.capitan,
      nombre: capitanJugador.nombre.trim(),
      documento: capitanJugador.documento.trim() || inscripcion.capitan.documento,
      genero: capitanJugador.genero,
    };

    setSavingRoster(true);
    setRosterError('');
    try {
      await onUpdateRoster(inscripcion.id, {
        equipoNombre: nombreEquipo,
        jugadores,
        capitan,
      });
      setEditingRoster(false);
    } catch {
      setRosterError('No se pudo guardar la plantilla. Inténtalo de nuevo.');
    } finally {
      setSavingRoster(false);
    }
  };

  const minRecomendado = MINIMOS[inscripcion.disciplina];
  const plantillaIncompleta = inscripcion.totalJugadores < minRecomendado;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0 pr-3">
              {editingRoster ? (
                <input
                  type="text"
                  value={equipoNombre}
                  onChange={(e) => setEquipoNombre(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                  placeholder="Nombre del equipo"
                />
              ) : (
                <h3 className="text-lg font-bold text-gray-900">{inscripcion.equipoNombre}</h3>
              )}
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
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="font-semibold text-gray-900">
              Lista de Jugadores ({editingRoster ? draftPlayers.filter((j) => j.esCapitan || j.nombre.trim()).length : inscripcion.totalJugadores})
            </h4>
            {!editingRoster && (
              <button
                type="button"
                onClick={startRosterEdit}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
              >
                Editar plantilla
              </button>
            )}
          </div>
          {plantillaIncompleta && !editingRoster && (
            <p className="mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Solo está el capitán o faltan nombres. Se recomienda al menos {minRecomendado} jugadores para{' '}
              {inscripcion.disciplina}. Usa <strong>Editar plantilla</strong> para agregarlos.
            </p>
          )}
          {/* Resumen M/F */}
          {(() => {
            const masc = inscripcion.jugadores.filter((j) => j.genero === 'Masculino').length;
            const fem = inscripcion.jugadores.filter((j) => j.genero === 'Femenino').length;
            const noInfo = inscripcion.jugadores.filter((j) => !j.genero).length;
            return (
              <div className="flex gap-2 mb-3">
                <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
                  ♂ {masc} {masc === 1 ? 'hombre' : 'hombres'}
                </span>
                <span className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-semibold">
                  ♀ {fem} {fem === 1 ? 'mujer' : 'mujeres'}
                </span>
                {noInfo > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-semibold">
                    ? {noInfo} sin dato
                  </span>
                )}
              </div>
            );
          })()}
          <div className="space-y-2">
            {(editingRoster ? draftPlayers : inscripcion.jugadores).map((j, i) => (
              <div
                key={j.id || `${j.nombre}-${i}`}
                className={`p-3 rounded-xl ${
                  j.esCapitan ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50'
                }`}
              >
                {editingRoster ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          j.esCapitan ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-600'
                        }`}
                      >
                        {j.esCapitan ? 'C' : i + 1}
                      </span>
                      <input
                        type="text"
                        value={j.nombre}
                        onChange={(e) => updatePlayer(i, { nombre: e.target.value })}
                        placeholder={j.esCapitan ? 'Nombre del capitán' : 'Nombre del jugador'}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                      />
                      {!j.esCapitan && (
                        <button
                          type="button"
                          onClick={() => removePlayer(i)}
                          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                          title="Quitar jugador"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={j.documento}
                      onChange={(e) => updatePlayer(i, { documento: e.target.value })}
                      placeholder="Documento (opcional)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                    />
                    <GenderToggle
                      value={j.genero ?? 'Masculino'}
                      onChange={(g) => updatePlayer(i, { genero: g })}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        j.esCapitan ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-600'
                      }`}
                    >
                      {j.esCapitan ? 'C' : i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{j.nombre}</p>
                      <p className="text-xs text-gray-500">Doc: {j.documento || '—'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {j.genero && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          j.genero === 'Masculino'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-rose-100 text-rose-600'
                        }`}>
                          {j.genero === 'Masculino' ? '♂ M' : '♀ F'}
                        </span>
                      )}
                      {j.esCapitan && (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Capitán
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {editingRoster && (
            <div className="mt-3 space-y-3">
              <button
                type="button"
                onClick={addPlayer}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar jugador
              </button>
              {rosterError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                  {rosterError}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={cancelRosterEdit}
                  disabled={savingRoster}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveRoster}
                  disabled={savingRoster}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingRoster && (
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {savingRoster ? 'Guardando…' : 'Guardar plantilla'}
                </button>
              </div>
            </div>
          )}

          {/* Total abonado */}
          <div className="mt-4 p-3.5 bg-emerald-50 rounded-xl border border-emerald-100 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-700">Total abonado</span>
              {!editingTotal && (
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={onReviewPayment}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition"
                  >
                    Ver comprobante
                  </button>
                  <button
                    type="button"
                    onClick={startEditingTotal}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition"
                  >
                    Editar
                  </button>
                </div>
              )}
            </div>

            {editingTotal ? (
              <div className="space-y-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={totalInput}
                    onChange={(e) => setTotalInput(e.target.value.replace(/[^\d]/g, ''))}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-emerald-300 text-sm font-semibold text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                    placeholder="Ej: 40000"
                    autoFocus
                    disabled={savingTotal}
                  />
                </div>
                {totalError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                    {totalError}
                  </p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={cancelEditingTotal}
                    disabled={savingTotal}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTotal}
                    disabled={savingTotal}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingTotal && (
                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {savingTotal ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="font-extrabold text-emerald-700 text-lg text-right">
                {formatCOP(inscripcion.totalPagarCOP)}
              </p>
            )}
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

interface PaymentReviewModalProps {
  inscripcion: Inscripcion;
  onClose: () => void;
  onSave: (id: string, totalPagarCOP: number) => Promise<void>;
}

function PaymentReviewModal({ inscripcion, onClose, onSave }: PaymentReviewModalProps) {
  const original = inscripcion.montoOriginalCOP ?? inscripcion.totalPagarCOP;
  const [amountInput, setAmountInput] = useState(String(inscripcion.totalPagarCOP));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = isLikelyImage(inscripcion.comprobanteUrl) && !imageFailed;

  const handleSave = async () => {
    if (!inscripcion.id) return;
    const parsed = Number(String(amountInput).replace(/[^\d]/g, ''));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Ingresa un monto válido.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(inscripcion.id, parsed);
      onClose();
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Revisar pago</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {inscripcion.equipoNombre} · {inscripcion.disciplina}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Revisa el comprobante y ajusta el valor al monto que realmente enviaron. Ese dato alimenta el control financiero del torneo.
          </p>

          <div className="mb-4 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
            {showImage ? (
              <a href={inscripcion.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={inscripcion.comprobanteUrl}
                  alt={`Comprobante de ${inscripcion.equipoNombre}`}
                  className="w-full max-h-[360px] object-contain bg-gray-100"
                  onError={() => setImageFailed(true)}
                />
              </a>
            ) : (
              <div className="p-6 text-center text-sm text-gray-500">
                <p className="mb-3">No se pudo mostrar la imagen aquí.</p>
                <a
                  href={inscripcion.comprobanteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-emerald-700 font-semibold hover:underline"
                >
                  Abrir comprobante
                </a>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Monto registrado</p>
              <p className="text-lg font-extrabold text-gray-800 mt-1">{formatCOP(original)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3.5">
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Abonado actual</p>
              <p className="text-lg font-extrabold text-emerald-800 mt-1">{formatCOP(inscripcion.totalPagarCOP)}</p>
              {inscripcion.pagoVerificado ? (
                <p className="text-xs font-semibold text-emerald-700 mt-1">Verificado</p>
              ) : (
                <p className="text-xs font-semibold text-amber-700 mt-1">Pendiente de revisar</p>
              )}
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Monto según el comprobante *
          </label>
          <div className="relative mb-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
              $
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value.replace(/[^\d]/g, ''))}
              className="w-full pl-7 pr-3 py-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
              placeholder="Ej: 40000"
              disabled={saving}
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Escribe solo números. Ejemplo: 10000, 20000, 40000.
          </p>

          {error && (
            <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-2"
            >
              {saving && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {saving ? 'Guardando…' : 'Guardar monto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal de confirmación de borrado ────────────────────────────────────────
interface ConfirmDeleteModalProps {
  title: string;
  description: ReactNode;
  loading: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDeleteModal({
  title,
  description,
  loading,
  error,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-desc"
      >
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <div>
              <h3 id="confirm-delete-title" className="text-lg font-bold text-gray-900">
                {title}
              </h3>
              <p id="confirm-delete-desc" className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          {error && (
            <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition flex items-center gap-2"
            >
              {loading && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Panel de Individuales ───────────────────────────────────────────────────
interface IndividualsPanelProps {
  individuales: Individual[];
  onRefresh: () => void;
  onRequestDelete: (individual: Individual) => void;
}

function IndividualesPanel({ individuales, onRefresh, onRequestDelete }: IndividualsPanelProps) {
  const porDisciplina = useMemo(() => ({
    Voleibol: individuales.filter((i) => i.disciplina === 'Voleibol'),
    'Microfútbol': individuales.filter((i) => i.disciplina === 'Microfútbol'),
  }), [individuales]);

  return (
    <div className="space-y-5">
      {/* Progreso de cupos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(['Voleibol', 'Microfútbol'] as Disciplina[]).map((d) => {
          const lista = porDisciplina[d];
          const count = lista.length;
          const min = MINIMOS[d];
          const pct = Math.min((count / min) * 100, 100);
          const complete = count >= min;
          const masc = lista.filter((p) => p.genero === 'Masculino').length;
          const fem = lista.filter((p) => p.genero === 'Femenino').length;
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
              {count > 0 && (
                <div className="flex gap-2 mt-2">
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">♂ {masc}</span>
                  <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">♀ {fem}</span>
                </div>
              )}
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Género</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Documento</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">WhatsApp</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Disciplina</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">Fecha</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {individuales.map((ind, i) => (
                  <tr key={ind.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{ind.nombre}</td>
                    <td className="px-4 py-3">
                      {ind.genero ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          ind.genero === 'Masculino'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-rose-100 text-rose-600'
                        }`}>
                          {ind.genero === 'Masculino' ? '♂ M' : '♀ F'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => onRequestDelete(ind)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                          title="Eliminar inscripción"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
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

type FinanceSlice = {
  equipos: number;
  jugadores: number;
  recaudado: number;
  premio: number;
  ganancia: number;
  pendientesPago: number;
};

interface FinanzasPanelProps {
  voleibol: FinanceSlice;
  microfutbol: FinanceSlice;
  recaudadoTotal: number;
  premioTotal: number;
  gananciaTotal: number;
  totalEquipos: number;
  pendientesPago: number;
}

function FinanzasPanel({
  voleibol,
  microfutbol,
  recaudadoTotal,
  premioTotal,
  gananciaTotal,
  totalEquipos,
  pendientesPago,
}: FinanzasPanelProps) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-900 mb-1">Consolidado de los dos torneos</h2>
        <p className="text-sm text-gray-500 mb-4">
          Recaudo total y ganancia sumando voleibol y microfútbol. El premio de cada disciplina se calcula aparte (30% de lo recaudado en ese torneo).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Recaudado de todos</p>
            <p className="text-2xl font-extrabold text-amber-900 mt-1">{formatCOP(recaudadoTotal)}</p>
            <p className="text-xs text-amber-700 mt-1">{totalEquipos} equipos inscritos</p>
          </div>
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
            <p className="text-xs font-medium text-violet-700 uppercase tracking-wide">Premios (suma de cada torneo)</p>
            <p className="text-2xl font-extrabold text-violet-900 mt-1">{formatCOP(premioTotal)}</p>
            <p className="text-xs text-violet-700 mt-1">30% voleibol + 30% microfútbol</p>
          </div>
          <div className="rounded-xl bg-teal-50 border border-teal-100 p-4">
            <p className="text-xs font-medium text-teal-700 uppercase tracking-wide">Ganancia de los dos torneos</p>
            <p className="text-2xl font-extrabold text-teal-900 mt-1">{formatCOP(gananciaTotal)}</p>
            <p className="text-xs text-teal-700 mt-1">70% voleibol + 70% microfútbol</p>
          </div>
        </div>
        {pendientesPago > 0 && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-4">
            Hay {pendientesPago} pago{pendientesPago !== 1 ? 's' : ''} pendiente{pendientesPago !== 1 ? 's' : ''} de revisar. Ajusta los montos en Equipos para que estas cifras coincidan con los comprobantes.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-base font-bold text-gray-900 mb-3">Por torneo</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {([
            {
              key: 'voleibol',
              emoji: '🏐',
              label: 'Voleibol',
              data: voleibol,
              wrap: 'bg-emerald-50 border-emerald-100',
              title: 'text-emerald-800',
              muted: 'text-emerald-700',
            },
            {
              key: 'microfutbol',
              emoji: '⚽',
              label: 'Microfútbol',
              data: microfutbol,
              wrap: 'bg-blue-50 border-blue-100',
              title: 'text-blue-800',
              muted: 'text-blue-700',
            },
          ] as const).map((torneo) => (
            <div key={torneo.key} className={`rounded-xl border p-5 ${torneo.wrap}`}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className={`text-sm font-bold ${torneo.title}`}>
                    {torneo.emoji} {torneo.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${torneo.muted}`}>
                    {torneo.data.equipos} equipo{torneo.data.equipos !== 1 ? 's' : ''} · {torneo.data.jugadores} jugador
                    {torneo.data.jugadores !== 1 ? 'es' : ''}
                  </p>
                </div>
                {torneo.data.pendientesPago > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                    {torneo.data.pendientesPago} por revisar
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className={`text-[11px] font-medium uppercase tracking-wide ${torneo.muted}`}>Recaudado</p>
                  <p className={`text-lg font-extrabold ${torneo.title}`}>{formatCOP(torneo.data.recaudado)}</p>
                </div>
                <div>
                  <p className={`text-[11px] font-medium uppercase tracking-wide ${torneo.muted}`}>Premio 30%</p>
                  <p className={`text-lg font-extrabold ${torneo.title}`}>{formatCOP(torneo.data.premio)}</p>
                </div>
                <div>
                  <p className={`text-[11px] font-medium uppercase tracking-wide ${torneo.muted}`}>Ganancia 70%</p>
                  <p className={`text-lg font-extrabold ${torneo.title}`}>{formatCOP(torneo.data.ganancia)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard principal ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'equipos' | 'individuales' | 'finanzas'>('equipos');
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [individuales, setIndividuales] = useState<Individual[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [filterDisciplina, setFilterDisciplina] = useState<Disciplina | 'Todas'>('Todas');
  const [selected, setSelected] = useState<Inscripcion | null>(null);
  const [editRosterOnOpen, setEditRosterOnOpen] = useState(false);
  const [paymentEdit, setPaymentEdit] = useState<Inscripcion | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    | { type: 'equipo'; item: Inscripcion }
    | { type: 'individual'; item: Individual }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  const handleConfirmDelete = async () => {
    if (!pendingDelete?.item.id) return;
    setDeleting(true);
    setDeleteError('');
    const id = pendingDelete.item.id;
    const collectionName = pendingDelete.type === 'equipo' ? 'inscripciones' : 'individuales';
    try {
      await deleteDoc(doc(db, collectionName, id));
      if (pendingDelete.type === 'equipo') {
        setInscripciones((prev) => prev.filter((ins) => ins.id !== id));
        if (selected?.id === id) setSelected(null);
      } else {
        setIndividuales((prev) => prev.filter((ind) => ind.id !== id));
      }
      setPendingDelete(null);
    } catch (err: unknown) {
      console.error('Error eliminando inscripción:', err);
      const code = (err as { code?: string }).code ?? '';
      if (code === 'permission-denied') {
        setDeleteError('Sin permisos para eliminar. Revisa las reglas de Firestore para usuarios autenticados.');
      } else {
        setDeleteError('No se pudo eliminar. Inténtalo de nuevo.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateTotal = async (id: string, totalPagarCOP: number) => {
    const current = inscripciones.find((ins) => ins.id === id);
    const montoOriginalCOP = current?.montoOriginalCOP ?? current?.totalPagarCOP ?? totalPagarCOP;
    await updateDoc(doc(db, 'inscripciones', id), {
      totalPagarCOP,
      montoOriginalCOP,
      pagoVerificado: true,
    });
    const patch = { totalPagarCOP, montoOriginalCOP, pagoVerificado: true as const };
    setInscripciones((prev) => prev.map((ins) => (ins.id === id ? { ...ins, ...patch } : ins)));
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
    setPaymentEdit((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  };

  const handleUpdateRoster = async (
    id: string,
    data: { equipoNombre: string; jugadores: Jugador[]; capitan: Capitan }
  ) => {
    await updateDoc(doc(db, 'inscripciones', id), {
      equipoNombre: data.equipoNombre,
      jugadores: data.jugadores,
      capitan: data.capitan,
      totalJugadores: data.jugadores.length,
    });
    const patch = {
      equipoNombre: data.equipoNombre,
      jugadores: data.jugadores,
      capitan: data.capitan,
      totalJugadores: data.jugadores.length,
    };
    setInscripciones((prev) => prev.map((ins) => (ins.id === id ? { ...ins, ...patch } : ins)));
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
    setPaymentEdit((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  };

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
    const byDisciplina = (disciplina: Disciplina) => {
      const lista = inscripciones.filter((i) => i.disciplina === disciplina);
      const recaudado = lista.reduce((s, i) => s + i.totalPagarCOP, 0);
      const premio = Math.round(recaudado * 0.3);
      return {
        equipos: lista.length,
        jugadores: lista.reduce((s, i) => s + i.totalJugadores, 0),
        recaudado,
        premio,
        ganancia: recaudado - premio,
        pendientesPago: lista.filter((i) => !i.pagoVerificado).length,
      };
    };

    const voleibol = byDisciplina('Voleibol');
    const microfutbol = byDisciplina('Microfútbol');
    const recaudadoTotal = voleibol.recaudado + microfutbol.recaudado;
    const premioTotal = voleibol.premio + microfutbol.premio;
    const gananciaTotal = voleibol.ganancia + microfutbol.ganancia;

    return {
      voleibol,
      microfutbol,
      recaudadoTotal,
      premioTotal,
      gananciaTotal,
      totalEquipos: voleibol.equipos + microfutbol.equipos,
      pendientesPago: voleibol.pendientesPago + microfutbol.pendientesPago,
    };
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
            { id: 'finanzas', label: 'Finanzas', count: null, icon: '💰' },
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
              {tab.count !== null && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.count}
              </span>
              )}
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

      {activeTab === 'finanzas' ? (
        <FinanzasPanel
          voleibol={stats.voleibol}
          microfutbol={stats.microfutbol}
          recaudadoTotal={stats.recaudadoTotal}
          premioTotal={stats.premioTotal}
          gananciaTotal={stats.gananciaTotal}
          totalEquipos={stats.totalEquipos}
          pendientesPago={stats.pendientesPago}
        />
      ) : activeTab === 'individuales' ? (
        <IndividualesPanel
          individuales={individuales}
          onRefresh={fetchData}
          onRequestDelete={(item) => {
            setDeleteError('');
            setPendingDelete({ type: 'individual', item });
          }}
        />
      ) : (
      <>
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-500">M / F</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500">Abonado</th>
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
                      <button
                        type="button"
                        onClick={() => {
                          setEditRosterOnOpen(true);
                          setSelected(ins);
                        }}
                        className="inline-flex flex-col items-center gap-0.5"
                        title="Editar plantilla"
                      >
                        <span className="inline-flex items-center justify-center w-7 h-7 bg-gray-100 rounded-full text-xs font-bold text-gray-700">
                          {ins.totalJugadores}
                        </span>
                        {ins.totalJugadores < MINIMOS[ins.disciplina] && (
                          <span className="text-[10px] font-semibold text-amber-700">Incompleta</span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const masc = ins.jugadores.filter((j) => j.genero === 'Masculino').length;
                        const fem = ins.jugadores.filter((j) => j.genero === 'Femenino').length;
                        return (
                          <div className="flex gap-1">
                            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">♂{masc}</span>
                            <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">♀{fem}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPaymentEdit(ins)}
                        className="inline-flex flex-col items-end gap-0.5 group"
                        title="Revisar comprobante y ajustar monto"
                      >
                        <span className="font-semibold text-gray-900 group-hover:text-emerald-700">
                          {formatCOP(ins.totalPagarCOP)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            ins.pagoVerificado
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {ins.pagoVerificado ? 'Verificado' : 'Por revisar'}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(ins.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditRosterOnOpen(false);
                            setSelected(ins);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                          title="Ver / editar equipo"
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
                        <button
                          type="button"
                          onClick={() => setPaymentEdit(ins)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                          title="Revisar pago"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError('');
                            setPendingDelete({ type: 'equipo', item: ins });
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                          title="Eliminar equipo"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <PlayerModal
          key={`${selected.id}-${editRosterOnOpen ? 'edit' : 'view'}`}
          inscripcion={selected}
          onClose={() => {
            setSelected(null);
            setEditRosterOnOpen(false);
          }}
          onUpdateTotal={handleUpdateTotal}
          onReviewPayment={() => setPaymentEdit(selected)}
          onUpdateRoster={handleUpdateRoster}
          startEditingRoster={editRosterOnOpen}
        />
      )}
      {paymentEdit && (
        <PaymentReviewModal
          inscripcion={paymentEdit}
          onClose={() => setPaymentEdit(null)}
          onSave={handleUpdateTotal}
        />
      )}
      </>
      )}
      {pendingDelete && (
        <ConfirmDeleteModal
          title={pendingDelete.type === 'equipo' ? 'Eliminar equipo' : 'Eliminar inscripción'}
          description={
            pendingDelete.type === 'equipo' ? (
              <>
                Se eliminará el equipo{' '}
                <strong className="text-gray-900">{pendingDelete.item.equipoNombre}</strong>
                {' '}({pendingDelete.item.totalJugadores} jugador
                {pendingDelete.item.totalJugadores !== 1 ? 'es' : ''}) y no se podrá recuperar.
              </>
            ) : (
              <>
                Se eliminará a{' '}
                <strong className="text-gray-900">{pendingDelete.item.nombre}</strong>
                {' '}de la lista individual y no se podrá recuperar.
              </>
            )
          }
          loading={deleting}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            if (deleting) return;
            setPendingDelete(null);
            setDeleteError('');
          }}
        />
      )}
    </div>
  );
}
