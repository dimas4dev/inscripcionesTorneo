import { PRECIO_POR_JUGADOR_COP, INSCRIPCION_TORNEO_COP, PAGO_INSCRIPCION_MITAD_COP, PREMIO_TORNEO_COP, CAMBIOS_POR_EQUIPO, formatCOP, MINIMOS, getMaximoJugadores, getUmbralPagoMitad } from '@/lib/constants';

export default function HeroBanner() {
  return (
    <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-900 text-white py-10 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <p className="text-emerald-300 text-xs font-bold tracking-widest uppercase mb-3">
          El Ministerio Ordóñez
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3">
          ⚡ Torneo Ágape 2026
        </h1>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <span className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur rounded-full px-5 py-2 text-sm font-medium opacity-70">
            🏐 Voleibol · Finalizado
          </span>
          <span className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur rounded-full px-5 py-2 text-sm font-medium">
            ⚽ Fútbol 5 · masculino o mixto
          </span>
        </div>
        <p className="mt-4 text-emerald-400 text-xs">
          Coordinadores: Nicolás Mantilla, Jeronimo Roa y Lina Umaña
        </p>
        <p className="mt-3 mx-auto max-w-md text-emerald-100/90 text-xs leading-relaxed">
          🏆 Premio al campeón: {formatCOP(PREMIO_TORNEO_COP)}. Inscripción del torneo: {formatCOP(INSCRIPCION_TORNEO_COP)} por equipo ({formatCOP(PRECIO_POR_JUGADOR_COP)} por persona). Plantilla máxima de {getMaximoJugadores('Fútbol 5')} jugadores ({MINIMOS['Fútbol 5']} en cancha + {CAMBIOS_POR_EQUIPO} cambio). Inscríbete en modalidad masculina o mixta con al menos {getUmbralPagoMitad('Fútbol 5')} jugadores y abona el 50% ({formatCOP(PAGO_INSCRIPCION_MITAD_COP)}). No es reembolsable.
        </p>
        <p className="mt-2 mx-auto max-w-md text-emerald-200/80 text-xs leading-relaxed">
          Este torneo es un espacio de integración y sana convivencia. No se admiten jugadores piratas ni semiprofesionales.
        </p>
      </div>
    </div>
  );
}
