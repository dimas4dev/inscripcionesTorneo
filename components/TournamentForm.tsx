'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Disciplina, Genero, FormValues } from '@/lib/types';

const PRECIO_POR_JUGADOR = 10_000;
const MINIMOS: Record<Disciplina, number> = { Voleibol: 6, 'Microfútbol': 5 };
const FECHAS: Record<Disciplina, string> = {
  Voleibol: '2026-08-22',
  'Microfútbol': '2026-08-23',
};

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
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

interface SubmittedData {
  equipoNombre: string;
  disciplina: Disciplina;
  totalJugadores: number;
  totalPagarCOP: number;
}

export default function TournamentForm() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<SubmittedData | null>(null);
  const [submitError, setSubmitError] = useState('');
  const isFirstRender = useRef(true);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      disciplina: 'Voleibol',
      jugadores: Array.from({ length: 5 }, () => ({ nombre: '', documento: '', genero: 'Masculino' as Genero })),
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'jugadores' });

  const disciplina = watch('disciplina');
  const capitanNombre = watch('capitan.nombre');

  const minAdicionales = MINIMOS[disciplina] - 1;
  const totalJugadores = 1 + fields.length;
  const totalPagar = totalJugadores * PRECIO_POR_JUGADOR;

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const requiredCount = MINIMOS[disciplina] - 1;
    const currentCount = fields.length;
    if (currentCount < requiredCount) {
      for (let i = currentCount; i < requiredCount; i++) {
        append({ nombre: '', documento: '', genero: 'Masculino' }, { shouldFocus: false });
      }
    }
  }, [disciplina]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadComprobante = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        reject(new Error('Configuración de Cloudinary incompleta.'));
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', 'torneo-agape-2026/comprobantes');

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } else {
          reject(new Error('Error al subir el comprobante a Cloudinary.'));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Error de red al subir el comprobante.')));

      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/upload`);
      xhr.send(formData);
    });
  };

  const onSubmit = async (data: FormValues) => {
    if (!comprobanteFile) {
      setSubmitError('Por favor adjunta el comprobante de pago.');
      return;
    }
    if (comprobanteFile.size > 5 * 1024 * 1024) {
      setSubmitError('El archivo es demasiado grande. Máximo 5MB.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const comprobanteUrl = await uploadComprobante(comprobanteFile);

      const jugadores = [
        { id: generateId(), nombre: data.capitan.nombre, documento: data.capitan.documento, esCapitan: true, genero: data.capitan.genero },
        ...data.jugadores.map((j) => ({ id: generateId(), nombre: j.nombre, documento: j.documento, esCapitan: false, genero: j.genero })),
      ];

      await addDoc(collection(db, 'inscripciones'), {
        equipoNombre: data.equipoNombre,
        disciplina: data.disciplina,
        fechaTorneo: FECHAS[data.disciplina],
        capitan: data.capitan,
        jugadores,
        totalJugadores: jugadores.length,
        totalPagarCOP: jugadores.length * PRECIO_POR_JUGADOR,
        comprobanteUrl,
        reglamentoAceptado: data.reglamentoAceptado,
        createdAt: serverTimestamp(),
      });

      setSubmittedData({
        equipoNombre: data.equipoNombre,
        disciplina: data.disciplina,
        totalJugadores: jugadores.length,
        totalPagarCOP: jugadores.length * PRECIO_POR_JUGADOR,
      });
      reset();
      setComprobanteFile(null);
      setUploadProgress(0);
      isFirstRender.current = true;
    } catch (err) {
      console.error(err);
      setSubmitError('Ocurrió un error al enviar la inscripción. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedData) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">¡Inscripción Exitosa!</h2>
          <p className="text-gray-500 mb-6">
            El equipo <strong className="text-gray-800">{submittedData.equipoNombre}</strong> quedó inscrito en{' '}
            <strong className="text-emerald-700">{submittedData.disciplina}</strong>.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm text-gray-700 space-y-1">
            <div className="flex justify-between">
              <span>Jugadores registrados</span>
              <strong>{submittedData.totalJugadores}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total a pagar</span>
              <strong className="text-emerald-700">{formatCOP(submittedData.totalPagarCOP)}</strong>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-6">
            Nos pondremos en contacto con el capitán para confirmar los detalles del torneo. ¡Nos vemos el{' '}
            {submittedData.disciplina === 'Voleibol' ? 'sábado 22' : 'domingo 23'} de agosto!
          </p>
          <button
            onClick={() => setSubmittedData(null)}
            className="w-full bg-emerald-600 text-white rounded-xl py-3 font-semibold hover:bg-emerald-700 transition-colors"
          >
            Registrar otro equipo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* ── 1. Disciplina ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">1. Selecciona la Disciplina</h2>
          <p className="text-sm text-gray-500 mb-4">Cada disciplina tiene fecha, mínimo de jugadores y modalidad diferente.</p>
          <div className="grid grid-cols-2 gap-4">
            {(['Voleibol', 'Microfútbol'] as Disciplina[]).map((d) => (
              <label
                key={d}
                className={`relative cursor-pointer rounded-xl border-2 p-5 flex flex-col items-center gap-2 transition-all ${
                  disciplina === d
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input type="radio" value={d} {...register('disciplina')} className="sr-only" />
                <span className="text-4xl">{d === 'Voleibol' ? '🏐' : '⚽'}</span>
                <span className="font-bold text-gray-900 text-base">{d}</span>
                <span className="text-xs text-center text-gray-500">
                  {d === 'Voleibol' ? 'Sáb. 22 Ago · Mín. 6 jug.' : 'Dom. 23 Ago · Mín. 5 jug.'}
                </span>
                <span className={`text-xs text-center font-semibold px-2 py-0.5 rounded-full ${
                  d === 'Voleibol'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {d === 'Voleibol' ? '👫 Mixto' : '👨 Solo masculino'}
                </span>
                {disciplina === d && (
                  <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </label>
            ))}
          </div>
          {/* Aviso de regla mixta para Voleibol */}
          {disciplina === 'Voleibol' && (
            <div className="mt-4 flex gap-3 p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
              <span className="text-lg flex-shrink-0">👫</span>
              <div>
                <p className="font-semibold mb-0.5">Torneo Mixto — Regla de género en cancha</p>
                <p className="leading-relaxed">
                  En todo momento debe haber al menos <strong>1 jugador/a del sexo opuesto</strong> en la cancha.
                  Ejemplo: si hay 5 hombres en el court, debe haber mínimo 1 mujer; si hay 5 mujeres, debe haber mínimo 1 hombre.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── 2. Nombre del Equipo ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">2. Nombre del Equipo</h2>
          <input
            type="text"
            placeholder="Ej: Los Campeones FC"
            {...register('equipoNombre', {
              required: 'Ingresa el nombre del equipo',
              minLength: { value: 3, message: 'Mínimo 3 caracteres' },
            })}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition"
          />
          {errors.equipoNombre && (
            <p className="text-red-500 text-sm mt-1.5">{errors.equipoNombre.message}</p>
          )}
        </section>

        {/* ── 3. Datos del Capitán ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">3. Datos del Capitán</h2>
          <p className="text-sm text-gray-500 mb-4">El capitán cuenta como jugador en el total.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo *</label>
              <input
                type="text"
                {...register('capitan.nombre', { required: 'Requerido' })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
              />
              {errors.capitan?.nombre && (
                <p className="text-red-500 text-xs mt-1">{errors.capitan.nombre.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Número de documento *</label>
              <input
                type="text"
                {...register('capitan.documento', { required: 'Requerido' })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
              />
              {errors.capitan?.documento && (
                <p className="text-red-500 text-xs mt-1">{errors.capitan.documento.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp *</label>
              <input
                type="tel"
                placeholder="+57 300 000 0000"
                {...register('capitan.telefono', { required: 'Requerido' })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
              />
              {errors.capitan?.telefono && (
                <p className="text-red-500 text-xs mt-1">{errors.capitan.telefono.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico *</label>
              <input
                type="email"
                {...register('capitan.email', {
                  required: 'Requerido',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo inválido' },
                })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
              />
              {errors.capitan?.email && (
                <p className="text-red-500 text-xs mt-1">{errors.capitan.email.message}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Género *</label>
              <GenderToggle
                value={watch('capitan.genero') ?? 'Masculino'}
                onChange={(g) => setValue('capitan.genero', g)}
              />
            </div>
          </div>
        </section>

        {/* ── 4. Jugadores ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-gray-900">4. Jugadores</h2>
            <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
              {totalJugadores} · {formatCOP(totalPagar)}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Mínimo <strong>{MINIMOS[disciplina]}</strong> jugadores para {disciplina}. Los suplentes opcionales también pagan $10.000 c/u.
          </p>
          {disciplina === 'Voleibol' && (
            <div className="mb-4 flex gap-2.5 p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-700 leading-relaxed">
              <span className="flex-shrink-0">👫</span>
              <span>
                <strong>Torneo Mixto:</strong> Registra jugadores y jugadoras. Recuerda que en cancha siempre debe haber al menos 1 persona del sexo opuesto a la mayoría.
              </span>
            </div>
          )}
          {disciplina === 'Microfútbol' && (
            <div className="mb-4 flex gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 leading-relaxed">
              <span className="flex-shrink-0">👨</span>
              <span>
                <strong>Solo masculino:</strong> Esta categoría es exclusivamente para jugadores hombres.
              </span>
            </div>
          )}

          {/* Capitán (slot fijo) */}
          <div className="mb-3 flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <span className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              C
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {capitanNombre || <span className="text-gray-400 font-normal">Capitán (completa la sección 3)</span>}
              </p>
              <p className="text-xs text-emerald-600 font-medium">Capitán · Jugador #1</p>
            </div>
          </div>

          {/* Jugadores adicionales */}
          <div className="space-y-2.5">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start">
                <span className="w-8 h-8 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-3">
                  {index + 2}
                </span>
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="text"
                        placeholder="Nombre completo"
                        {...register(`jugadores.${index}.nombre`, { required: true })}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition"
                      />
                      {errors.jugadores?.[index]?.nombre && (
                        <p className="text-red-500 text-xs mt-0.5">Requerido</p>
                      )}
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="N° Documento"
                        {...register(`jugadores.${index}.documento`, { required: true })}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition"
                      />
                      {errors.jugadores?.[index]?.documento && (
                        <p className="text-red-500 text-xs mt-0.5">Requerido</p>
                      )}
                    </div>
                  </div>
                  <GenderToggle
                    value={(watch(`jugadores.${index}.genero`) as Genero) ?? 'Masculino'}
                    onChange={(g) => setValue(`jugadores.${index}.genero`, g)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length <= minAdicionales}
                  className="mt-2.5 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-25 disabled:cursor-not-allowed"
                  title="Eliminar jugador"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => append({ nombre: '', documento: '', genero: 'Masculino' })}
            className="mt-4 w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar jugador suplente
          </button>

          {(() => {
            const allPlayers = [
              { genero: watch('capitan.genero') ?? 'Masculino' },
              ...fields.map((_, i) => ({ genero: watch(`jugadores.${i}.genero`) ?? 'Masculino' })),
            ];
            const masculinos = allPlayers.filter((p) => p.genero === 'Masculino').length;
            const femeninos = allPlayers.filter((p) => p.genero === 'Femenino').length;
            return (
              <div className="mt-3 flex gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full">
                  ♂ {masculinos} {masculinos === 1 ? 'hombre' : 'hombres'}
                </span>
                <span className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-full">
                  ♀ {femeninos} {femeninos === 1 ? 'mujer' : 'mujeres'}
                </span>
              </div>
            );
          })()}

          <div className="mt-3 flex justify-between items-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
            <span className="text-sm text-gray-600">
              {totalJugadores} jugadores × $10.000 COP
            </span>
            <span className="text-base font-extrabold text-emerald-700">{formatCOP(totalPagar)}</span>
          </div>
        </section>

        {/* ── 5. Comprobante de Pago ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">5. Comprobante de Pago</h2>
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <p className="font-semibold mb-1">💳 Realiza tu pago por {formatCOP(totalPagar)}</p>
            <p>
              Transfiere al medio de pago indicado por los coordinadores (Nequi / Daviplata / cuenta bancaria)
              y adjunta el screenshot o foto del comprobante.
            </p>
          </div>
          <label
            className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition ${
              comprobanteFile
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
            }`}
          >
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setComprobanteFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
            {comprobanteFile ? (
              <div className="text-center px-4">
                <svg className="w-9 h-9 text-emerald-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-emerald-700 truncate max-w-xs">{comprobanteFile.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Toca para cambiar el archivo</p>
              </div>
            ) : (
              <div className="text-center px-4">
                <svg className="w-9 h-9 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-500">Sube el screenshot o foto del pago</p>
                <p className="text-xs text-gray-400 mt-0.5">JPG, PNG o PDF · Máx. 5 MB</p>
              </div>
            )}
          </label>

          {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Subiendo comprobante…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* ── 6. Reglamento ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">6. Reglamento de Convivencia</h2>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-2 mb-4 leading-relaxed">
            <p>✅ Respeto absoluto hacia todos los participantes, árbitros y espectadores.</p>
            <p>🚫 Cero groserías ni lenguaje ofensivo durante toda la jornada.</p>
            <p>🚫 Cero consumo de alcohol antes o durante el evento.</p>
            <p>🙏 Este es un evento de El Ministerio Ordóñez — promovemos la sana convivencia.</p>
            {disciplina === 'Voleibol' && (
              <p className="pt-1 border-t border-gray-200">
                👫 <strong>Voleibol Mixto:</strong> En cancha siempre debe haber mínimo 1 jugador/a del sexo opuesto a la mayoría. Incumplir esta regla puede resultar en descalificación del punto o del set.
              </p>
            )}
            {disciplina === 'Microfútbol' && (
              <p className="pt-1 border-t border-gray-200">
                👨 <strong>Microfútbol:</strong> Categoría exclusivamente masculina.
              </p>
            )}
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('reglamentoAceptado', {
                required: 'Debes aceptar el reglamento para continuar',
              })}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 flex-shrink-0"
            />
            <span className="text-sm text-gray-700">
              Confirmo que he leído y acepto el reglamento de convivencia del Torneo Ágape 2026 para todos los
              miembros de mi equipo.
            </span>
          </label>
          {errors.reglamentoAceptado && (
            <p className="text-red-500 text-sm mt-2">{errors.reglamentoAceptado.message}</p>
          )}
        </section>

        {/* Error global */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            ⚠️ {submitError}
          </div>
        )}

        {/* Botón submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-extrabold rounded-2xl py-4 text-lg transition-colors shadow-lg shadow-emerald-200/60 flex items-center justify-center gap-3"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Registrando equipo…
            </>
          ) : (
            `Inscribir Equipo — ${formatCOP(totalPagar)}`
          )}
        </button>

        <p className="text-center text-xs text-gray-400 pb-8">
          Al enviar este formulario aceptas el tratamiento de tus datos personales con fines exclusivos del torneo.
        </p>
      </form>
    </div>
  );
}
