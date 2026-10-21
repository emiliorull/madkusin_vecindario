import React from 'react';
import {
  Mic,
  Calendar,
  Sparkles,
  MapPin,
  Clock,
  ShieldCheck,
  Award,
  CheckCircle2,
  Gauge,
  Hammer
} from 'lucide-react';

export default function HeroSection({ onOpenVoiceAssistant }) {
  return (
    <section className="relative overflow-hidden pt-6 pb-16 sm:pt-10 sm:pb-24 border-b-2 border-stone-200 bg-gradient-to-b from-stone-100/90 via-stone-50 to-stone-50">
      {/* Textura cálida de fragua y cuero de fondo */}
      <div
        className="pointer-events-none absolute -top-24 right-0 w-96 h-96 rounded-full bg-amber-700/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 left-10 w-80 h-80 rounded-full bg-stone-400/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative space-y-8 sm:space-y-10">
        {/* Banner Superior de Gran Impacto: EL GANCHO COMERCIAL INNEGOCIABLE */}
        <div className="rounded-3xl bg-stone-900 border-2 border-stone-800 shadow-xl p-6 sm:p-8 lg:p-10 relative overflow-hidden">
          <div className="pointer-events-none absolute -right-12 -top-12 w-56 h-56 rounded-full bg-kusin-terra/25 blur-2xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex flex-wrap items-center gap-2 px-3.5 py-1 rounded-full bg-stone-800 border border-stone-700 text-amber-400 text-xs sm:text-sm font-bold uppercase tracking-wider">
                <MapPin className="w-4 h-4 text-kusin-terra shrink-0" />
                <span>El Afilador del Siglo XXI · Exclusivo CP 28224 (Pozuelo de Alarcón)</span>
              </div>

              <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold uppercase tracking-tight text-stone-50 leading-[1.03]">
                AFILO <span className="text-amber-400 underline decoration-kusin-terra decoration-4 underline-offset-8">GRATIS</span> TU PEOR CUCHILLO
              </h1>
            </div>

            <div className="lg:max-w-xs bg-stone-800/90 border border-stone-700 rounded-2xl p-4 sm:p-5 text-stone-200 space-y-1.5 shrink-0">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block">
                Sin compromiso · En tu puerta
              </span>
              <p className="text-sm leading-relaxed text-stone-200">
                Elige ese cuchillo de acero de filo liso que ya no corta ni un tomate.{' '}
                <strong className="text-white">Emil</strong> lo devuelve a la vida gratis para que
                compruebes el filo real antes de decidir nada más.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Columna Izquierda: Identidad de Emil y Descripción Técnica Actualizada */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-kusin-leather">
              <Hammer className="w-4 h-4 text-kusin-terra" />
              <span>Oficio tradicional de toda la vida + Precisión técnica actual</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-stone-900 leading-[1.15] tracking-tight">
              Soy <span className="text-kusin-terra">Emil</span>, tu artesano afilador a domicilio
              en el vecindario del 28224.
            </h2>

            {/* Descripción Técnica del Afilado (ACTUALIZADA ESTRICTAMENTE) */}
            <blockquote className="p-5 sm:p-6 rounded-2xl bg-[#FBF9F5] border-l-4 border-kusin-terra border-y border-r border-stone-300 shadow-sm">
              <p className="font-serif italic text-base sm:text-lg text-stone-900 leading-relaxed">
                "Afilado profesional de alta precisión con afilador de banda y strop, absolutamente
                respetuoso con el temple del acero y diseñado para no sobrecalentar nunca la hoja."
              </p>
            </blockquote>

            <p className="text-base sm:text-lg text-stone-800 leading-relaxed">
              Recupero la figura del clásico afilador ambulante con maquinaria moderna de precisión.
              Me desplazo a tu domicilio en <strong>Pozuelo (CP 28224)</strong> o recojo tus
              cuchillos para devolvértelos listos en 24/48h. Y si quieres reservar hablando en un
              minuto, mi asistente de inteligencia artificial <strong>Kusin</strong> te atiende al
              instante.
            </p>

            {/* Dos CTAs Principales grandes y accesibles */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              {/* CTA 1: Asistente de Voz con Kusin */}
              <button
                type="button"
                onClick={onOpenVoiceAssistant}
                className="group relative inline-flex items-center justify-center gap-3.5 px-6 py-4 rounded-2xl text-base sm:text-lg font-bold bg-stone-900 hover:bg-stone-800 text-stone-50 border border-stone-700 shadow-lg hover:shadow-xl transition-all min-h-[58px] focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-500"
              >
                <span className="w-10 h-10 rounded-xl bg-kusin-terra text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Mic className="w-5 h-5" />
                </span>
                <div className="text-left">
                  <span className="block leading-tight">Asistente de cita</span>
                  <span className="block text-xs font-normal text-stone-300">
                    Habla con Kusin (IA del taller de Emil)
                  </span>
                </div>
                {/* Onda de audio animada */}
                <div
                  className="flex items-center gap-1 h-6 pl-2 border-l border-stone-700"
                  aria-hidden="true"
                >
                  <span className="w-1 h-full bg-amber-400 rounded-full animate-pulse-wave-1" />
                  <span className="w-1 h-full bg-amber-400 rounded-full animate-pulse-wave-2" />
                  <span className="w-1 h-full bg-amber-400 rounded-full animate-pulse-wave-3" />
                  <span className="w-1 h-full bg-amber-400 rounded-full animate-pulse-wave-4" />
                </div>
              </button>

              {/* CTA 2: Reservar en el calendario */}
              <a
                href="#reservar"
                className="inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-base sm:text-lg font-bold bg-kusin-terra hover:bg-kusin-terraDark text-white shadow-md hover:shadow-lg transition-all min-h-[58px] focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-500"
              >
                <Calendar className="w-5 h-5 shrink-0" />
                <span>Reservar en el calendario</span>
              </a>
            </div>

            {/* Píldoras de confianza y privacidad con estética piedra/cuero */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm text-stone-800 font-medium">
              <div className="flex items-center gap-2 bg-stone-100 px-3 py-2.5 rounded-xl border border-stone-300/90">
                <Clock className="w-4 h-4 text-kusin-terra shrink-0" />
                <span>Lunes a Viernes · 10:00 a 13:00</span>
              </div>
              <div className="flex items-center gap-2 bg-stone-100 px-3 py-2.5 rounded-xl border border-stone-300/90">
                <CheckCircle2 className="w-4 h-4 text-kusin-sage shrink-0" />
                <span>Solo acero de filo liso</span>
              </div>
              <div className="flex items-center gap-2 bg-stone-100 px-3 py-2.5 rounded-xl border border-stone-300/90">
                <ShieldCheck className="w-4 h-4 text-kusin-leather shrink-0" />
                <span>Sin pedir tu móvil ni WhatsApp</span>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Tarjeta Artesanal del Taller de Emil */}
          <div className="lg:col-span-5">
            <div className="bg-stone-900 text-stone-100 rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-stone-800 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-stone-800 pb-5 mb-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                    Acero al Carbono · Cuero · Precisión
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-white mt-1">
                    El Oficio de Emil
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400">
                  <Award className="w-6 h-6" />
                </div>
              </div>

              <div className="space-y-5">
                {/* Paso técnico 1: Afilador de banda respetuoso con el temple */}
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-stone-800/80 border border-stone-700">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      1. Afilador de banda de alta precisión
                    </h4>
                    <p className="text-sm text-stone-300 mt-1 leading-relaxed">
                      Trabajo con abrasivos técnicos y control de velocidad absolutamente
                      respetuosos con el temple del acero, diseñados para no sobrecalentar nunca la
                      hoja.
                    </p>
                  </div>
                </div>

                {/* Paso técnico 2: Strop de cuero */}
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-stone-800/80 border border-stone-700">
                  <div className="w-10 h-10 rounded-xl bg-kusin-terra/30 text-amber-300 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      2. Asentado y pulido en Strop de cuero
                    </h4>
                    <p className="text-sm text-stone-300 mt-1 leading-relaxed">
                      Eliminamos cualquier micro-rebaba en cuero tostado preparado para lograr un
                      vaciado limpio, seguro y de larga duración.
                    </p>
                  </div>
                </div>

                {/* Paso técnico 3: El compromiso vecinal */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-kusin-terra/30 to-amber-700/20 border border-amber-500/40">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    ¿Por qué el peor cuchillo es gratis?
                  </p>
                  <p className="text-sm text-stone-200 mt-1 leading-relaxed">
                    Porque el buen oficio se demuestra cortando. Emil afila primero tu peor cuchillo
                    de acero de filo liso gratis; lo pruebas y solo si te convence decides sobre el
                    resto.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
