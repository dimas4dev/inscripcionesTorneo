import { Timestamp } from 'firebase/firestore';

export type Disciplina = 'Voleibol' | 'Microfútbol';
export type FechaTorneo = '2026-08-22' | '2026-08-23';
export type Genero = 'Masculino' | 'Femenino';

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
  disciplina: Disciplina;
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
  disciplina: Disciplina;
  genero: Genero;
  createdAt?: Timestamp;
}
