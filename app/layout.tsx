import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { PRECIO_POR_JUGADOR_COP, formatCOP } from "@/lib/constants";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://inscripcionestorneo.vercel.app";

export const metadata: Metadata = {
  title: "Torneo Ágape 2026 — Inscripciones",
  description:
    "Reserva el cupo de tu equipo en el Torneo Ágape 2026. ⚽ Fútbol 5 · masculino o mixto. El Ministerio Ordóñez.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "⚡ Torneo Ágape 2026 — ¡Inscribe tu equipo!",
    description:
      `${formatCOP(PRECIO_POR_JUGADOR_COP)} por persona · reserva el cupo de tu equipo`,
    url: BASE_URL,
    siteName: "Torneo Ágape 2026",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Torneo Ágape 2026 — Fútbol 5",
      },
    ],
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "⚡ Torneo Ágape 2026 — ¡Inscribe tu equipo!",
    description:
      "⚽ Fútbol 5 · masculino o mixto · El Ministerio Ordóñez",
    images: [`${BASE_URL}/og-image.png`],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
