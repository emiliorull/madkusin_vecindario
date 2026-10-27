import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plug,
  Truck,
  CheckCircle2,
  AlertCircle,
  Send,
  Mail,
  MapPin,
  User,
  FileText,
  Sparkles,
  RefreshCw,
  Mic,
  ExternalLink,
  ShieldCheck,
  Minus,
  Plus
} from 'lucide-react';
import {
  calculateAppointmentDuration,
  getDurationBreakdown,
  getUpcomingBusinessDays,
  validateOperatingDate,
  validatePostalCode
} from '../utils/scheduling';
import { checkAvailability, bookAppointment } from '../services/appointmentApi';

export default function BookingSection({
  selectedModalidad,
  onModalidadChange,
  confirmedAppointment,
  onAppointmentConfirmed,
  onResetConfirmedAppointment,
  onOpenVoiceAssistant
}) {
  const businessDays = useMemo(() => getUpcomingBusinessDays(8), []);

  // Paso 1: Configuración del servicio
  const [modalidad, setModalidad] = useState(selectedModalidad || 'in_situ');
  const [numCuchillos, setNumCuchillos] = useState(3);
  const [tieneEnchufe15m, setTieneEnchufe15m] = useState(false);
  const [confirmaFiloLiso, setConfirmaFiloLiso] = useState(false);

  // Paso 2: Fecha y Hora disponible (L-V 10:00 a 13:00)
  const [fecha, setFecha] = useState(businessDays[0]?.isoDate || '');
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [availabilitySource, setAvailabilitySource] = useState('smart_fallback');

  // Paso 3: Datos de contacto (SIN teléfono)
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [direccion, setDireccion] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('28224');
  const [notas, setNotas] = useState('');

  // Estado de envío y errores
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Sincronizar modalidad si el usuario pulsó en las tarjetas superiores
  useEffect(() => {
    if (selectedModalidad && selectedModalidad !== modalidad) {
      setModalidad(selectedModalidad);
    }
  }, [selectedModalidad]);

  const handleModalidadSwitch = (newMod) => {
    setModalidad(newMod);
    onModalidadChange?.(newMod);
    setFormError('');
  };

  // Cálculo dinámico de duración del bloque
  const durationMinutes = useMemo(
    () => calculateAppointmentDuration(modalidad, numCuchillos),
    [modalidad, numCuchillos]
  );

  const durationBreakdown = useMemo(
    () => getDurationBreakdown(modalidad, numCuchillos),
    [modalidad, numCuchillos]
  );

  // Validación en vivo del Código Postal
  const postalValidation = useMemo(() => validatePostalCode(codigoPostal), [codigoPostal]);
  const dateValidation = useMemo(() => validateOperatingDate(fecha), [fecha]);

  // Consultar disponibilidad cada vez que cambia fecha, modalidad o número de cuchillos
  useEffect(() => {
    let active = true;

    async function fetchSlots() {
      if (!fecha) return;
      setLoadingSlots(true);
      const res = await checkAvailability({
        fecha,
        modalidad,
        num_cuchillos: numCuchillos
      });

      if (!active) return;
      setLoadingSlots(false);
      setAvailableSlots(res.slots || []);
      setAvailabilityMessage(res.message || '');
      setAvailabilitySource(res.source || 'smart_fallback');

      // Mantener hora seleccionada si sigue libre; si no, preseleccionar la primera
      if (res.slots && res.slots.length > 0) {
        const stillAvailable = res.slots.some((s) => s.time === horaSeleccionada);
        if (!stillAvailable) {
          setHoraSeleccionada(res.slots[0].time);
        }
      } else {
        setHoraSeleccionada('');
      }
    }

    fetchSlots();
    return () => {
      active = false;
    };
  }, [fecha, modalidad, numCuchillos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Validaciones Paso 1
    if (!confirmaFiloLiso) {
      setFormError(
        'Debes confirmar que tus cuchillos son de acero de filo liso (no afilamos sierra ni cerámica).'
      );
      return;
    }

    if (modalidad === 'in_situ' && !tieneEnchufe15m) {
      setFormError(
        'Para el afilado in situ en tu domicilio es obligatorio confirmar que dispones de una toma de corriente cercana a menos de 15 metros (llevo alargadera profesional de 15 m). Si no tienes enchufe cerca, selecciona "Recogida y entrega (24/48h)".'
      );
      return;
    }

    // Validaciones Paso 2
    if (!dateValidation.valid) {
      setFormError(dateValidation.reason);
      return;
    }

    if (!horaSeleccionada) {
      setFormError('Selecciona una hora disponible entre las 10:00 y las 13:00.');
      return;
    }

    // Validaciones Paso 3
    if (!postalValidation.valid) {
      setFormError(postalValidation.message);
      return;
    }

    if (!nombre.trim() || !email.trim() || !direccion.trim()) {
      setFormError('Por favor, completa tu nombre, correo electrónico y dirección completa.');
      return;
    }

    setSubmitting(true);
    const result = await bookAppointment({
      nombre,
      email,
      direccion,
      codigo_postal: codigoPostal,
      modalidad,
      num_cuchillos: numCuchillos,
      tiene_enchufe_15m: modalidad === 'in_situ' ? tieneEnchufe15m : false,
      confirma_filo_liso: confirmaFiloLiso,
      fecha,
      hora: horaSeleccionada,
      notas,
      origen: 'web_form'
    });
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error || 'No se pudo completar la reserva. Revisa los datos.');
      return;
    }

    onAppointmentConfirmed?.(result.appointment);
  };

  // ==========================================================================
  // ESTADO POST-RESERVA (PANTALLA DE CONFIRMACIÓN Y BOTÓN DE TELEGRAM)
  // ==========================================================================
  if (confirmedAppointment) {
    return (
      <section id="reservar" className="py-16 sm:py-24 bg-stone-100/70">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl bg-white border-2 border-emerald-500 shadow-xl p-6 sm:p-10 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900">
                    Reserva Confirmada · Referencia #{confirmedAppointment.cita_id}
                  </span>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
                    ¡Todo listo para afilar gratis tu peor cuchillo!
                  </h2>
                  <p className="text-sm sm:text-base text-stone-600 mt-1">
                    Te he enviado un correo electrónico de confirmación con el evento de calendario (
                    <code>.ics</code>) a <strong>{confirmedAppointment.email}</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Resumen de la Cita */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-stone-50 p-5 rounded-2xl border border-stone-200 text-sm">
              <div>
                <span className="text-xs font-semibold uppercase text-stone-500 block">
                  Fecha y Franja Reservada
                </span>
                <p className="font-bold text-stone-900 text-base mt-0.5">
                  {confirmedAppointment.fecha} · {confirmedAppointment.hora_inicio} a{' '}
                  {confirmedAppointment.hora_fin} h
                </p>
                <p className="text-xs text-stone-600 mt-0.5">
                  Duración estimada: {confirmedAppointment.duracion_minutos} minutos
                </p>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase text-stone-500 block">
                  Modalidad y Cuchillos
                </span>
                <p className="font-bold text-stone-900 text-base mt-0.5">
                  {confirmedAppointment.modalidad === 'in_situ'
                    ? 'Afilado In Situ en tu domicilio'
                    : 'Recogida y Entrega (24/48h)'}
                </p>
                <p className="text-xs text-stone-600 mt-0.5">
                  {confirmedAppointment.num_cuchillos} cuchillo(s) de acero de filo liso (el peor es
                  100 % gratis)
                </p>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-stone-200/80">
                <span className="text-xs font-semibold uppercase text-stone-500 block">
                  Domicilio de Visita en el Vecindario
                </span>
                <p className="font-semibold text-stone-900 mt-0.5">
                  {confirmedAppointment.nombre} — {confirmedAppointment.direccion} (CP{' '}
                  {confirmedAppointment.codigo_postal})
                </p>
                {confirmedAppointment.notas && (
                  <p className="text-xs text-stone-600 mt-1">
                    Notas: {confirmedAppointment.notas}
                  </p>
                )}
              </div>
            </div>

            {/* CTA Destacado de Bot de Telegram (Privacidad sin compartir teléfono) */}
            <div className="rounded-2xl bg-gradient-to-br from-sky-900 via-sky-950 to-stone-900 text-white p-6 sm:p-7 shadow-lg space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0 border border-sky-400/30">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
                    Privacidad 100 % Vecinal · Sin dar tu número de móvil
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-white mt-0.5">
                    ¿Quieres recibir un recordatorio en tu móvil sin darnos tu teléfono?
                  </h3>
                  <p className="text-sm text-sky-100/90 mt-1 leading-relaxed">
                    El bot de Telegram vincula únicamente el código de tu cita (
                    <code>cita_{confirmedAppointment.cita_id}</code>) para avisarte cuando vaya
                    de camino, sin revelar nunca tu número de teléfono (básicamente porque no lo tengo).
                  </p>
                </div>
              </div>

              <a
                href={confirmedAppointment.telegram_deeplink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-base font-bold bg-sky-500 hover:bg-sky-400 text-stone-950 shadow-md transition-all min-h-[54px]"
              >
                <Send className="w-5 h-5" />
                <span>
                  ¿Quieres recibir un recordatorio en tu móvil sin darme tu teléfono? Pulsa aquí
                  para abrir el Bot de Telegram
                </span>
                <ExternalLink className="w-4 h-4 shrink-0" />
              </a>
            </div>

            <div className="flex items-center justify-between pt-2 text-xs text-stone-500">
              <span>Recuerda tener preparado tu peor cuchillo de acero de filo liso.</span>
              <button
                type="button"
                onClick={onResetConfirmedAppointment}
                className="font-semibold text-kusin-terra hover:underline"
              >
                Hacer otra reserva
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ==========================================================================
  // FORMULARIO INTERACTIVO EN 3 PASOS
  // ==========================================================================
  return (
    <section id="reservar" className="py-16 sm:py-24 bg-stone-100/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
        {/* Cabecera del Módulo de Reserva */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-stone-200 text-stone-900 border border-stone-300">
              <Calendar className="w-3.5 h-3.5 text-kusin-terra" />
              Agenda del Taller · Lunes a Viernes de 10:00 a 13:00
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mt-2">
              Reserva tu cita en 3 pasos
            </h2>
            <p className="text-stone-800 mt-1">
              O si lo prefieres, pulsa en el{' '}
              <button
                type="button"
                onClick={onOpenVoiceAssistant}
                className="inline-flex items-center gap-1 font-bold text-kusin-terra underline hover:text-kusin-terraDark"
              >
                <Mic className="w-4 h-4" />
                Asistente de cita con Kusin (IA)
              </button>{' '}
              y te agendamos conversando.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8" noValidate>
          {/* ================================================================
              PASO 1: CONFIGURACIÓN DEL SERVICIO
             ================================================================ */}
          <div className="rounded-3xl bg-[#FBF9F5] border-2 border-stone-300 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
              <span className="w-8 h-8 rounded-xl bg-stone-900 text-amber-400 font-bold text-sm flex items-center justify-center">
                1
              </span>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                  Configuración del servicio
                </h3>
                <p className="text-xs sm:text-sm text-stone-700">
                  Elige modalidad, cantidad aproximada de cuchillos de filo liso y confirma los
                  requisitos técnicos.
                </p>
              </div>
            </div>

            {/* Selector de Modalidad */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleModalidadSwitch('in_situ')}
                className={`text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-4 ${
                  modalidad === 'in_situ'
                    ? 'border-kusin-terra bg-amber-50/70 shadow-sm'
                    : 'border-stone-300 bg-stone-50/70 hover:border-stone-400'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    modalidad === 'in_situ'
                      ? 'bg-kusin-terra text-white'
                      : 'bg-stone-200 text-stone-800'
                  }`}
                >
                  <Plug className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-base">
                      Afilado In Situ (a domicilio)
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-700">
                    Acudo a tu casa (necesaria toma de corriente a &lt;15m). 
                    <p>
                    <strong>Afilo gratis tu peor cuchillo frente a ti</strong>
                    </p> 
                    y te indico la tarifa para el resto según el número de cuchillos a afilar. Si no te encaja el precio, sin compromiso.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModalidadSwitch('recogida')}
                className={`text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-4 ${
                  modalidad === 'recogida'
                    ? 'border-kusin-leather bg-stone-100 shadow-sm'
                    : 'border-stone-300 bg-stone-50/70 hover:border-stone-400'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    modalidad === 'recogida'
                      ? 'bg-kusin-leather text-white'
                      : 'bg-stone-200 text-stone-800'
                  }`}
                >
                  <Truck className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-base">
                      Recogida y Entrega (24/48h)
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-700">
                    Recojo tus cuchillos a domicilio, 
                    <p>
                    <strong>Afilo gratis tu peor cuchillo en el taller</strong>
                    </p> 
                    Se devuelven en mano listos en un plazo máximo de 24/48 horas en el lugar de recogida o donde se prefiera dentro de Pozuelo de Alarcón.
                  </p>
                </div>
              </button>
            </div>

            {/* Selector Numérico de Cuchillos de acero de filo liso */}
            <div className="p-5 rounded-2xl bg-stone-100/80 border border-stone-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <label
                  htmlFor="num-cuchillos-input"
                  className="font-bold text-stone-900 text-base block"
                >
                  Número estimado de cuchillos de acero de filo liso
                </label>
                <p className="text-xs sm:text-sm text-stone-700 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-kusin-terra shrink-0" />
                  <span>
                    Recuerda: <strong>AFILO GRATIS TU PEOR CUCHILLO</strong> sin ningún compromiso, pero inclúyelo para estimar el tiempo de trabajo.
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setNumCuchillos((prev) => Math.max(1, prev - 1))}
                  className="w-11 h-11 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 flex items-center justify-center text-stone-900 font-bold shadow-sm"
                  aria-label="Disminuir número de cuchillos"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  id="num-cuchillos-input"
                  type="number"
                  min={1}
                  max={30}
                  value={numCuchillos}
                  onChange={(e) =>
                    setNumCuchillos(Math.max(1, Math.min(30, Number(e.target.value) || 1)))
                  }
                  className="w-20 text-center font-bold text-lg py-2 rounded-xl border border-stone-300 bg-white text-stone-900"
                />

                <button
                  type="button"
                  onClick={() => setNumCuchillos((prev) => Math.min(30, prev + 1))}
                  className="w-11 h-11 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 flex items-center justify-center text-stone-900 font-bold shadow-sm"
                  aria-label="Aumentar número de cuchillos"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Checkboxes Obligatorios */}
            <div className="space-y-3 pt-1">
              {modalidad === 'in_situ' && (
                <label className="flex items-start gap-3.5 p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/70 cursor-pointer hover:bg-amber-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={tieneEnchufe15m}
                    onChange={(e) => setTieneEnchufe15m(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-stone-400 text-kusin-terra focus:ring-kusin-terra shrink-0"
                    required
                  />
                  <span className="text-sm sm:text-base text-stone-900 font-medium">
                    <strong>Requisito técnico (Afilado In Situ):</strong> Confirmo que dispongo de
                    una toma de corriente cercana a menos de 15 metros.
                  </span>
                </label>
              )}

              <label className="flex items-start gap-3.5 p-4 rounded-2xl border border-stone-300 bg-stone-100/70 cursor-pointer hover:bg-stone-100 transition-colors">
                <input
                  type="checkbox"
                  checked={confirmaFiloLiso}
                  onChange={(e) => setConfirmaFiloLiso(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-stone-400 text-kusin-terra focus:ring-kusin-terra shrink-0"
                  required
                />
                <span className="text-sm sm:text-base text-stone-900 font-medium">
                  Confirmo que son <strong>solo cuchillos de acero de filo liso</strong> (quedan
                  excluidos cuchillos de sierra, cerámicos, tijeras, hachas o sierras).
                </span>
              </label>
            </div>
          </div>

          {/* ================================================================
              PASO 2: CALENDARIO DE DISPONIBILIDAD EN TIEMPO REAL
             ================================================================ */}
          <div className="rounded-3xl bg-[#FBF9F5] border-2 border-stone-300 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-stone-900 text-amber-400 font-bold text-sm flex items-center justify-center">
                  2
                </span>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                    Calendario de disponibilidad (Lunes a Viernes · 10:00 a 13:00)
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600">
                    Selecciona el día laborable y la hora que mejor te venga.
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                <Clock className="w-3.5 h-3.5 text-kusin-terra" />
                Duración estimada de la visita: <strong>{durationMinutes} minutos</strong>
              </span>
            </div>

            {/* Selector rápido de próximos días laborables + Input date */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                Próximos días laborables disponibles (L-V)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
                {businessDays.map((day) => {
                  const isSelected = fecha === day.isoDate;
                  return (
                    <button
                      key={day.isoDate}
                      type="button"
                      onClick={() => setFecha(day.isoDate)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                          : 'bg-stone-50 text-stone-800 border-stone-200 hover:border-stone-400'
                      }`}
                    >
                      <span
                        className={`block text-xs font-semibold ${
                          isSelected ? 'text-amber-400' : 'text-stone-500'
                        }`}
                      >
                        {day.dayName}
                      </span>
                      <span className="block text-lg font-bold leading-tight mt-0.5">
                        {day.dayNumber}
                      </span>
                      <span className="block text-[11px] opacity-80">{day.monthName}</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                <label htmlFor="custom-date-picker" className="text-xs font-semibold text-stone-600">
                  ¿Prefieres otra fecha del calendario (solo L-V)?
                </label>
                <input
                  id="custom-date-picker"
                  type="date"
                  value={fecha}
                  min={businessDays[0]?.isoDate}
                  onChange={(e) => setFecha(e.target.value)}
                  className="px-3.5 py-2 rounded-xl border border-stone-300 text-sm font-medium bg-white text-stone-900"
                />
              </div>

              {!dateValidation.valid && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-sm flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-kusin-terra shrink-0" />
                  <span>{dateValidation.reason}</span>
                </div>
              )}
            </div>

            {/* Píldoras de Horas Libres */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  Horas libres para el {fecha}
                </span>
                {loadingSlots && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Consultando agenda...
                  </span>
                )}
              </div>

              {availableSlots.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {availableSlots.map((slot) => {
                    const isPicked = horaSeleccionada === slot.time;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => setHoraSeleccionada(slot.time)}
                        className={`py-3.5 px-4 rounded-2xl font-bold text-sm sm:text-base border-2 transition-all flex flex-col items-center justify-center min-h-[58px] ${
                          isPicked
                            ? 'bg-kusin-terra text-white border-kusin-terra shadow-md scale-[1.02]'
                            : 'bg-stone-50 text-stone-900 border-stone-200 hover:border-amber-500'
                        }`}
                      >
                        <span>{slot.time}</span>
                        <span
                          className={`text-[11px] font-normal ${
                            isPicked ? 'text-amber-100' : 'text-stone-500'
                          }`}
                        >
                          hasta {slot.endTime}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                !loadingSlots &&
                dateValidation.valid && (
                  <p className="text-sm text-stone-600 bg-stone-50 p-4 rounded-xl border border-stone-200">
                    {availabilityMessage ||
                      'No hay huecos disponibles para esa combinación. Prueba con otro día laborable.'}
                  </p>
                )
              )}

              {/* Aviso de duración dinámica y entrega */}
              <div className="p-4 rounded-2xl bg-stone-100 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-stone-700">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-kusin-terra shrink-0" />
                  <span>
                    <strong>Duración estimada de la visita: {durationMinutes} minutos</strong> —{' '}
                    {durationBreakdown.label}.
                  </span>
                </div>
                <span className="font-semibold text-stone-900">
                  {durationBreakdown.deliveryNote}
                </span>
              </div>
            </div>
          </div>

          {/* ================================================================
              PASO 3: DATOS DE CONTACTO SIN TELÉFONO
             ================================================================ */}
          <div className="rounded-3xl bg-[#FBF9F5] border-2 border-stone-300 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-stone-900 text-amber-400 font-bold text-sm flex items-center justify-center">
                  3
                </span>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                    Datos de visita (Sin teléfono ni WhatsApp)
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600">
                    Respetamos tu privacidad: te enviamos confirmación por email y, si quieres, aviso
                    por Telegram.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />0 % Spam · Sin pedir móvil
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Nombre */}
              <div>
                <label
                  htmlFor="input-nombre"
                  className="block text-sm font-bold text-stone-800 mb-1.5"
                >
                  Nombre
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    id="input-nombre"
                    type="text"
                    required
                    placeholder="Ej. María Gómez / Carlos Ruiz"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-300 focus:border-kusin-terra focus:ring-2 focus:ring-amber-200 outline-none text-stone-900"
                  />
                </div>
              </div>

              {/* Correo electrónico */}
              <div>
                <label
                  htmlFor="input-email"
                  className="block text-sm font-bold text-stone-800 mb-1.5"
                >
                  Correo electrónico (para recibir confirmación)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    id="input-email"
                    type="email"
                    required
                    placeholder="tuemail@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-300 focus:border-kusin-terra focus:ring-2 focus:ring-amber-200 outline-none text-stone-900"
                  />
                </div>
              </div>

              {/* Dirección completa */}
              <div className="md:col-span-1">
                <label
                  htmlFor="input-direccion"
                  className="block text-sm font-bold text-stone-800 mb-1.5"
                >
                  Dirección completa (Calle, número, portal o chalé)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    id="input-direccion"
                    type="text"
                    required
                    placeholder="Ej. Av. de Monteclaro 14, Chalé 3"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-300 focus:border-kusin-terra focus:ring-2 focus:ring-amber-200 outline-none text-stone-900"
                  />
                </div>
              </div>

              {/* Código Postal (Validado estrictamente como 28224) */}
              <div>
                <label
                  htmlFor="input-cp"
                  className="block text-sm font-bold text-stone-800 mb-1.5"
                >
                  Código Postal (Exclusivo 28224)
                </label>
                <input
                  id="input-cp"
                  type="text"
                  maxLength={5}
                  required
                  value={codigoPostal}
                  onChange={(e) => setCodigoPostal(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border font-bold outline-none transition-colors ${
                    postalValidation.valid
                      ? 'border-emerald-400 bg-emerald-50/40 text-stone-900'
                      : 'border-amber-500 bg-amber-50 text-stone-900'
                  }`}
                />
                {!postalValidation.valid && (
                  <p className="mt-2 text-xs sm:text-sm text-amber-900 bg-amber-100/90 border border-amber-300 rounded-xl p-3 leading-relaxed">
                    {postalValidation.message}
                  </p>
                )}
              </div>

              {/* Notas opcionales */}
              <div className="md:col-span-2">
                <label
                  htmlFor="input-notas"
                  className="block text-sm font-bold text-stone-800 mb-1.5"
                >
                  Notas opcionales: Dado que no pido teléfono, te agradezco que la máxima precisión posible (indicaciones de timbre, puerta o lugar del enchufe).
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <textarea
                    id="input-notas"
                    rows={2}
                    placeholder="Ej. Timbre izquierdo, el enchufe está en el porche junto a la entrada..."
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-300 focus:border-kusin-terra focus:ring-2 focus:ring-amber-200 outline-none text-stone-900"
                  />
                </div>
              </div>
            </div>

            {formError && (
              <div
                role="alert"
                className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 text-sm font-medium flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-stone-600">
                <span>
                  Al confirmar, reservarás el bloque de{' '}
                  <strong>
                    {horaSeleccionada || '--:--'} ({durationMinutes} min)
                  </strong>{' '}
                  para el <strong>{fecha}</strong>.
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting || !postalValidation.valid}
                className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-base sm:text-lg font-bold bg-kusin-terra hover:bg-kusin-terraDark disabled:bg-stone-300 disabled:text-stone-500 text-white shadow-lg transition-all min-h-[56px]"
              >
                <Calendar className="w-5 h-5" />
                <span>
                  {submitting
                    ? 'Confirmando cita en agenda...'
                    : 'Confirmar cita y afilar gratis mi peor cuchillo'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
