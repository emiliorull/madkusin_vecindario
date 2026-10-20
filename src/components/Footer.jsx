import React from 'react';
import { MapPin, Clock, ShieldCheck, Mic, Calendar } from 'lucide-react';

export default function Footer({ onOpenVoiceAssistant }) {
  return (
    <footer className="bg-stone-900 text-stone-300 border-t border-stone-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-10 border-b border-stone-800">
          {/* Columna 1: Identidad */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-kusin-terra text-white flex items-center justify-center font-serif font-bold text-lg">
                K
              </div>
              <div>
                <span className="font-serif font-bold text-xl text-white block">
                  Kusin · Vecindario 28224
                </span>
                <span className="text-xs text-amber-400">vecindario.madkusin.com</span>
              </div>
            </div>
            <p className="text-sm text-stone-400 leading-relaxed">
              Servicio hiperlocal de afilado profesional de cuchillos de acero de filo liso con
              refrigeración por agua y asentador de cuero (strop). Exclusivo para hogares del código
              postal 28224 (Pozuelo de Alarcón).
            </p>
          </div>

          {/* Columna 2: Horario y Reglas */}
          <div className="space-y-3 text-sm">
            <h3 className="font-bold text-white uppercase tracking-wider text-xs">
              Horario y Condiciones Vecinales
            </h3>
            <ul className="space-y-2 text-stone-300">
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Lunes a Viernes de 10:00 a 13:00 h</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Exclusivo residentes CP 28224 (Pozuelo)</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Privacidad total: sin pedir teléfono ni WhatsApp</span>
              </li>
            </ul>
          </div>

          {/* Columna 3: Acceso Rápido */}
          <div className="space-y-3">
            <h3 className="font-bold text-white uppercase tracking-wider text-xs">
              ¿Listo para probar con tu peor cuchillo?
            </h3>
            <p className="text-xs text-stone-400">
              Afilamos gratis y sin compromiso el peor cuchillo de acero de filo liso de tu cocina.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={onOpenVoiceAssistant}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-stone-800 hover:bg-stone-700 text-white border border-stone-700 transition-colors"
              >
                <Mic className="w-4 h-4 text-amber-400" />
                <span>Asistente de cita</span>
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
          <p>© {new Date().getFullYear()} Madkusin · Taller de Afilado de Kusin (CP 28224).</p>
          <p>
            Solo cuchillos de cocina de acero de filo liso · Refrigeración por agua y pulido en
            strop de cuero.
          </p>
        </div>
      </div>
    </footer>
  );
}
