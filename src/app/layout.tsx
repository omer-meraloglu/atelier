import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const ui = Instrument_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Atelier — Virtual Try-On Studio",
    template: "%s — Atelier",
  },
  description:
    "An AI virtual try-on studio for fashion. Dress your models, compare providers, set looks in motion.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${ui.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              borderRadius: "2px",
              border: "1px solid var(--hairline)",
              background: "var(--bone-raised)",
              color: "var(--ink)",
              fontSize: "0.8125rem",
            },
          }}
        />
      </body>
    </html>
  );
}
