export const PRECIO_POR_JUGADOR_COP = 25_000;
export const CAMBIOS_POR_EQUIPO = 1;

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}
