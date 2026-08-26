import type { Disciplina } from './types';
import { isFutbol5 } from './types';

export const PRECIO_POR_JUGADOR_COP = 25_000;
/** Valor total de la inscripción del equipo al torneo. */
export const INSCRIPCION_TORNEO_COP = 125_000;
/** 50% de la inscripción — monto a abonar al inscribirse con más de la mitad de la plantilla. */
export const PAGO_INSCRIPCION_MITAD_COP = INSCRIPCION_TORNEO_COP / 2;
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

/** Reserva con solo capitán, o 50% de la inscripción del torneo si ya hay más de la mitad de la plantilla. */
export function calcularPagoInscripcion(totalJugadores: number, disciplina: Disciplina): number {
  if (calificaPagoMitad(totalJugadores, disciplina)) {
    return PAGO_INSCRIPCION_MITAD_COP;
  }
  return PRECIO_POR_JUGADOR_COP;
}

/** @deprecated Usar calificaPagoMitad */
export function esEquipoCompleto(totalJugadores: number, disciplina: Disciplina): boolean {
  return calificaPagoMitad(totalJugadores, disciplina);
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}
