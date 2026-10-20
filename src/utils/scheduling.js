/**
 * src/utils/scheduling.js
 * Motor compartido de Reglas de Negocio y Cálculo de Agenda (Lunes a Viernes, 10:00 a 13:00).
 * Utilizado tanto por el formulario visual como por las herramientas (Function Calling) del Agente de Voz.
 */

export const ALLOWED_POSTAL_CODE = '28224';
export const OPERATING_HOURS = {
  startHour: 10, // 10:00
  endHour: 13,   // 13:00 (fin de jornada matinal)
  slotIntervalMinutes: 30 // Intervalos sugeridos: 10:00, 10:30, 11:00, 11:30, 12:00, 12:30
};

/**
 * Calcula dinámicamente la duración del bloque en Google Calendar (en minutos).
 *
 * Regla de negocio:
 * - Si modalidad === "in_situ":
 *   duracion_minutos = Math.max(15, num_cuchillos * 5) + 20
 *   (Ej: 1 cuchillo gratis = 15 + 20 = 35 min; 6 cuchillos = 30 + 20 = 50 min)
 * - Si modalidad === "recogida":
 *   duracion_minutos = 25 (bloque fijo de recogida + margen; entrega en 24/48h)
 *
 * @param {'in_situ' | 'recogida'} modalidad
 * @param {number} numCuchillos
 * @returns {number} Duración total en minutos
 */
export function calculateAppointmentDuration(modalidad, numCuchillos = 1) {
  const safeCount = Math.max(1, Number.parseInt(numCuchillos, 10) || 1);

  if (modalidad === 'recogida') {
    return 25;
  }

  // Por defecto "in_situ"
  return Math.max(15, safeCount * 5) + 20;
}

/**
 * Desglosa la explicación del tiempo estimado para mostrar al vecino con total transparencia.
 * @param {'in_situ' | 'recogida'} modalidad
 * @param {number} numCuchillos
 */
export function getDurationBreakdown(modalidad, numCuchillos = 1) {
  const safeCount = Math.max(1, Number.parseInt(numCuchillos, 10) || 1);
  const totalMinutes = calculateAppointmentDuration(modalidad, safeCount);

  if (modalidad === 'recogida') {
    return {
      totalMinutes,
      workMinutes: 5,
      marginMinutes: 20,
      label: `${totalMinutes} min (recogida rápida en puerta)`,
      deliveryNote: 'Entrega de tus cuchillos afilados en 24 a 48 horas'
    };
  }

  const workMinutes = Math.max(15, safeCount * 5);
  const marginMinutes = 20;
  return {
    totalMinutes,
    workMinutes,
    marginMinutes,
    label: `${totalMinutes} min (${workMinutes} min de afilado y prueba + ${marginMinutes} min de margen y desplazamiento)`,
    deliveryNote: 'Afilado y prueba en el acto frente a tu domicilio'
  };
}

/**
 * Valida estrictamente que el Código Postal sea 28224 (Pozuelo de Alarcón).
 * @param {string} postalCode
 * @returns {{ valid: boolean, normalized: string, message: string }}
 */
export function validatePostalCode(postalCode) {
  const normalized = String(postalCode ?? '').trim().replace(/\s+/g, '');

  if (!normalized) {
    return {
      valid: false,
      normalized,
      message: 'Por favor, indica tu código postal para confirmar que estás en la zona de servicio.'
    };
  }

  if (normalized !== ALLOWED_POSTAL_CODE) {
    return {
      valid: false,
      normalized,
      message:
        '¡Muchas gracias por tu interés! En esta fase vecinal, el servicio a domicilio de Kusin y la prueba gratuita de tu peor cuchillo están activos exclusivamente en el código postal 28224 (Pozuelo de Alarcón).'
    };
  }

  return {
    valid: true,
    normalized: ALLOWED_POSTAL_CODE,
    message: 'Código postal 28224 verificado: estás dentro del vecindario de servicio de Kusin.'
  };
}

/**
 * Comprueba si una fecha YYYY-MM-DD cae de Lunes (1) a Viernes (5) y no es pasada.
 * @param {string} dateStr Formato YYYY-MM-DD
 * @returns {{ valid: boolean, reason?: string, dayOfWeek?: number }}
 */
export function validateOperatingDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return {
      valid: false,
      reason: 'Selecciona una fecha válida en formato AAAA-MM-DD.'
    };
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const selectedDate = new Date(year, month - 1, day, 12, 0, 0);

  if (Number.isNaN(selectedDate.getTime())) {
    return {
      valid: false,
      reason: 'La fecha indicada no es válida.'
    };
  }

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  if (selectedDate < todayMidnight) {
    return {
      valid: false,
      reason: 'No es posible reservar en una fecha pasada. Elige un día laborable a partir de hoy.'
    };
  }

  const dayOfWeek = selectedDate.getDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      valid: false,
      dayOfWeek,
      reason:
        'Kusin pasa por el vecindario de Lunes a Viernes de 10:00 a 13:00. Por favor, selecciona un día laborable (L-V).'
    };
  }

  return {
    valid: true,
    dayOfWeek
  };
}

/**
 * Convierte "HH:MM" en minutos desde las 00:00.
 */
export function timeToMinutes(timeStr) {
  const [hours, minutes] = String(timeStr || '00:00').split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Convierte minutos desde las 00:00 en "HH:MM".
 */
export function minutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Valida que una hora de inicio ("HH:MM") esté dentro del horario 10:00 - 13:00
 * y que la cita no termine más tarde de las 13:20 (margen operativo final).
 */
export function validateOperatingTime(timeStr, durationMinutes = 35) {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return {
      valid: false,
      reason: 'Indica una hora válida entre las 10:00 y las 13:00.'
    };
  }

  const startMinutes = timeToMinutes(timeStr);
  const openMinutes = OPERATING_HOURS.startHour * 60; // 600 (10:00)
  const closeMinutes = OPERATING_HOURS.endHour * 60;  // 780 (13:00)

  if (startMinutes < openMinutes || startMinutes >= closeMinutes) {
    return {
      valid: false,
      reason: 'El horario de atención en el vecindario es de 10:00 a 13:00 (Lunes a Viernes).'
    };
  }

  // Permitimos que el último turno (ej. 12:30) finalice hasta las 13:25 como máximo
  const maxEndMinutes = closeMinutes + 25;
  if (startMinutes + durationMinutes > maxEndMinutes) {
    return {
      valid: false,
      reason: `Para una visita estimada de ${durationMinutes} minutos, elige una hora más temprana para terminar dentro del turno de mañana (antes de las 13:00).`
    };
  }

  return {
    valid: true,
    startTime: timeStr,
    endTime: minutesToTime(startMinutes + durationMinutes)
  };
}

/**
 * Genera los próximos N días laborables (Lunes a Viernes) para facilitar la selección rápida.
 * @param {number} count Número de días laborables a generar
 */
export function getUpcomingBusinessDays(count = 10) {
  const days = [];
  const current = new Date();

  // Si ya pasaron las 12:15 de hoy, empezamos desde mañana
  if (current.getHours() >= 12) {
    current.setDate(current.getDate() + 1);
  }

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  while (days.length < count) {
    const dow = current.getDay();
    if (dow >= 1 && dow <= 5) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      const isoDate = `${yyyy}-${mm}-${dd}`;

      days.push({
        isoDate,
        dayName: dayNames[dow],
        dayNumber: current.getDate(),
        monthName: monthNames[current.getMonth()],
        fullLabel: `${dayNames[dow]} ${current.getDate()} ${monthNames[current.getMonth()]}`
      });
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

/**
 * Genera huecos disponibles realistas (entre 10:00 y 13:00) teniendo en cuenta
 * la duración calculada del bloque y posibles bloques ocupados en Google Calendar.
 *
 * @param {string} dateStr YYYY-MM-DD
 * @param {'in_situ' | 'recogida'} modalidad
 * @param {number} numCuchillos
 * @param {Array<{start: string, end: string}>} busyBlocks Bloques ocupados opcionales ("HH:MM")
 */
export function computeAvailableSlots(
  dateStr,
  modalidad = 'in_situ',
  numCuchillos = 1,
  busyBlocks = null
) {
  const dateValidation = validateOperatingDate(dateStr);
  if (!dateValidation.valid) {
    return {
      available: false,
      reason: dateValidation.reason,
      durationMinutes: calculateAppointmentDuration(modalidad, numCuchillos),
      slots: []
    };
  }

  const durationMinutes = calculateAppointmentDuration(modalidad, numCuchillos);
  const candidateStarts = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];

  // Si no vienen bloques ocupados del webhook, simulamos de forma determinista según la fecha
  // para que el modo Mock/Fallback durante el desarrollo se sienta 100% real y consistente.
  let effectiveBusy = busyBlocks;
  if (!Array.isArray(effectiveBusy)) {
    const seed = dateStr
      .split('-')
      .reduce((acc, part) => acc + Number.parseInt(part, 10), 0);
    // Ocupamos 1 hueco de muestra según el día para realismo visual
    const sampleBusySlot = candidateStarts[seed % candidateStarts.length];
    effectiveBusy = [
      {
        start: sampleBusySlot,
        end: minutesToTime(timeToMinutes(sampleBusySlot) + 30)
      }
    ];
  }

  const validSlots = candidateStarts.filter((slotStart) => {
    const timeCheck = validateOperatingTime(slotStart, durationMinutes);
    if (!timeCheck.valid) return false;

    const slotStartMin = timeToMinutes(slotStart);
    const slotEndMin = slotStartMin + durationMinutes;

    // Comprobar solapamiento con bloques ocupados
    const overlaps = effectiveBusy.some((busy) => {
      const bStart = timeToMinutes(busy.start);
      const bEnd = timeToMinutes(busy.end);
      return slotStartMin < bEnd && slotEndMin > bStart;
    });

    return !overlaps;
  });

  return {
    available: validSlots.length > 0,
    date: dateStr,
    modalidad,
    numCuchillos,
    durationMinutes,
    slots: validSlots.map((start) => ({
      time: start,
      endTime: minutesToTime(timeToMinutes(start) + durationMinutes),
      label: `${start} h`
    }))
  };
}
