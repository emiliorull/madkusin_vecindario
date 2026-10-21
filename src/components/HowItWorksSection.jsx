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
    <section id="como-funciona" className="py-16 sm:py-24 bg-stone-50 border-b-2 border-stone-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-16">
        {/* Encabezado de Sección */}
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-stone-200 text-stone-900 border border-stone-300">
            Exclusivo para el Código Postal 28224 (Pozuelo de Alarcón)
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900">
            Dos modalidades de servicio con Emil
          </h2>
          <p className="text-base sm:text-lg text-stone-800">
            Tanto si prefieres que Emil afile en tu propia puerta como si eliges recogida y entrega
            en 24/48 horas,{' '}
            <strong>tu peor cuchillo de acero de filo liso se afila siempre GRATIS</strong>.
          </p>
        </div>

        {/* Comparativa Visual en 2 Tarjetas con estética de taller (Acero y Cuero) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* MODALIDAD 1: AFILADO IN SITU */}
          <article className="flex flex-col justify-between rounded-3xl bg-[#FBF9F5] border-2 border-stone-300 hover:border-kusin-terra shadow-sm hover:shadow-md transition-all p-6 sm:p-8">
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-stone-900 text-amber-400">
                    Modalidad 1 · En el acto
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-2">
                    Afilado In Situ (a domicilio)
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-stone-200 text-kusin-terra border border-stone-300 flex items-center justify-center shrink-0">
                  <Plug className="w-6 h-6" />
                </div>
              </div>

              <p className="text-stone-800 leading-relaxed">
                <strong>Emil</strong> acude a tu casa en el 28224 con su afilador de banda de alta
                precisión y strop de cuero para devolver el filo a tus cuchillos allí mismo,
                respetando al 100 % el temple del acero sin sobrecalentar nunca la hoja.
              </p>

              {/* Requisito Técnico Obligatorio Destacado */}
              <div className="p-4 rounded-2xl bg-amber-50/90 border-2 border-amber-300 flex items-start gap-3">
                <Plug className="w-5 h-5 text-kusin-terra shrink-0 mt-0.5" />
                <div className="text-sm text-stone-800">
                  <strong className="block text-stone-900 font-bold">
                    Requisito técnico: Toma de corriente cercana (alargadera de 15 m)
                  </strong>
                  Emil necesita una toma de corriente accesible a menos de{' '}
                  <strong>15 metros</strong> del punto de trabajo (lleva consigo una alargadera
                  profesional de 15 metros).
                </div>
              </div>

              {/* Pasos de la Modalidad 1 */}
              <ul className="space-y-3 text-sm sm:text-base text-stone-800">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-kusin-sage shrink-0 mt-0.5" />
                  <span>
                    <strong>1. Afilado gratis de tu peor cuchillo:</strong> Emil afila primero y
                    totalmente gratis tu peor cuchillo de acero de filo liso.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-kusin-sage shrink-0 mt-0.5" />
                  <span>
                    <strong>2. Prueba inmediata en tu mano:</strong> Compruebas al instante la
                    precisión del corte.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-kusin-sage shrink-0 mt-0.5" />
                  <span>
                    <strong>3. Tarifa de viva voz sin compromiso:</strong> Si te gusta el resultado,
                    Emil te indica de viva voz la tarifa para afilar el resto de tus cuchillos en el
                    momento (~5 min por cuchillo).
                  </span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-stone-200 flex items-center justify-between gap-4">
              <div className="text-xs text-stone-700 font-medium flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-kusin-terra" />
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

          {/* MODALIDAD 2: RECOGIDA Y ENTREGA 24/48H */}
          <article className="flex flex-col justify-between rounded-3xl bg-[#FBF9F5] border-2 border-stone-300 hover:border-kusin-amber shadow-sm hover:shadow-md transition-all p-6 sm:p-8">
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-stone-200 text-stone-900 border border-stone-300">
                    Modalidad 2 · En el taller (Sin enchufe)
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-2">
                    Recogida y Entrega (24/48h)
                  </h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-stone-200 text-kusin-leather border border-stone-300 flex items-center justify-center shrink-0">
                  <Truck className="w-6 h-6" />
                </div>
              </div>

              <p className="text-stone-800 leading-relaxed">
                Se recogen tus cuchillos a domicilio en el 28224, se afila gratis el peor en el
                taller con afilador de banda y strop, y se devuelven listos en un plazo máximo de{' '}
                <strong>24/48 horas</strong>.
              </p>

              {/* Garantía Destacada */}
              <div className="p-4 rounded-2xl bg-stone-100 border-2 border-stone-300 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-kusin-amber shrink-0 mt-0.5" />
                <div className="text-sm text-stone-800">
                  <strong className="block text-stone-900 font-bold">
                    Pruebas primero tu peor cuchillo al entregártelos:
                  </strong>
                  Al devolvértelos en un plazo máximo de <strong>24/48 horas</strong>, pruebas
                  primero tu peor cuchillo (que se ha afilado gratis).{' '}
                  <strong>Si no te convence, no hay ningún compromiso.</strong>
                </div>
              </div>

              {/* Pasos de la Modalidad 2 */}
              <ul className="space-y-3 text-sm sm:text-base text-stone-800">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-kusin-sage shrink-0 mt-0.5" />
                  <span>
                    <strong>1. Recogida en tu puerta:</strong> Emil pasa por tu domicilio a recoger
                    tus cuchillos de acero de filo liso (visita breve de ~25 min).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-kusin-sage shrink-0 mt-0.5" />
                  <span>
                    <strong>2. Afilado de precisión en el taller:</strong> Trabajo con afilador de
                    banda y strop respetando el temple del acero, afilando gratis tu peor cuchillo.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-kusin-sage shrink-0 mt-0.5" />
                  <span>
                    <strong>3. Entrega en 24/48h sin compromiso:</strong> Al recibirlos, pruebas
                    primero tu peor cuchillo; si no te convence, no hay compromiso.
                  </span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-stone-200 flex items-center justify-between gap-4">
              <div className="text-xs text-stone-700 font-medium flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-kusin-leather" />
                <span>Recogida: 25 min · Entrega máx. 24/48h</span>
              </div>
              <a
                href="#reservar"
                onClick={() => onSelectModalidad?.('recogida')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-stone-900 hover:bg-kusin-leather text-white transition-colors"
              >
                <span>Elegir Recogida 24/48h</span>
                <ArrowDownRight className="w-4 h-4" />
              </a>
            </div>
          </article>
        </div>

        {/* Aviso Visual Claro de Exclusiones Estrictas */}
        <div
          id="que-afilamos"
          className="rounded-3xl bg-[#FBF9F5] border-2 border-stone-300 p-6 sm:p-10 shadow-sm"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-200">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-kusin-terra">
                <ShieldAlert className="w-4 h-4" />
                Exclusiones estrictas del taller
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
                Solo cuchillos de acero de filo liso
              </h3>
            </div>
            <p className="text-sm text-stone-700 max-w-md">
              Para garantizar un vaciado y asentado de máxima precisión con afilador de banda y
              strop, revisa qué piezas trabajamos antes de agendar tu cita:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            {/* SÍ AFILAMOS */}
            <div className="rounded-2xl bg-emerald-50/70 border-2 border-emerald-300 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-kusin-sage text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                    Incluidos en el servicio
                  </span>
                  <h4 className="text-lg sm:text-xl font-bold text-stone-900">
                    SÍ: Solo cuchillos de acero de filo liso
                  </h4>
                </div>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm font-medium text-stone-800 pt-1">
                <li className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-kusin-sage shrink-0" />
                  <span>Cuchillos cebolleros / chef</span>
                </li>
                <li className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-kusin-sage shrink-0" />
                  <span>Puntillas y peladores lisos</span>
                </li>
                <li className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-kusin-sage shrink-0" />
                  <span>Santoku y cuchillos japoneses</span>
                </li>
                <li className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-kusin-sage shrink-0" />
                  <span>Jamoneros y fileteadores lisos</span>
                </li>
              </ul>
            </div>

            {/* NO AFILAMOS */}
            <div className="rounded-2xl bg-rose-50/70 border-2 border-rose-300 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-kusin-terra text-white flex items-center justify-center shrink-0">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-kusin-terra">
                    Exclusiones estrictas
                  </span>
                  <h4 className="text-lg sm:text-xl font-bold text-stone-900">
                    NO: Sierra, cerámicos, tijeras, hachas o sierras
                  </h4>
                </div>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm font-medium text-stone-800 pt-1">
                <li className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-xl border border-rose-200">
                  <XCircle className="w-4 h-4 text-kusin-terra shrink-0" />
                  <span>Cuchillos de sierra (paneros/chuleteros)</span>
                </li>
                <li className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-xl border border-rose-200">
                  <XCircle className="w-4 h-4 text-kusin-terra shrink-0" />
                  <span>Cuchillos cerámicos</span>
                </li>
                <li className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-xl border border-rose-200">
                  <XCircle className="w-4 h-4 text-kusin-terra shrink-0" />
                  <span>Tijeras de cualquier tipo</span>
                </li>
                <li className="flex items-center gap-2 bg-white/90 px-3 py-2 rounded-xl border border-rose-200">
                  <XCircle className="w-4 h-4 text-kusin-terra shrink-0" />
                  <span>Hachas o sierras</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
