import { Timestamp } from 'firebase/firestore';

export type Disciplina = 'Voleibol' | 'Microfútbol';
export type FechaTorneo = '2026-08-22' | '2026-08-23';

export interface Capitan {
  nombre: string;
  documento: string;
  telefono: string;
  email: string;
}

export interface Jugador {
  id: string;
  nombre: string;
  documento: string;
  esCapitan: boolean;
}

export interface Inscripcion {
  id?: string;
  equipoNombre: string;
  disciplina: Disciplina;
  fechaTorneo: FechaTorneo;
  capitan: Capitan;
  jugadores: Jugador[];
  totalJugadores: number;
  totalPagarCOP: number;
  comprobanteUrl: string;
  reglamentoAceptado: boolean;
  createdAt?: Timestamp;
}

export interface JugadorFormField {
  nombre: string;
  documento: string;
}

export interface FormValues {
  equipoNombre: string;
  disciplina: Disciplina;
  capitan: Capitan;
  jugadores: JugadorFormField[];
  reglamentoAceptado: boolean;
}
