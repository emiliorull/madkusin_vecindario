import React from 'react';
import {
  Mic,
  Calendar,
  Droplets,
  Sparkles,
  MapPin,
  Clock,
  ShieldCheck,
  Award,
  CheckCircle2
} from 'lucide-react';

export default function HeroSection({ onOpenVoiceAssistant }) {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 sm:pt-14 sm:pb-24 border-b border-stone-200 bg-gradient-to-b from-stone-100/80 via-stone-50 to-stone-50">
      {/* Decoración cálida de fondo */}
      <div
        className="pointer-events-none absolute -top-24 right-0 w-96 h-96 rounded-full bg-amber-200/30 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 left-10 w-80 h-80 rounded-full bg-sky-200/25 blur-3xl"
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Columna Izquierda: Propuesta de Valor Vecinal */}
          <div className="lg:col-span-7 space-y-6">
            {/* Etiqueta Hiperlocal */}
            <div className="inline-flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100/90 border border-amber-300 text-amber-950 text-xs sm:text-sm font-semibold">
              <MapPin className="w-4 h-4 text-kusin-terra shrink-0" />
              <span>Servicio exclusivo para hogares del CP 28224 (Pozuelo de Alarcón)</span>
            </div>

            {/* Título Principal cercano e inclusivo */}
            <h1 className="font-serif text-3xl sm:text-5xl lg:text-[3.25rem] font-bold text-stone-900 leading-[1.12] tracking-tight">
              Devolvemos el corte de origen a los cuchillos de{' '}
              <span className="text-kusin-terra underline decoration-amber-400/70 decoration-wavy underline-offset-4">
                tu vecindario
              </span>
              .
            </h1>

            {/* Gancho Comercial Destacado: El Peor Cuchillo Gratis */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-amber-400/80 shadow-sm">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-kusin-terra flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="inline-block text-xs font-bold uppercase tracking-wider text-kusin-terra bg-amber-100 px-2 py-0.5 rounded-md mb-1">
                    Compromiso Vecinal Sin Riesgo
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                    Afilamos GRATIS y sin compromiso el peor cuchillo de tu casa
                  </h2>
                  <p className="text-sm sm:text-base text-stone-700 mt-1 leading-relaxed">
                    Para todas las personas de la zona del <strong>28224</strong>: elige ese cuchillo
                    de acero de filo liso que ya no corta ni un tomate. <strong>Kusin</strong> lo
                    afila gratis para que compruebes el resultado real antes de decidir nada más.
                  </p>
                </div>
              </div>
            </div>

            {/* Explicación breve del método técnico de Kusin */}
            <p className="text-base sm:text-lg text-stone-700 leading-relaxed">
              Soy <strong>Kusin</strong>, artesano afilador en tu zona. Trabajo con{' '}
              <strong className="text-stone-900">
                afiladora de banda profesional con refrigeración por agua
              </strong>{' '}
              (que protege el temple del acero sin sobrecalentar nunca la hoja) y acabado pulido en{' '}
              <strong className="text-stone-900">strop preparado (asentador de cuero)</strong> para
              un filo limpio, duradero y seguro.
            </p>

            {/* Dos CTAs Principales grandes y accesibles */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              {/* CTA 1: Asistente de Voz con icono de micrófono y onda animada */}
              <button
                type="button"
                onClick={onOpenVoiceAssistant}
                className="group relative inline-flex items-center justify-center gap-3.5 px-6 py-4 rounded-2xl text-base sm:text-lg font-bold bg-stone-900 hover:bg-stone-800 text-stone-50 shadow-lg hover:shadow-xl transition-all min-h-[58px] focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-500"
              >
                <span className="w-10 h-10 rounded-xl bg-kusin-terra text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Mic className="w-5 h-5" />
                </span>
                <div className="text-left">
                  <span className="block leading-tight">Asistente de cita</span>
                  <span className="block text-xs font-normal text-stone-300">
                    Habla con nuestra IA para agendar en 1 minuto
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

              {/* CTA 2: Reservar en el calendario (scroll suave) */}
              <a
                href="#reservar"
                className="inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-base sm:text-lg font-bold bg-kusin-terra hover:bg-kusin-terraDark text-white shadow-md hover:shadow-lg transition-all min-h-[58px] focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-500"
              >
                <Calendar className="w-5 h-5 shrink-0" />
                <span>Reservar en el calendario</span>
              </a>
            </div>

            {/* Píldoras de confianza y privacidad */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm text-stone-700">
              <div className="flex items-center gap-2 bg-stone-100 px-3 py-2 rounded-xl border border-stone-200/80">
                <Clock className="w-4 h-4 text-kusin-terra shrink-0" />
                <span>Lunes a Viernes · 10:00 a 13:00</span>
              </div>
              <div className="flex items-center gap-2 bg-stone-100 px-3 py-2 rounded-xl border border-stone-200/80">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Solo acero de filo liso</span>
              </div>
              <div className="flex items-center gap-2 bg-stone-100 px-3 py-2 rounded-xl border border-stone-200/80">
                <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0" />
                <span>Sin pedir tu móvil ni WhatsApp</span>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Tarjeta Artesanal del Método Kusin */}
          <div className="lg:col-span-5">
            <div className="bg-stone-900 text-stone-100 rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-800 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-stone-800 pb-5 mb-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                    Artesanía Técnica en el 28224
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-white mt-1">
                    El Método de Kusin
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400">
                  <Award className="w-6 h-6" />
                </div>
              </div>

              <div className="space-y-5">
                {/* Paso técnico 1 */}
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-stone-800/70 border border-stone-700/70">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      1. Refrigeración continua por agua
                    </h4>
                    <p className="text-sm text-stone-300 mt-1 leading-relaxed">
                      A diferencia del esmeril en seco que destempla y quema el acero, la banda
                      refrigerada por agua mantiene la hoja fría y conserva intacta su dureza.
                    </p>
                  </div>
                </div>

                {/* Paso técnico 2 */}
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-stone-800/70 border border-stone-700/70">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      2. Pulido en Strop de cuero preparado
                    </h4>
                    <p className="text-sm text-stone-300 mt-1 leading-relaxed">
                      Eliminamos la micro-rebaba en asentador de cuero con pasta de pulido fina para
                      lograr un corte suave, preciso y duradero.
                    </p>
                  </div>
                </div>

                {/* Paso técnico 3 */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-kusin-terra/20 border border-amber-500/40">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    ¿Por qué el peor cuchillo es gratis?
                  </p>
                  <p className="text-sm text-stone-200 mt-1 leading-relaxed">
                    Porque en el vecindario la confianza se demuestra cortando. Pruebas tu peor
                    cuchillo recién afilado y solo si te encanta decides si afilamos el resto.
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
