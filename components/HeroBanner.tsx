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
        <a
          href="https://maps.app.goo.gl/Lf45ko5k6eujYWK6A"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-emerald-200 hover:text-white text-lg mb-4 transition-colors group"
        >
          <span>📍</span>
          <span className="group-hover:underline">Carrera 56, Provivienda Oriental, Bogotá</span>
          <svg
            className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <span className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur rounded-full px-5 py-2 text-sm font-medium">
            🏐 Voleibol · Sáb. 22 Ago 2026
          </span>
          <span className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur rounded-full px-5 py-2 text-sm font-medium">
            ⚽ Microfútbol · Dom. 23 Ago 2026
          </span>
        </div>
        <p className="mt-4 text-emerald-400 text-xs">
          Coordinadores: Dimas Mendoza &amp; Jefferson Morales
        </p>
        <p className="mt-3 mx-auto max-w-md text-emerald-100/90 text-xs leading-relaxed">
          Reserva el cupo de tu equipo con $10.000 del capitán. No necesitas reunir ni pagar a todo el equipo ahora. El pago no es reembolsable.
        </p>
        <p className="mt-2 mx-auto max-w-md text-emerald-200/80 text-xs leading-relaxed">
          Este torneo es un espacio de integración y sana convivencia. No se admiten jugadores piratas ni semiprofesionales.
        </p>
      </div>
    </div>
  );
}
