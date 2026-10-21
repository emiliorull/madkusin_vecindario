/**
 * src/services/appointmentApi.js
 * Cliente HTTP desacoplado para comunicarse con los Webhooks de n8n
 * (VITE_N8N_WEBHOOK_DISPONIBILIDAD y VITE_N8N_WEBHOOK_RESERVAR).
 * Incluye modo Mock/Fallback inteligente automático para desarrollo y pruebas sin backend.
 */

import {
  calculateAppointmentDuration,
  computeAvailableSlots,
  validateOperatingDate,
  validateOperatingTime,
  validatePostalCode,
  minutesToTime,
  timeToMinutes
} from '../utils/scheduling';

const WEBHOOK_DISPONIBILIDAD = import.meta.env.VITE_N8N_WEBHOOK_DISPONIBILIDAD || '';
const WEBHOOK_RESERVAR = import.meta.env.VITE_N8N_WEBHOOK_RESERVAR || '';
const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'madkusin_citas_bot';

function isWebhookConfigured(url) {
  if (!url) return false;
  // Si sigue siendo el placeholder de .env.example y no responde, el try/catch hará fallback
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Consulta la disponibilidad de huecos para una fecha, modalidad y número de cuchillos.
 * Usado por el Paso 2 del calendario y por la herramienta `check_availability` del Agente de Voz.
 *
 * @param {object} params
 * @param {string} params.fecha Formato YYYY-MM-DD
 * @param {'in_situ' | 'recogida'} params.modalidad
 * @param {number} params.num_cuchillos
 */
export async function checkAvailability({ fecha, modalidad = 'in_situ', num_cuchillos = 1 }) {
  const safeCount = Math.max(1, Number.parseInt(num_cuchillos, 10) || 1);
  const duracion_minutos = calculateAppointmentDuration(modalidad, safeCount);

  const dateCheck = validateOperatingDate(fecha);
  if (!dateCheck.valid) {
    return {
      ok: false,
      source: 'validation',
      fecha,
      modalidad,
      num_cuchillos: safeCount,
      duracion_minutos,
      slots: [],
      message: dateCheck.reason
    };
  }

  // Si hay webhook configurado, intentamos consultar n8n en tiempo real
  if (isWebhookConfigured(WEBHOOK_DISPONIBILIDAD)) {
    try {
      const url = new URL(WEBHOOK_DISPONIBILIDAD);
      url.searchParams.set('fecha', fecha);
      url.searchParams.set('modalidad', modalidad);
      url.searchParams.set('num_cuchillos', String(safeCount));
      url.searchParams.set('duracion_minutos', String(duracion_minutos));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        // Soporta que n8n devuelva { slots: ["10:00", "11:00"] } o [{ time: "10:00", endTime: "10:35" }]
        const rawSlots = Array.isArray(data.slots)
          ? data.slots
          : Array.isArray(data.available_slots)
          ? data.available_slots
          : [];

        const normalizedSlots = rawSlots.map((item) => {
          const timeStr = typeof item === 'string' ? item : item.time || item.hora;
          return {
            time: timeStr,
            endTime:
              item?.endTime ||
              minutesToTime(timeToMinutes(timeStr) + duracion_minutos),
            label: `${timeStr} h`
          };
        });

        return {
          ok: true,
          source: 'n8n_live',
          fecha,
          modalidad,
          num_cuchillos: safeCount,
          duracion_minutos,
          slots: normalizedSlots,
          message:
            normalizedSlots.length > 0
              ? `Disponibilidad verificada para el ${fecha}. Duración estimada: ${duracion_minutos} minutos.`
              : 'No quedan huecos libres esa mañana. Por favor, prueba con otro día laborable.'
        };
      }
    } catch (err) {
      console.info(
        '[Madkusin Agenda] Webhook n8n no accesible aún; usando motor de disponibilidad local:',
        err.message
      );
    }
  }

  // Fallback / Mock inteligente (respeta L-V 10:00-13:00 y la duración dinámica exacta)
  const computed = computeAvailableSlots(fecha, modalidad, safeCount);
  return {
    ok: computed.available,
    source: 'smart_fallback',
    fecha,
    modalidad,
    num_cuchillos: safeCount,
    duracion_minutos: computed.durationMinutes,
    slots: computed.slots,
    message: computed.available
      ? `Huecos disponibles entre las 10:00 y las 13:00 (duración estimada de ${computed.durationMinutes} min).`
      : computed.reason || 'Sin huecos disponibles para esa fecha.'
  };
}

/**
 * Registra una cita de afilado en n8n (Google Calendar + PocketBase + Email .ics + Telegram deeplink).
 * Usado tanto por el formulario paso 3 como por la herramienta `book_appointment` del Agente de Voz.
 */
export async function bookAppointment(payload) {
  const {
    nombre,
    email,
    direccion,
    codigo_postal = '28224',
    modalidad = 'in_situ',
    num_cuchillos = 1,
    tiene_enchufe_15m = false,
    confirma_filo_liso = true,
    fecha,
    hora,
    notas = '',
    origen = 'web_form'
  } = payload;

  // 1. Validación estricta de Código Postal 28224
  const cpCheck = validatePostalCode(codigo_postal);
  if (!cpCheck.valid) {
    return {
      ok: false,
      error: cpCheck.message
    };
  }

  // 2. Validación de enchufe obligatorio a <15m en modalidad in_situ
  if (modalidad === 'in_situ' && !tiene_enchufe_15m) {
    return {
      ok: false,
      error:
        'Para el afilado in situ a domicilio es imprescindible disponer de un enchufe accesible a menos de 15 metros (Kusin lleva su propia alargadera de 15 m). Si no tienes enchufe cercano, elige la modalidad de Recogida y Entrega (24/48h).'
    };
  }

  // 3. Validación de fecha y hora operativa
  const safeCount = Math.max(1, Number.parseInt(num_cuchillos, 10) || 1);
  const duracion_minutos = calculateAppointmentDuration(modalidad, safeCount);

  const dateCheck = validateOperatingDate(fecha);
  if (!dateCheck.valid) {
    return {
      ok: false,
      error: dateCheck.reason
    };
  }

  const timeCheck = validateOperatingTime(hora, duracion_minutos);
  if (!timeCheck.valid) {
    return {
      ok: false,
      error: timeCheck.reason
    };
  }

  if (!nombre?.trim() || !email?.trim() || !direccion?.trim()) {
    return {
      ok: false,
      error: 'Por favor, completa nombre, correo electrónico y dirección completa en el 28224.'
    };
  }

  const startIso = `${fecha}T${hora}:00`;
  const endHora = timeCheck.endTime;
  const endIso = `${fecha}T${endHora}:00`;

  const requestBody = {
    nombre: nombre.trim(),
    email: email.trim().toLowerCase(),
    direccion: direccion.trim(),
    codigo_postal: cpCheck.normalized,
    modalidad,
    num_cuchillos: safeCount,
    duracion_minutos,
    tiene_enchufe_15m: Boolean(modalidad === 'in_situ' ? tiene_enchufe_15m : false),
    confirma_filo_liso: Boolean(confirma_filo_liso),
    fecha,
    hora_inicio: hora,
    hora_fin: endHora,
    start_iso: startIso,
    end_iso: endIso,
    notas: notas.trim(),
    origen,
    created_at: new Date().toISOString()
  };

  // Intentar llamada real al webhook POST de n8n si está configurado
  if (isWebhookConfigured(WEBHOOK_RESERVAR)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(WEBHOOK_RESERVAR, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const citaId = data.cita_id || data.id || `mk28224_${Date.now().toString(36)}`;
        const telegramDeeplink =
          data.telegram_deeplink ||
          `https://t.me/${TELEGRAM_BOT_USERNAME}?start=cita_${citaId}`;

        return {
          ok: true,
          source: 'n8n_live',
          cita_id: citaId,
          telegram_deeplink: telegramDeeplink,
          appointment: {
            ...requestBody,
            cita_id: citaId,
            telegram_deeplink: telegramDeeplink
          }
        };
      }
    } catch (err) {
      console.info(
        '[Madkusin Reserva] Webhook n8n no accesible aún; generando confirmación simulada para desarrollo:',
        err.message
      );
    }
  }

  // 2. Puente directo a PocketBase (/api/citas) si el webhook de n8n aún está inactivo
  try {
    const pbResponse = await fetch('/api/citas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (pbResponse.ok) {
      const pbData = await pbResponse.json();
      if (pbData.ok && pbData.cita_id) {
        return {
          ok: true,
          source: 'pocketbase_direct',
          cita_id: pbData.cita_id,
          telegram_deeplink: pbData.telegram_deeplink,
          appointment: {
            ...requestBody,
            cita_id: pbData.cita_id,
            telegram_deeplink: pbData.telegram_deeplink
          }
        };
      }
    }
  } catch {
    // Continúa al fallback local si se ejecuta fuera del servidor
  }

  // Fallback de desarrollo: genera un ID único realista y el deeplink de Telegram
  const fallbackId = `28224_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const telegramDeeplink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=cita_${fallbackId}`;

  return {
    ok: true,
    source: 'smart_fallback',
    cita_id: fallbackId,
    telegram_deeplink: telegramDeeplink,
    appointment: {
      ...requestBody,
      cita_id: fallbackId,
      telegram_deeplink: telegramDeeplink
    }
  };
}
