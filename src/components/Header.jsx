import React from 'react';
import { Mic, Calendar, MapPin, ShieldCheck } from 'lucide-react';

export default function Header({ onOpenVoiceAssistant, confirmedAppointment }) {
  return (
    <header className="sticky top-0 z-40 parchment-header backdrop-blur-md border-b-2 border-stone-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Marca Artesanal: Logo MadKusin integrado sobre fondo rústico/pergamino */}
        <a
          href="#"
          className="flex items-center gap-3.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-kusin-terra rounded-xl"
        >
          <div className="w-16 h-12 sm:w-20 sm:h-14 rounded-xl bg-[#FBF9F5] border border-stone-300/90 shadow-sm overflow-hidden flex items-center justify-center p-1 group-hover:border-kusin-terra transition-colors">
            <img
              src="/logo-madkusin.jpg"
              alt="Logotipo MadKusin - El Afilador del Siglo XXI"
              className="w-full h-full object-contain mix-blend-multiply"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-serif font-bold text-base sm:text-lg text-stone-900 tracking-tight">
                Emil · El Afilador del Siglo XXI
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-200/90 text-stone-900 border border-stone-300">
                <MapPin className="w-3 h-3 text-kusin-terra" />
                CP 28224
              </span>
            </div>
            <p className="text-xs text-stone-700 font-medium hidden sm:block">
              Oficio artesanal y precisión técnica a domicilio · Pozuelo de Alarcón
            </p>
          </div>
        </a>

        {/* Navegación central en escritorio */}
        <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-6 text-sm font-semibold text-stone-800">
          <a href="#como-funciona" className="hover:text-kusin-terra transition-colors">
            Modalidades (28224)
          </a>
          <a href="#que-afilamos" className="hover:text-kusin-terra transition-colors">
            Qué afilamos
          </a>
          <a href="#reservar" className="hover:text-kusin-terra transition-colors">
            Agenda L-V (10:00–13:00)
          </a>
        </nav>

        {/* Acciones rápidas */}
        <div className="flex items-center gap-2.5">
          {confirmedAppointment && (
            <a
              href="#reservar"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Cita confirmada ({confirmedAppointment.hora_inicio})
            </a>
          )}

          <button
            type="button"
            onClick={onOpenVoiceAssistant}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-sm font-bold bg-stone-900 hover:bg-stone-800 text-stone-50 border border-stone-700 shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-stone-900"
            aria-label="Abrir Asistente de cita por voz con Kusin"
          >
            <Mic className="w-4 h-4 text-amber-400" />
            <span>Asistente de cita (Kusin)</span>
            <span className="flex items-end gap-0.5 h-3.5 ml-0.5" aria-hidden="true">
              <span className="w-0.5 h-full bg-amber-400 rounded-full animate-pulse-wave-1" />
              <span className="w-0.5 h-full bg-amber-400 rounded-full animate-pulse-wave-2" />
              <span className="w-0.5 h-full bg-amber-400 rounded-full animate-pulse-wave-3" />
            </span>
          </button>

          <a
            href="#reservar"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-kusin-terra hover:bg-kusin-terraDark text-white shadow-sm transition-all"
          >
            <Calendar className="w-4 h-4" />
            <span>Reservar</span>
          </a>
        </div>
      </div>
    </header>
  );
}
