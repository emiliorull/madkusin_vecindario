import React from 'react';
import {
  Plug,
  Truck,
  CheckCircle2,
  XCircle,
  Sparkles,
  Clock,
  ShieldAlert,
  ArrowDownRight
} from 'lucide-react';

export default function HowItWorksSection({ onSelectModalidad }) {
  return (
    <section id="como-funciona" className="py-16 sm:py-24 bg-stone-50 border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-16">
        {/* Encabezado de Sección */}
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-stone-200 text-stone-800">
            Dos modalidades a tu medida en el 28224
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900">
            ¿Cómo funciona el servicio de Kusin?
          </h2>
          <p className="text-base sm:text-lg text-stone-700">
            Tanto si quieres ver el afilado en directo en tu puerta como si prefieres que recojamos
            tu lote y te lo entreguemos listo en 24/48h,{' '}
            <strong>tu peor cuchillo es siempre 100 % gratis</strong>.
          </p>
        </div>

        {/* Comparativa Visual en 2 Tarjetas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* OPCIÓN 1: AFILADO IN SITU */}
          <article className="flex flex-col justify-between rounded-3xl bg-white border-2 border-stone-200 hover:border-amber-500/80 shadow-sm hover:shadow-md transition-all p-6 sm:p-8">
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-950">
                    Opción 1 · En el acto
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-2">
                    Afilado In Situ (a domicilio)
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-kusin-terra flex items-center justify-center shrink-0">
                  <Plug className="w-6 h-6" />
                </div>
              </div>

              <p className="text-stone-700 leading-relaxed">
                Kusin acude a tu domicilio en el 28224 con su equipo de banda refrigerada por agua y
                asentador de cuero para afilar allí mismo.
              </p>

              {/* Requisito Técnico Obligatorio Destacado */}
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 flex items-start gap-3">
                <Plug className="w-5 h-5 text-kusin-terra shrink-0 mt-0.5" />
                <div className="text-sm text-stone-800">
                  <strong className="block text-stone-900 font-bold">
                    Requisito técnico obligatorio: Enchufe a menos de 15 metros
                  </strong>
                  Necesitas disponer de una toma de corriente accesible a menos de{' '}
                  <strong>15 metros</strong> del punto de trabajo (Kusin lleva su propia alargadera
                  profesional de 15 m).
                </div>
              </div>

              {/* Pasos de la Opción 1 */}
              <ul className="space-y-3 text-sm sm:text-base text-stone-700">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>1. Demostración gratuita en vivo:</strong> Primero se afila totalmente
                    gratis tu peor cuchillo de acero de filo liso.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>2. Compruebas cómo corta en el acto:</strong> Ves el resultado al
                    instante en tu propia mano.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>3. Tú decides sin compromiso:</strong> Si te gusta cómo ha quedado,
                    Kusin te indica de viva voz la tarifa para afilar el resto de tus cuchillos en
                    ese mismo momento (~5 min por cuchillo).
                  </span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-stone-200 flex items-center justify-between gap-4">
              <div className="text-xs text-stone-600 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-stone-500" />
                <span>Duración: 35–60 min según nº cuchillos</span>
              </div>
              <a
                href="#reservar"
                onClick={() => onSelectModalidad?.('in_situ')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-stone-900 hover:bg-kusin-terra text-white transition-colors"
              >
                <span>Elegir In Situ</span>
                <ArrowDownRight className="w-4 h-4" />
              </a>
            </div>
          </article>

          {/* OPCIÓN 2: RECOGIDA Y ENTREGA 24/48H */}
          <article className="flex flex-col justify-between rounded-3xl bg-white border-2 border-stone-200 hover:border-sky-500/80 shadow-sm hover:shadow-md transition-all p-6 sm:p-8">
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-950">
                    Opción 2 · Lote en taller (Sin enchufe)
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-2">
                    Recogida y Entrega (24/48 horas)
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Truck className="w-6 h-6" />
                </div>
              </div>

              <p className="text-stone-700 leading-relaxed">
                Ideal cuando quieres afilar un lote completo con calma en el taller o no tienes un
                enchufe accesible en la entrada o jardín.
              </p>

              {/* Garantía Destacada */}
              <div className="p-4 rounded-2xl bg-sky-50/90 border border-sky-300 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                <div className="text-sm text-stone-800">
                  <strong className="block text-stone-900 font-bold">
                    Garantía total al entregarte el lote:
                  </strong>
                  Al devolvértelos en <strong>24 a 48 horas</strong>, pruebas primero tu peor
                  cuchillo (que es 100 % gratis). Si no quedas satisfecho con el resultado,{' '}
                  <strong>no pagas absolutamente nada por el resto de cuchillos</strong>.
                </div>
              </div>

              {/* Pasos de la Opción 2 */}
              <ul className="space-y-3 text-sm sm:text-base text-stone-700">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>1. Recogida rápida en tu puerta:</strong> Kusin pasa a recoger tu lote de
                    cuchillos de filo liso (visita breve de ~25 min con margen incluido).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>2. Afilado de taller en agua y cuero:</strong> Se afilan con mimo en
                    banda refrigerada por agua y strop preparado, incluyendo tu peor cuchillo gratis.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>3. Entrega en 24/48h y prueba antes de pagar:</strong> Pruebas el peor
                    cuchillo al recibirlos; si no te convence, el lote entero sale a 0 €.
                  </span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-stone-200 flex items-center justify-between gap-4">
              <div className="text-xs text-stone-600 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-stone-500" />
                <span>Recogida: 25 min · Entrega en 24/48h</span>
              </div>
              <a
                href="#reservar"
                onClick={() => onSelectModalidad?.('recogida')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-stone-900 hover:bg-sky-700 text-white transition-colors"
              >
                <span>Elegir Recogida 24/48h</span>
                <ArrowDownRight className="w-4 h-4" />
              </a>
            </div>
          </article>
        </div>

        {/* Aviso Visual Claro de Exclusiones: Qué SÍ y Qué NO afilamos */}
        <div
          id="que-afilamos"
          className="rounded-3xl bg-white border-2 border-stone-200 p-6 sm:p-10 shadow-sm"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-200">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-kusin-terra">
                <ShieldAlert className="w-4 h-4" />
                Especialización estricta en acero de filo liso
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
                ¿Qué afilamos y qué NO afilamos?
              </h3>
            </div>
            <p className="text-sm text-stone-600 max-w-md">
              Para garantizar un resultado impecable sin dañar tus piezas, revisa que tus cuchillos
              cumplan esta regla antes de reservar:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            {/* SÍ AFILAMOS */}
            <div className="rounded-2xl bg-emerald-50/70 border-2 border-emerald-300 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Aceptados
                  </span>
                  <h4 className="text-lg sm:text-xl font-bold text-stone-900">
                    SÍ: Cuchillos de cocina de acero de filo liso
                  </h4>
                </div>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm font-medium text-stone-800 pt-1">
                <li className="flex items-center gap-2 bg-white/80 px-3 py-2 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cuchillos cebolleros / chef</span>
                </li>
                <li className="flex items-center gap-2 bg-white/80 px-3 py-2 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Puntillas y peladores lisos</span>
                </li>
                <li className="flex items-center gap-2 bg-white/80 px-3 py-2 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Santoku y cuchillos japoneses</span>
                </li>
                <li className="flex items-center gap-2 bg-white/80 px-3 py-2 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Jamoneros y fileteadores lisos</span>
                </li>
              </ul>
            </div>

            {/* NO AFILAMOS */}
            <div className="rounded-2xl bg-rose-50/70 border-2 border-rose-300 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                    Exclusiones estrictas
                  </span>
                  <h4 className="text-lg sm:text-xl font-bold text-stone-900">
                    NO: Sierra, cerámicos, tijeras ni herramientas
                  </h4>
                </div>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm font-medium text-stone-800 pt-1">
                <li className="flex items-center gap-2 bg-white/80 px-3 py-2 rounded-xl border border-rose-200">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Cuchillos de sierra (paneros/chuleteros)</span>
                </li>
                <li className="flex items-center gap-2 bg-white/80 px-3 py-2 rounded-xl border border-rose-200">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Cuchillos de cerámica</span>
                </li>
                <li className="flex items-center gap-2 bg-white/80 px-3 py-2 rounded-xl border border-rose-200">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Tijeras de cocina o costura</span>
                </li>
                <li className="flex items-center gap-2 bg-white/80 px-3 py-2 rounded-xl border border-rose-200">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Hachas, machetes o sierras</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
