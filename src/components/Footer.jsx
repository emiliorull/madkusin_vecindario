import React from 'react';
import { MapPin, Clock, ShieldCheck, Mic, Calendar } from 'lucide-react';

export default function Footer({ onOpenVoiceAssistant }) {
  return (
    <footer className="bg-stone-900 text-stone-300 border-t-2 border-stone-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-10 border-b border-stone-800">
          {/* Columna 1: Identidad "El Afilador del Siglo XXI" */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-12 rounded-xl bg-[#F8F4EC] border border-stone-600 p-1 flex items-center justify-center shrink-0">
                <img
                  src="/logo-madkusin.jpg"
                  alt="MadKusin"
                  className="w-full h-full object-contain mix-blend-multiply"
                />
              </div>
              <div>
                <span className="font-serif font-bold text-xl text-white block">
                  Emil · El Afilador del Siglo XXI
                </span>
                <span className="text-xs text-amber-400">vecindario.madkusin.com · CP 28224</span>
              </div>
            </div>
            <p className="text-sm text-stone-400 leading-relaxed">
              Afilado profesional de alta precisión con afilador de banda y strop, absolutamente
              respetuoso con el temple del acero y diseñado para no sobrecalentar nunca la hoja.
              Exclusivo para hogares del código postal 28224 (Pozuelo de Alarcón).
            </p>
          </div>

          {/* Columna 2: Horario y Reglas */}
          <div className="space-y-3 text-sm">
            <h3 className="font-bold text-white uppercase tracking-wider text-xs">
              Horario y Condiciones en el 28224
            </h3>
            <ul className="space-y-2 text-stone-300">
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Lunes a Viernes de 10:00 a 13:00 h</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Exclusivo residentes CP 28224 (Pozuelo de Alarcón)</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Privacidad total: nunca pedimos tu teléfono</span>
              </li>
            </ul>
          </div>

          {/* Columna 3: Acceso Rápido */}
          <div className="space-y-3">
            <h3 className="font-bold text-amber-400 uppercase tracking-wider text-xs">
              AFILO GRATIS TU PEOR CUCHILLO
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Agenda tu visita con Emil o habla con nuestro asistente virtual <strong>Kusin</strong>{' '}
              para reservar tu prueba gratuita en un minuto.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={onOpenVoiceAssistant}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-stone-800 hover:bg-stone-700 text-white border border-stone-700 transition-colors"
              >
                <Mic className="w-4 h-4 text-amber-400" />
                <span>Asistente de cita (Kusin)</span>
              </button>
              <a
                href="#reservar"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-kusin-terra hover:bg-kusin-terraDark text-white transition-colors"
              >
                <Calendar className="w-4 h-4" />
                <span>Reservar hora</span>
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <p>© {new Date().getFullYear()} MadKusin · Taller de Afilado de Emil (CP 28224).</p>
          <p>
            Solo cuchillos de acero de filo liso · Afilador de banda y strop de cuero sin
            sobrecalentar la hoja.
          </p>
        </div>
      </div>
    </footer>
  );
}
