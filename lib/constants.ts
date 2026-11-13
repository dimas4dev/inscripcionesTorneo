import type { Disciplina } from './types';
import { isFutbol5 } from './types';

export const PRECIO_POR_JUGADOR_COP = 25_000;
/** Valor total de la inscripción del equipo al torneo. */
export const INSCRIPCION_TORNEO_COP = 200_000;
/** Mitad de la inscripción: monto para asegurar el cupo. */
export const PAGO_INSCRIPCION_MITAD_COP = INSCRIPCION_TORNEO_COP / 2;
export const SALDO_INSCRIPCION_COP = INSCRIPCION_TORNEO_COP - PAGO_INSCRIPCION_MITAD_COP;
/** Campeón, subcampeón y tercer lugar del Torneo Relámpago. */
export const PREMIOS_TORNEO = [
  { lugar: 'Campeón', montoCOP: 400_000 },
  { lugar: 'Subcampeón', montoCOP: 200_000 },
  { lugar: 'Tercer lugar', montoCOP: 100_000 },
] as const;
/** Suma de los tres premios de Fútbol 5. */
export const PREMIO_FUTBOL5_COP = PREMIOS_TORNEO.reduce((total, premio) => total + premio.montoCOP, 0);
/** @deprecated Usar PREMIOS_TORNEO. Conserva el premio del campeón. */
export const PREMIO_TORNEO_COP = PREMIOS_TORNEO[0].montoCOP;
/** Voleibol (finalizado): premio = 30% del recaudado de ese torneo. */
export const PREMIO_VOLEIBOL_PORCENTAJE = 0.3;
/** Suplentes por equipo en Fútbol 5. */
export const CAMBIOS_POR_EQUIPO = 3;
/** Llave Bre-B para el abono de la inscripción. */
export const LLAVE_BREB = '3204371585';

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

/** "Campeón $400.000, Subcampeón $200.000 y Tercer lugar $100.000" */
export function textoPremiosTorneo(): string {
  const partes = PREMIOS_TORNEO.map((premio) => `${premio.lugar} ${formatCOP(premio.montoCOP)}`);
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}
