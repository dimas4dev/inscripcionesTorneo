import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Torneo Ágape 2026 — Inscripciones",
  description:
    "Registra tu equipo en el Torneo Ágape 2026. Voleibol (22 Ago) y Microfútbol (23 Ago) en el Parque La Ponderosa, Bogotá. Ministerio Jahems.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
