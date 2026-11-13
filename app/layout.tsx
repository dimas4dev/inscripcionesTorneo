import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { INSCRIPCION_TORNEO_COP, PAGO_INSCRIPCION_MITAD_COP, formatCOP } from "@/lib/constants";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://inscripcionestorneo.vercel.app";

export const metadata: Metadata = {
  title: "Torneo Relámpago — Inscripciones",
  description:
    "Inscribe tu equipo en el Torneo Relámpago. ⚽ Fútbol 5 · masculino. Pastores Gómez.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "⚡ Torneo Relámpago — ¡Inscribe tu equipo!",
    description:
      `${formatCOP(INSCRIPCION_TORNEO_COP)} inscripción por equipo · se asegura con ${formatCOP(PAGO_INSCRIPCION_MITAD_COP)}`,
    url: BASE_URL,
    siteName: "Torneo Relámpago",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Torneo Relámpago — Fútbol 5",
      },
    ],
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "⚡ Torneo Relámpago — ¡Inscribe tu equipo!",
    description:
      "⚽ Fútbol 5 · masculino · Pastores Gómez",
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
