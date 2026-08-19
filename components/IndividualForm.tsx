'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Disciplina, Genero } from '@/lib/types';

const MINIMOS: Record<Disciplina, number> = { Voleibol: 6, 'Microfútbol': 5 };

interface IndividualFormValues {
  nombre: string;
  documento: string;
  telefono: string;
  email: string;
  disciplina: Disciplina;
  genero: Genero;
  reglamentoAceptado: boolean;
}

export default function IndividualForm() {
  const [submitting, setSubmitting] = useState(false);
  const [submittedDisciplina, setSubmittedDisciplina] = useState<Disciplina | null>(null);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<IndividualFormValues>({
    defaultValues: { disciplina: 'Voleibol', genero: 'Masculino' },
  });

  const disciplina = watch('disciplina');
  const genero = watch('genero');

  const onSubmit = async (data: IndividualFormValues) => {
    setSubmitting(true);
    setError('');
    try {
      await addDoc(collection(db, 'individuales'), {
        nombre: data.nombre,
        documento: data.documento,
        telefono: data.telefono,
        email: data.email,
        disciplina: data.disciplina,
        genero: data.genero,
        reglamentoAceptado: data.reglamentoAceptado,
        createdAt: serverTimestamp(),
      });
      setSubmittedDisciplina(data.disciplina);
      reset();
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error. Por favor intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedDisciplina) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">¡Anotado en la lista!</h2>
          <p className="text-gray-500 mb-5">
            Quedaste en la lista individual de{' '}
            <strong className="text-purple-700">{submittedDisciplina}</strong>.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800 text-left space-y-2">
            <p className="font-semibold">📋 ¿Qué sigue?</p>
            <p>
              Los coordinadores están reuniendo participantes individuales. Si se completa el cupo mínimo de{' '}
              <strong>{MINIMOS[submittedDisciplina]} personas</strong> para {submittedDisciplina}, te contactarán
              por WhatsApp para confirmar tu participación y coordinar el pago de $10.000 COP.
            </p>
            <p className="text-amber-700">
              ⚠️ Si el cupo no se completa, no hay costo alguno.
            </p>
          </div>
          <button
            onClick={() => setSubmittedDisciplina(null)}
            className="w-full bg-purple-600 text-white rounded-xl py-3 font-semibold hover:bg-purple-700 transition-colors"
          >
            Registrar otra persona
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      {/* Aviso explicativo */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <h3 className="font-bold text-amber-900 mb-2 text-base">
          📋 ¿Cómo funciona la inscripción individual?
        </h3>
        <ul className="text-sm text-amber-800 space-y-1.5 leading-relaxed list-none">
          <li>
            <strong>1.</strong> Te anotas en la lista de tu disciplina preferida.
          </li>
          <li>
            <strong>2.</strong> Los coordinadores reúnen a los individuales y forman equipos cuando hay cupo
            suficiente ({MINIMOS.Voleibol} para Voleibol · {MINIMOS['Microfútbol']} para Microfútbol).
          </li>
          <li>
            <strong>3.</strong> Si el cupo se completa, te contactan por WhatsApp para confirmar y pagar ($10.000 COP).
          </li>
          <li>
            <strong>4.</strong> Si no se completa el cupo, no hay ningún costo — simplemente no participas.
          </li>
        </ul>
        <p className="mt-3 text-xs font-semibold text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
          ⚠️ La inscripción individual <u>no garantiza participación</u>. Solo confirma tu interés y te pone en la lista.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Disciplina */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">1. ¿En qué disciplina quieres participar?</h2>
          <div className="grid grid-cols-2 gap-4">
            {(['Voleibol', 'Microfútbol'] as Disciplina[]).map((d) => (
              <label
                key={d}
                className={`relative cursor-pointer rounded-xl border-2 p-5 flex flex-col items-center gap-2 transition-all ${
                  disciplina === d
                    ? 'border-purple-500 bg-purple-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input type="radio" value={d} {...register('disciplina')} className="sr-only" />
                <span className="text-4xl">{d === 'Voleibol' ? '🏐' : '⚽'}</span>
                <span className="font-bold text-gray-900">{d}</span>
                <span className="text-xs text-center text-gray-500">
                  {d === 'Voleibol'
                    ? `Sáb. 22 Ago · Mín. ${MINIMOS.Voleibol} jug. · Mixto`
                    : `Dom. 23 Ago · Mín. ${MINIMOS['Microfútbol']} jug. · Masculino`}
                </span>
                {disciplina === d && (
                  <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </label>
            ))}
          </div>
          {disciplina === 'Microfútbol' && (
            <p className="mt-3 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              👨 Microfútbol es exclusivamente masculino.
            </p>
          )}
          {disciplina === 'Voleibol' && (
            <p className="mt-3 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
              👫 Voleibol es mixto. En cancha debe haber mínimo 1 persona del sexo opuesto a la mayoría.
            </p>
          )}
        </section>

        {/* Datos personales */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">2. Tus Datos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo *</label>
              <input
                type="text"
                {...register('nombre', { required: 'Requerido' })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition text-sm"
              />
              {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Número de documento *</label>
              <input
                type="text"
                {...register('documento', { required: 'Requerido' })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition text-sm"
              />
              {errors.documento && <p className="text-red-500 text-xs mt-1">{errors.documento.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp *</label>
              <input
                type="tel"
                placeholder="+57 300 000 0000"
                {...register('telefono', { required: 'Requerido' })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition text-sm"
              />
              {errors.telefono && <p className="text-red-500 text-xs mt-1">{errors.telefono.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico *</label>
              <input
                type="email"
                {...register('email', {
                  required: 'Requerido',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo inválido' },
                })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition text-sm"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Género *</label>
              <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm font-semibold">
                {(['Masculino', 'Femenino'] as Genero[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setValue('genero', g)}
                    className={`flex-1 px-4 py-3 transition-colors ${
                      genero === g
                        ? g === 'Masculino'
                          ? 'bg-blue-500 text-white'
                          : 'bg-rose-500 text-white'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {g === 'Masculino' ? '♂ Masculino' : '♀ Femenino'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">3. Reglamento de Convivencia</h2>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-2 mb-4 leading-relaxed">
            <p>✅ Respeto absoluto hacia todos los participantes, árbitros y espectadores.</p>
            <p>🚫 Cero groserías ni lenguaje ofensivo durante toda la jornada.</p>
            <p>🚫 Cero consumo de alcohol antes o durante el evento.</p>
            <p>🙏 Este es un evento de El Ministerio Ordóñez — promovemos la sana convivencia.</p>
            <div className="pt-2 mt-1 border-t border-amber-200 bg-amber-50 -mx-1 px-3 py-2.5 rounded-lg text-amber-900">
              <p>
                🚫 <strong>No se admiten jugadores piratas ni semiprofesionales</strong> que vengan solo a
                competir por dinero o a imponer un nivel profesional. El Torneo Ágape es un espacio de
                integración y sana convivencia. Incumplir esta regla puede resultar en la exclusión.
              </p>
            </div>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('reglamentoAceptado', {
                required: 'Debes aceptar el reglamento para continuar',
              })}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 flex-shrink-0"
            />
            <span className="text-sm text-gray-700">
              Confirmo que he leído y acepto el reglamento, incluyendo que no soy jugador pirata ni semiprofesional.
            </span>
          </label>
          {errors.reglamentoAceptado && (
            <p className="text-red-500 text-sm mt-2">{errors.reglamentoAceptado.message}</p>
          )}
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-extrabold rounded-2xl py-4 text-lg transition-colors shadow-lg shadow-purple-200/60 flex items-center justify-center gap-3"
        >
          {submitting ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Registrando…
            </>
          ) : (
            'Anotarme en la lista individual'
          )}
        </button>

        <p className="text-center text-xs text-gray-400 pb-8">
          Al enviar aceptas el tratamiento de tus datos para fines exclusivos del torneo.
        </p>
      </form>
    </div>
  );
}
