import type { Disciplina } from './types';
import { isFutbol5 } from './types';

export const PRECIO_POR_JUGADOR_COP = 25_000;
/** Valor total de la inscripción del equipo al torneo. */
export const INSCRIPCION_TORNEO_COP = 125_000;
/** 50% de la inscripción — monto a abonar al inscribirse. */
export const PAGO_INSCRIPCION_MITAD_COP = INSCRIPCION_TORNEO_COP / 2;
export const SALDO_INSCRIPCION_COP = INSCRIPCION_TORNEO_COP - PAGO_INSCRIPCION_MITAD_COP;
/** Premio fijo del torneo de Fútbol 5 para el equipo campeón. */
export const PREMIO_FUTBOL5_COP = 500_000;
/** @deprecated Usar PREMIO_FUTBOL5_COP */
export const PREMIO_TORNEO_COP = PREMIO_FUTBOL5_COP;
/** Voleibol (finalizado): premio = 30% del recaudado de ese torneo. */
export const PREMIO_VOLEIBOL_PORCENTAJE = 0.3;
export const CAMBIOS_POR_EQUIPO = 1;

export const MINIMOS: Record<Disciplina, number> = { Voleibol: 6, 'Fútbol 5': 5 };
export const MAXIMOS: Record<Disciplina, number> = {
  Voleibol: 6,
  'Fútbol 5': MINIMOS['Fútbol 5'] + CAMBIOS_POR_EQUIPO,
};

export function getMinimoJugadores(disciplina: string): number {
  if (isFutbol5(disciplina)) return MINIMOS['Fútbol 5'];
  return MINIMOS.Voleibol;
}

export function getMaximoJugadores(disciplina: string): number {
  if (isFutbol5(disciplina)) return MAXIMOS['Fútbol 5'];
  return MAXIMOS.Voleibol;
}

/** Más de la mitad de la plantilla máxima (6 → desde 3 jugadores). */
export function getUmbralPagoMitad(disciplina: string): number {
  return Math.ceil(getMaximoJugadores(disciplina) / 2);
}

export function calificaPagoMitad(totalJugadores: number, disciplina: Disciplina): boolean {
  return totalJugadores >= getUmbralPagoMitad(disciplina);
}

/** Abono de inscripción: siempre el 50% del valor del torneo. */
export function calcularPagoInscripcion(_totalJugadores?: number, _disciplina?: Disciplina): number {
  return PAGO_INSCRIPCION_MITAD_COP;
}

/** @deprecated Usar calificaPagoMitad */
export function esEquipoCompleto(totalJugadores: number, disciplina: Disciplina): boolean {
  return calificaPagoMitad(totalJugadores, disciplina);
}

/** Premio y ganancia según la disciplina (voleibol: 30%; fútbol 5: premio fijo). */
export function calcularFinanzasTorneo(
  recaudado: number,
  disciplina: Disciplina
): { premio: number; ganancia: number } {
  if (disciplina === 'Voleibol') {
    const premio = Math.round(recaudado * PREMIO_VOLEIBOL_PORCENTAJE);
    return { premio, ganancia: recaudado - premio };
  }
  return {
    premio: PREMIO_FUTBOL5_COP,
    ganancia: recaudado - PREMIO_FUTBOL5_COP,
  };
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}
