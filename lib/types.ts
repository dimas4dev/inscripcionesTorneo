import { Timestamp } from 'firebase/firestore';

export type Disciplina = 'Voleibol' | 'Fútbol 5';
export type DisciplinaStored = Disciplina | 'Microfútbol';
export type FechaTorneo = '2026-08-22' | '2026-08-23';
export type Genero = 'Masculino' | 'Femenino';
export type Modalidad = 'Masculino' | 'Mixto';

export const DISCIPLINA_FUTBOL_5: Disciplina = 'Fútbol 5';

export function isFutbol5(disciplina: string): boolean {
  return disciplina === 'Fútbol 5' || disciplina === 'Microfútbol';
}

export function disciplinaLabel(disciplina: string): string {
  if (disciplina === 'Microfútbol') return 'Fútbol 5';
  return disciplina;
}

export function modalidadLabel(modalidad?: Modalidad): string {
  if (modalidad === 'Mixto') return 'Mixto';
  return 'Masculino';
}

export interface Capitan {
  nombre: string;
  documento: string;
  telefono: string;
  email: string;
  genero: Genero;
}

export interface Jugador {
  id: string;
  nombre: string;
  documento: string;
  esCapitan: boolean;
  genero: Genero;
}

export interface ComprobantePago {
  id: string;
  url: string;
  nota?: string;
}

export interface Inscripcion {
  id?: string;
  equipoNombre: string;
  disciplina: DisciplinaStored;
  modalidad?: Modalidad;
  fechaTorneo: FechaTorneo;
  capitan: Capitan;
  jugadores: Jugador[];
  totalJugadores: number;
  totalPagarCOP: number;
  comprobanteUrl: string;
  comprobantes?: ComprobantePago[];
  reglamentoAceptado: boolean;
  reservaCupo?: boolean;
  reservaNoReembolsableAceptada?: boolean;
  equipoCompletoAlInscribir?: boolean;
  montoOriginalCOP?: number;
  pagoVerificado?: boolean;
  createdAt?: Timestamp;
}

export interface JugadorFormField {
  nombre: string;
  documento: string;
  genero: Genero;
}

export interface FormValues {
  equipoNombre: string;
  disciplina: Disciplina;
  modalidad: Modalidad;
  capitan: Capitan;
  jugadores: JugadorFormField[];
  reglamentoAceptado: boolean;
  reservaNoReembolsableAceptada: boolean;
}

export interface Individual {
  id?: string;
  nombre: string;
  documento: string;
  telefono: string;
  email: string;
  disciplina: DisciplinaStored;
  modalidad?: Modalidad;
  genero: Genero;
  createdAt?: Timestamp;
}
