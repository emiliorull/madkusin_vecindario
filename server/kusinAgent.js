/**
 * server/kusinAgent.js
 * Cerebro central del Agente IA Kusin con arquitectura Zero-Trust y Doble Canal:
 * 1. Canal Usuarios (Web + Bot Público Telegram @madkusin_citas_bot):
 *    - Alimentado por la documentación técnica proporcionada (RAG: manual técnico + doctrina del taller + documentos aprendidos).
 *    - Sin respuestas preestablecidas: responde todas las preguntas del usuario basándose fielmente en la documentación proporcionada.
 *    - Permite al usuario consultar todos los datos de su cita (fecha, hora, dirección completa, correo electrónico, número de cuchillos, modalidad y notas)
 *      y modificar cualquier dato que necesite en tiempo real (sincronizando PocketBase y Google Calendar).
 *    - Aislamiento Zero-Trust: jamás puede consultar ni recibir datos de otros usuarios.
 *
 * 2. Canal Privado Admin (2.º Bot Exclusivo de Emil):
 *    - 100 % opaco e independiente del canal de usuarios.
 *    - Permite a Emil subir documentos técnicos (.pdf, .txt, .md en español o inglés), añadir notas
 *      al RAG en caliente, consultar todas las citas de PocketBase y auditar las respuestas del agente.
 */

import { ragEngine } from './ragEngine.js';

const POCKETBASE_INTERNAL_URL = process.env.POCKETBASE_URL || 'http://pocketbase:8090';
const N8N_INTERNAL_URL = process.env.N8N_INTERNAL_URL || 'http://n8n:5678';

const VALID_ORIGINS = new Set([
  'web_form',
  'voice_assistant_gemini',
  'voice_assistant_elevenlabs',
  'voice_assistant_hybrid',
  'web_ai_agent',
  'telegram_ai_agent',
  'kusin_ai_agent'
]);

/**
 * Sanitiza un ID de Telegram (solo dígitos y guion opcional) para evitar cualquier inyección en filtros.
 */
function sanitizeTelegramChatId(chatId) {
  if (!chatId) return '';
  return String(chatId).replace(/[^0-9-]/g, '');
}

/**
 * Normaliza una hora a formato HH:MM válido dentro de 10:00 - 12:59 para cumplir el esquema de PocketBase.
 */
function normalizeOperatingTime(rawTime) {
  const clean = String(rawTime || '10:30').trim().replace(/\s*h$/i, '');
  const match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '10:30';
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 10 || h > 12 || m < 0 || m > 59) return '10:30';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calcula la duración estimada de la cita según modalidad y número de cuchillos (misma regla en web, n8n y PocketBase).
 */
export function calculateDurationMinutes(modalidad, numCuchillos) {
  const count = Math.max(1, Number(numCuchillos || 1));
  if (modalidad === 'recogida') return 25;
  return Math.max(15, count * 5) + 20;
}

/**
 * Suma minutos a una hora "HH:MM"
 */
function addMinutesToTime(timeStr, minutesToAdd) {
  const [h, m] = String(timeStr || '10:00').split(':').map(Number);
  const total = h * 60 + m + minutesToAdd;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

/**
 * Mapea un registro de PocketBase a un objeto de cita completo con todos sus datos disponibles.
 */
function mapPocketBaseRecordToCita(c) {
  if (!c) return null;
  return {
    id: c.id,
    nombre: c.nombre || '',
    email: c.email || '',
    fecha: c.fecha || '',
    hora_inicio: c.hora_inicio || '',
    hora_fin: c.hora_fin || addMinutesToTime(c.hora_inicio || '10:30', Number(c.duracion_minutos || 35)),
    duracion_minutos: Number(c.duracion_minutos || 35),
    modalidad: c.modalidad || 'in_situ',
    num_cuchillos: Number(c.num_cuchillos || 1),
    direccion: c.direccion || '',
    tiene_enchufe_15m: Boolean(c.tiene_enchufe_15m),
    notas: c.notas || '',
    estado: c.estado || 'confirmada',
    gcal_event_id: c.gcal_event_id || '',
    telegram_chat_id: c.telegram_chat_id || ''
  };
}

/**
 * Formatea los datos completos de una cita para Telegram sin mostrar códigos internos (#id)
 * y sin referencias geográficas preestablecidas.
 */
export function formatAppointmentDetailsForTelegram(cita) {
  if (!cita) return '';
  const modalidadLabel =
    cita.modalidad === 'recogida'
      ? 'Recogida y entrega en 24/48h'
      : 'Afilado in situ a domicilio';

  const lines = [
    `• *Fecha:* ${cita.fecha}`,
    `• *Hora:* ${cita.hora_inicio}${cita.hora_fin ? ` a ${cita.hora_fin}` : ''} h`,
    `• *Dirección completa:* ${cita.direccion}`,
    `• *Correo electrónico:* ${cita.email}`,
    `• *Número de cuchillos:* ${cita.num_cuchillos} (${modalidadLabel})`
  ];

  if (cita.nombre) {
    lines.unshift(`• *Nombre:* ${cita.nombre}`);
  }
  if (cita.notas) {
    lines.push(`• *Notas:* ${cita.notas}`);
  }

  return lines.join('\n');
}

/**
 * Consulta en PocketBase y Google Calendar (vía n8n) los huecos libres de una fecha devolviendo ÚNICAMENTE horas disponibles
 * (Zero-Trust: jamás expone nombres, emails ni direcciones de otros usuarios al modelo IA).
 */
export async function checkAvailabilityZeroTrust({
  fecha,
  modalidad = 'in_situ',
  num_cuchillos = 1,
  excludeCitaId = null
}) {
  const duracion = calculateDurationMinutes(modalidad, num_cuchillos);
  const candidateSlots = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
  const safeDate = String(fecha || '').replace(/[^0-9-]/g, '');

  const occupiedRanges = [];

  // 1. Consultar PocketBase
  try {
    const filter = encodeURIComponent(`(fecha='${safeDate}' && estado!='cancelada')`);
    const res = await fetch(
      `${POCKETBASE_INTERNAL_URL}/api/collections/citas/records?filter=${filter}&perPage=50`
    );
    if (res.ok) {
      const data = await res.json();
      for (const item of data.items || []) {
        if (excludeCitaId && item.id === excludeCitaId) continue;
        const [sh, sm] = String(item.hora_inicio || '10:00').split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = startMin + Number(item.duracion_minutos || 35);
        occupiedRanges.push({ startMin, endMin });
      }
    }
  } catch {
    // Continúa si PocketBase no está accesible en local
  }

  // 2. Consultar Google Calendar a través del webhook interno de n8n si no estamos excluyendo una cita propia
  if (!excludeCitaId) {
    try {
      const url = new URL(`${N8N_INTERNAL_URL}/webhook/vecindario-disponibilidad`);
      url.searchParams.set('fecha', safeDate);
      url.searchParams.set('modalidad', modalidad);
      url.searchParams.set('num_cuchillos', String(num_cuchillos));
      url.searchParams.set('duracion_minutos', String(duracion));

      const n8nRes = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
      if (n8nRes.ok) {
        const n8nData = await n8nRes.json();
        if (Array.isArray(n8nData.slots)) {
          const gcalAllowed = new Set(
            n8nData.slots.map((s) => (typeof s === 'string' ? s : s.time || s.hora))
          );
          for (const candidate of candidateSlots) {
            if (!gcalAllowed.has(candidate)) {
              const [ch, cm] = candidate.split(':').map(Number);
              const cStart = ch * 60 + cm;
              occupiedRanges.push({ startMin: cStart, endMin: cStart + 30 });
            }
          }
        }
      }
    } catch {
      // Si n8n no responde localmente, se usan los rangos de PocketBase
    }
  }

  const freeSlots = candidateSlots.filter((slot) => {
    const [h, m] = slot.split(':').map(Number);
    const slotStart = h * 60 + m;
    const slotEnd = slotStart + duracion;
    if (slotEnd > 13 * 60 + 25) return false;
    return !occupiedRanges.some((occ) => slotStart < occ.endMin && slotEnd > occ.startMin);
  });

  return {
    ok: true,
    fecha: safeDate,
    modalidad,
    num_cuchillos: Number(num_cuchillos || 1),
    duracion_minutos: duracion,
    slots: freeSlots.map((time) => ({
      time,
      endTime: addMinutesToTime(time, duracion),
      available: true
    })),
    free_times: freeSlots
  };
}

/**
 * Crea una cita nueva sincronizando Google Calendar, envío de correo de confirmación (.ics) y PocketBase.
 */
export async function createAppointmentInPocketBase(args) {
  const modalidad = args.modalidad === 'recogida' ? 'recogida' : 'in_situ';
  const numCuchillos = Math.max(1, Number(args.num_cuchillos || 1));
  const duracion = calculateDurationMinutes(modalidad, numCuchillos);
  const horaInicio = normalizeOperatingTime(args.hora || args.hora_inicio || '10:30');
  const horaFin = addMinutesToTime(horaInicio, duracion);
  const rawOrigen = String(args.origen || 'web_form').trim();
  const safeOrigen = VALID_ORIGINS.has(rawOrigen) ? rawOrigen : 'web_form';
  const safeTelegramChatId = args.telegram_chat_id ? sanitizeTelegramChatId(args.telegram_chat_id) : '';

  const pbPayload = {
    nombre: String(args.nombre || 'Cliente').trim(),
    email: String(args.email || '').trim().toLowerCase(),
    direccion: String(args.direccion || '').trim(),
    codigo_postal: '28224',
    modalidad,
    num_cuchillos: numCuchillos,
    duracion_minutos: duracion,
    tiene_enchufe_15m: modalidad === 'in_situ' ? Boolean(args.tiene_enchufe_15m ?? true) : false,
    confirma_filo_liso: true,
    fecha: String(args.fecha || '').trim(),
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    notas: String(args.notas || '').trim(),
    estado: 'confirmada',
    origen: safeOrigen,
    telegram_chat_id: safeTelegramChatId
  };

  const botUsername = process.env.VITE_TELEGRAM_BOT_USERNAME || 'madkusin_citas_bot';

  // 1. Intentar flujo completo a través de n8n (PocketBase + Google Calendar + Confirmación por Email con .ics)
  if (!args.skipN8n) {
    try {
      const n8nRes = await fetch(`${N8N_INTERNAL_URL}/webhook/vecindario-reservar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pbPayload),
        signal: AbortSignal.timeout(8000)
      });

      if (n8nRes.ok) {
        const n8nData = await n8nRes.json();
        if (n8nData.ok && n8nData.cita_id) {
          if (safeTelegramChatId) {
            await fetch(`${POCKETBASE_INTERNAL_URL}/api/collections/citas/records/${n8nData.cita_id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ telegram_chat_id: safeTelegramChatId })
            }).catch(() => {});
          }

          const telegramDeeplink =
            n8nData.telegram_deeplink || `https://t.me/${botUsername}?start=cita_${n8nData.cita_id}`;

          return {
            ok: true,
            cita_id: n8nData.cita_id,
            gcal_event_id: n8nData.gcal_event_id || '',
            telegram_deeplink: telegramDeeplink,
            appointment: {
              cita_id: n8nData.cita_id,
              ...pbPayload,
              hora: horaInicio,
              gcal_event_id: n8nData.gcal_event_id || '',
              telegram_deeplink: telegramDeeplink
            }
          };
        }
      }
    } catch {
      // Si n8n no está accesible localmente, insertar directamente en PocketBase
    }
  }

  // 2. Inserción directa en PocketBase
  try {
    const pbRes = await fetch(`${POCKETBASE_INTERNAL_URL}/api/collections/citas/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pbPayload)
    });

    if (!pbRes.ok) {
      const errText = await pbRes.text();
      return { ok: false, error: `Error guardando en PocketBase: ${errText}` };
    }

    const record = await pbRes.json();
    const telegramDeeplink = `https://t.me/${botUsername}?start=cita_${record.id}`;

    return {
      ok: true,
      cita_id: record.id,
      telegram_deeplink: telegramDeeplink,
      appointment: {
        cita_id: record.id,
        ...pbPayload,
        hora: horaInicio,
        telegram_deeplink: telegramDeeplink
      }
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Obtiene EXCLUSIVAMENTE las citas activas vinculadas al telegram_chat_id verificado por el servidor (Zero-Trust),
 * incluyendo todos los datos disponibles (fecha, hora, dirección completa, correo electrónico, número de cuchillos, modalidad, notas).
 */
export async function getUserOwnAppointmentsByTelegramId(verifiedChatId) {
  const safeChatId = sanitizeTelegramChatId(verifiedChatId);
  if (!safeChatId) return [];

  try {
    const filter = encodeURIComponent(`(telegram_chat_id='${safeChatId}' && estado!='cancelada')`);
    const res = await fetch(
      `${POCKETBASE_INTERNAL_URL}/api/collections/citas/records?filter=${filter}&sort=-created&perPage=5`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(mapPocketBaseRecordToCita);
  } catch {
    return [];
  }
}

/**
 * Busca una cita activa por correo electrónico y la vincula al telegram_chat_id actual
 * si aún no estaba vinculada a otro usuario distinto.
 */
export async function findAndLinkAppointmentByEmail(email, verifiedChatId) {
  const safeEmail = String(email || '').trim().toLowerCase().replace(/['"\\]/g, '');
  const safeChatId = sanitizeTelegramChatId(verifiedChatId);
  if (!safeEmail || !safeEmail.includes('@')) {
    return { ok: false, error: 'Correo electrónico no válido.' };
  }

  try {
    const filter = encodeURIComponent(`(email='${safeEmail}' && estado!='cancelada')`);
    const res = await fetch(
      `${POCKETBASE_INTERNAL_URL}/api/collections/citas/records?filter=${filter}&sort=-created&perPage=5`
    );
    if (!res.ok) return { ok: false, error: 'No se pudo consultar la base de datos.' };
    const data = await res.json();
    const items = data.items || [];
    if (items.length === 0) {
      return { ok: false, error: `No se encontró ninguna cita activa registrada con el correo ${safeEmail}.` };
    }

    const record = items.find(
      (item) => !item.telegram_chat_id || String(item.telegram_chat_id) === safeChatId
    );

    if (!record) {
      return {
        ok: false,
        error: 'Por seguridad, la cita asociada a ese correo ya está vinculada a otro chat de Telegram.'
      };
    }

    if (safeChatId && String(record.telegram_chat_id) !== safeChatId) {
      const patchRes = await fetch(
        `${POCKETBASE_INTERNAL_URL}/api/collections/citas/records/${record.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegram_chat_id: safeChatId })
        }
      );
      if (patchRes.ok) {
        const updated = await patchRes.json();
        return { ok: true, cita: mapPocketBaseRecordToCita(updated) };
      }
    }

    return { ok: true, cita: mapPocketBaseRecordToCita(record) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Vincula una cita con el telegram_chat_id del usuario cuando pulsa /start cita_ID,
 * SOLO si la cita no pertenecía ya a otro telegram_chat_id distinto (protección anti-secuestro de ID).
 */
export async function linkAppointmentToTelegramChat(citaId, verifiedChatId) {
  const safeCitaId = String(citaId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeChatId = sanitizeTelegramChatId(verifiedChatId);
  if (!safeCitaId || !safeChatId) return { ok: false, reason: 'INVALID_ID' };

  try {
    let existing = null;
    const getRes = await fetch(`${POCKETBASE_INTERNAL_URL}/api/collections/citas/records/${safeCitaId}`);
    if (getRes.ok) {
      existing = await getRes.json();
    } else {
      // Buscar también por gcal_event_id por si el enlace contenía el ID de Google Calendar
      const filter = encodeURIComponent(`(gcal_event_id='${safeCitaId}')`);
      const searchRes = await fetch(
        `${POCKETBASE_INTERNAL_URL}/api/collections/citas/records?filter=${filter}&perPage=1`
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        existing = searchData.items?.[0] || null;
      }
    }

    if (!existing) {
      return { ok: false, reason: 'NOT_FOUND' };
    }

    // Si ya tiene otro telegram_chat_id distinto asignado, bloquear por seguridad Zero-Trust
    if (existing.telegram_chat_id && String(existing.telegram_chat_id) !== safeChatId) {
      return { ok: false, reason: 'ALREADY_LINKED_TO_ANOTHER_USER' };
    }

    const patchRes = await fetch(
      `${POCKETBASE_INTERNAL_URL}/api/collections/citas/records/${existing.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_chat_id: safeChatId })
      }
    );

    if (!patchRes.ok) return { ok: false, reason: 'UPDATE_FAILED' };
    const updated = await patchRes.json();
    return {
      ok: true,
      cita: mapPocketBaseRecordToCita(updated)
    };
  } catch {
    return { ok: false, reason: 'POCKETBASE_UNREACHABLE' };
  }
}

/**
 * Modifica los datos de la cita del usuario en PocketBase y sincroniza el cambio en Google Calendar + correo de confirmación.
 */
export async function updateUserAppointmentInPocketBase(args, verifiedChatId) {
  const safeChatId = sanitizeTelegramChatId(verifiedChatId);
  let ownAppointments = safeChatId ? await getUserOwnAppointmentsByTelegramId(safeChatId) : [];

  if (ownAppointments.length === 0 && args.email_actual) {
    const found = await findAndLinkAppointmentByEmail(args.email_actual, safeChatId);
    if (found.ok && found.cita) {
      ownAppointments = [found.cita];
    }
  }

  if (ownAppointments.length === 0) {
    return {
      ok: false,
      error:
        'No se encontró una cita vinculada a este chat. Por favor, indícame el correo electrónico con el que hiciste la reserva para localizarla.'
    };
  }

  const current = ownAppointments[0];
  const nextModalidad =
    args.modalidad === 'recogida' || args.modalidad === 'in_situ'
      ? args.modalidad
      : current.modalidad;
  const nextNumCuchillos =
    args.num_cuchillos !== undefined && args.num_cuchillos !== null
      ? Math.max(1, Number(args.num_cuchillos))
      : current.num_cuchillos;
  const nextDuracion = calculateDurationMinutes(nextModalidad, nextNumCuchillos);
  const nextFecha = args.fecha ? String(args.fecha).trim() : current.fecha;
  const nextHoraInicio =
    args.hora || args.hora_inicio
      ? normalizeOperatingTime(args.hora || args.hora_inicio)
      : current.hora_inicio;
  const nextHoraFin = addMinutesToTime(nextHoraInicio, nextDuracion);

  // Si cambia fecha u hora, verificar que sea lunes a viernes y que el hueco esté libre
  if (nextFecha !== current.fecha || nextHoraInicio !== current.hora_inicio) {
    const [y, m, d] = nextFecha.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
    const dow = dt.getDay();
    if (Number.isNaN(dt.getTime()) || dow === 0 || dow === 6) {
      return {
        ok: false,
        error: 'El horario de citas es de lunes a viernes de 10:00 a 13:00. Por favor, elige un día laborable (lunes a viernes).'
      };
    }

    const avail = await checkAvailabilityZeroTrust({
      fecha: nextFecha,
      modalidad: nextModalidad,
      num_cuchillos: nextNumCuchillos,
      excludeCitaId: current.id
    });

    const [sh, sm] = nextHoraInicio.split(':').map(Number);
    const startMin = sh * 60 + sm;
    if (startMin < 10 * 60 || startMin + nextDuracion > 13 * 60 + 25) {
      return {
        ok: false,
        error: `La hora ${nextHoraInicio} queda fuera del horario de mañana (10:00 a 13:00). Horas disponibles para el ${nextFecha}: ${avail.free_times.join(', ') || 'ninguna'}.`
      };
    }
  }

  const updatePayload = {
    nombre: args.nombre ? String(args.nombre).trim() : current.nombre,
    email: args.email ? String(args.email).trim().toLowerCase() : current.email,
    direccion: args.direccion ? String(args.direccion).trim() : current.direccion,
    modalidad: nextModalidad,
    num_cuchillos: nextNumCuchillos,
    duracion_minutos: nextDuracion,
    tiene_enchufe_15m:
      nextModalidad === 'in_situ'
        ? args.tiene_enchufe_15m !== undefined
          ? Boolean(args.tiene_enchufe_15m)
          : Boolean(current.tiene_enchufe_15m ?? true)
        : false,
    fecha: nextFecha,
    hora_inicio: nextHoraInicio,
    hora_fin: nextHoraFin,
    notas: args.notas !== undefined ? String(args.notas).trim() : current.notas,
    estado:
      args.estado === 'cancelada' || args.estado === 'confirmada'
        ? args.estado
        : current.estado
  };

  try {
    const patchRes = await fetch(
      `${POCKETBASE_INTERNAL_URL}/api/collections/citas/records/${current.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      }
    );

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      return { ok: false, error: `No se pudo actualizar la cita en la base de datos: ${errText}` };
    }

    const updatedRecord = await patchRes.json();
    const mappedCita = mapPocketBaseRecordToCita(updatedRecord);

    // Sincronizar modificación con Google Calendar y enviar correo actualizado a través de n8n
    try {
      await fetch(`${N8N_INTERNAL_URL}/webhook/vecindario-modificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cita_id: mappedCita.id,
          gcal_event_id: mappedCita.gcal_event_id,
          ...updatePayload,
          start_iso: `${mappedCita.fecha}T${mappedCita.hora_inicio}:00`,
          end_iso: `${mappedCita.fecha}T${mappedCita.hora_fin}:00`
        }),
        signal: AbortSignal.timeout(6000)
      });
    } catch {
      // Si n8n no responde localmente, la cita ya quedó actualizada en PocketBase
    }

    return {
      ok: true,
      cita: mappedCita
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Envía un aviso inmediato al canal privado de Telegram de Emil cuando un cliente solicita atención humana directa.
 */
export async function notifyEmilHumanAttention({
  motivo = '',
  nombre = '',
  email = '',
  channel = 'web',
  ownAppointments = []
}) {
  const adminToken = process.env.TELEGRAM_ADMIN_BOT_TOKEN || '';
  const adminChatIds = (process.env.ADMIN_TELEGRAM_CHAT_ID || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const cita = ownAppointments?.[0] || null;
  const contactName = nombre || cita?.nombre || 'Cliente';
  const contactEmail = email || cita?.email || 'No indicado aún';

  const alertText =
    `🙋‍♂️ *Solicitud de Atención Humana Directa (${channel === 'telegram_user' ? 'Telegram' : 'Web'})*\n\n` +
    `• *Cliente:* ${contactName}\n` +
    `• *Correo electrónico:* ${contactEmail}\n` +
    (cita
      ? `• *Cita vinculada:* ${cita.fecha} a las ${cita.hora_inicio} h · ${cita.direccion} (${cita.num_cuchillos} cuchillos, ${cita.modalidad})\n`
      : '') +
    `• *Mensaje / Motivo:* ${motivo || 'El cliente solicita que Emil le atienda personalmente.'}`;

  if (adminToken && adminChatIds.length > 0) {
    for (const adminId of adminChatIds) {
      await fetch(`https://api.telegram.org/bot${adminToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminId,
          text: alertText
        })
      }).catch(() => {});
    }
  }

  return {
    ok: true,
    notified: Boolean(adminToken && adminChatIds.length > 0),
    direct_email: 'emil@madkusin.com',
    contact_email_recorded: contactEmail
  };
}

/**
 * Construye el System Prompt para el canal de Usuarios (Web y Telegram Público).
 * Sin respuestas preestablecidas: responde a todas las preguntas basándose en la documentación proporcionada
 * y en los datos reales de la cita del usuario.
 */
function buildUserAgentSystemPrompt({ ragChunks, ownAppointments, channel }) {
  const todayIso = new Date().toISOString().split('T')[0];
  const ragContext = ragChunks
    .map((c, idx) => `[DOCUMENTO ${idx + 1} - ${c.title}]:\n${c.content}`)
    .join('\n\n');

  let personalDataSection = '';
  if (channel === 'telegram_user') {
    if (ownAppointments.length > 0) {
      const sanitizedForPrompt = ownAppointments.map((c) => ({
        nombre: c.nombre,
        fecha: c.fecha,
        hora: `${c.hora_inicio} a ${c.hora_fin}`,
        direccion_completa: c.direccion,
        correo_electronico: c.email,
        numero_de_cuchillos: c.num_cuchillos,
        modalidad:
          c.modalidad === 'recogida'
            ? 'Recogida y entrega en 24/48h'
            : 'Afilado in situ a domicilio',
        notas: c.notas || 'Sin notas adicionales',
        estado: c.estado
      }));
      personalDataSection = `DATOS DE LA CITA ACTUAL DEL USUARIO EN ESTE CHAT DE TELEGRAM:\n${JSON.stringify(
        sanitizedForPrompt,
        null,
        2
      )}\n- Cuando el usuario consulte su cita, muéstrale TODOS estos datos disponibles (fecha, hora, dirección completa, correo electrónico y número de cuchillos, además de modalidad y notas si las hay) y ofrécele siempre la opción de modificar cualquier dato que necesite.\n- Si el usuario pide cambiar o modificar cualquier dato de su cita (fecha, hora, dirección, correo electrónico, número de cuchillos, modalidad, notas o cancelarla), ejecuta la herramienta \`update_appointment\` y confirma los datos actualizados.`;
    } else {
      personalDataSection = `ESTADO DE CITA EN ESTE CHAT DE TELEGRAM: Aún no hay ninguna cita vinculada automáticamente a este chat. Si el usuario pregunta por su cita o quiere consultarla/modificarla, pídele el correo electrónico con el que reservó y usa la herramienta \`lookup_appointment_by_email\` para localizarla, vincularla y mostrarle todos sus datos.`;
    }
  } else {
    personalDataSection = `SESIÓN WEB: El usuario está en el asistente web de vecindario.madkusin.com. Puede hacer cualquier pregunta técnica o sobre el servicio, consultar disponibilidad (\`check_availability\`), reservar una cita nueva (\`book_appointment\`), o consultar/modificar su cita indicando su correo electrónico (\`lookup_appointment_by_email\` / \`update_appointment\`).`;
  }

  return `Eres Kusin, el asistente técnico de inteligencia artificial del taller de afilado de Emil (MadKusin · vecindario.madkusin.com).
Fecha actual: ${todayIso}. Canal: ${channel}.

DIRECTRICES FUNDAMENTALES Y OBLIGATORIAS:
1. ÁMBITO EXCLUSIVO DE RESPUESTA (SOLO TEMAS DE MADKUSIN):
   - ÚNICAMENTE debes responder preguntas relacionadas con:
     * Servicios de afilado de MadKusin (método en banda y strop, modalidades in situ a domicilio y recogida/entrega en 24/48h)
     * Cuidado, mantenimiento y uso correcto de cuchillos
     * Tipos de cuchillos, aceros, temple, geometrías y ángulos de corte
     * Tarifas y condiciones del servicio (afilado 100 % gratis y sin compromiso del peor cuchillo de acero de filo liso)
     * Zonas de recogida y servicio a domicilio
     * Citas de MadKusin (disponibilidad, reserva, consulta de todos los datos de la cita y modificación de citas)
   - DECLINACIÓN AMABLE FUERA DE ÁMBITO: Si el usuario realiza cualquier consulta ajena al negocio (política, informática, matemáticas, cultura general, recetas no relacionadas con el corte/cuchillos o cualquier otro tema externo), declina amablemente responder explicando que eres el asistente especializado de MadKusin y que solo puedes atender consultas sobre servicios de afilado, cuidado y tipos de cuchillos, tarifas, zonas de recogida y citas de MadKusin.
2. VÍA FÁCIL DE ATENCIÓN HUMANA DIRECTA:
   - Incluye siempre una vía fácil para que el cliente pueda solicitar atención humana directa con Emil si lo necesita (diciéndote por aquí mismo que quiere hablar con Emil o atención personal para que ejecutes \`request_human_attention\`, o escribiendo directamente a **emil@madkusin.com**).
   - Cuando el cliente pida atención humana directa o hablar con Emil, ejecuta la herramienta \`request_human_attention\` para avisar inmediatamente a Emil y facilítale también el correo directo **emil@madkusin.com**.
3. SIN RESPUESTAS PREESTABLECIDAS:
   - Responde a todas las preguntas del usuario (dentro del ámbito de MadKusin) de forma natural, clara, precisa y directa basándote en la DOCUMENTACIÓN TÉCNICA Y DE SERVICIO PROPORCIONADA más abajo.
   - No utilices plantillas rígidas ni repitas eslóganes prefabricados; contesta exactamente a lo que el usuario pregunta usando el conocimiento de la documentación.
4. SIN CÓDIGOS INTERNOS NI REFERENCIAS A "POZUELO DE ALARCÓN Y ALREDEDORES":
   - NUNCA muestres códigos internos de base de datos (como #coie0i6n3p6e93r o IDs alfanuméricos).
   - NUNCA utilices la expresión "Pozuelo de Alarcón y alrededores".
5. CONSULTA Y MODIFICACIÓN DE CITAS:
   - Cuando el usuario consulte su cita, proporciónale todos los datos disponibles: fecha, hora, dirección completa, correo electrónico y número de cuchillos (junto con la modalidad y notas si existen), y dale explícitamente la opción de modificar cualquier dato que necesite.
   - Si el usuario solicita modificar cualquier dato de su cita (fecha, hora, dirección completa, correo electrónico, número de cuchillos, modalidad o notas), utiliza la herramienta \`update_appointment\` para guardarlo en la base de datos y actualizar el calendario, y muéstrale cómo quedan todos los datos de su cita tras el cambio.
6. PRIVACIDAD ZERO-TRUST:
   - Nunca pidas número de teléfono móvil.
   - Jamás reveles datos de otros usuarios.

${personalDataSection}

DOCUMENTACIÓN TÉCNICA Y DE SERVICIO PROPORCIONADA:
${ragContext}`;
}

/**
 * Declaraciones de herramientas (Function Calling) para el Agente de Usuarios (Zero-Trust).
 */
const USER_GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'check_availability',
        description:
          'Consulta los huecos horarios libres (lunes a viernes de 10:00 a 13:00) para una fecha, modalidad y número de cuchillos.',
        parameters: {
          type: 'OBJECT',
          properties: {
            fecha: { type: 'STRING', description: 'Fecha YYYY-MM-DD (lunes a viernes).' },
            modalidad: {
              type: 'STRING',
              enum: ['in_situ', 'recogida'],
              description: 'in_situ (a domicilio con enchufe <15m) o recogida (24/48h).'
            },
            num_cuchillos: {
              type: 'INTEGER',
              description: 'Número aproximado de cuchillos de acero de filo liso.'
            }
          },
          required: ['fecha', 'modalidad', 'num_cuchillos']
        }
      },
      {
        name: 'book_appointment',
        description:
          'Registra una nueva cita de afilado cuando el usuario ha confirmado fecha, hora, dirección completa, correo electrónico, nombre, modalidad y número de cuchillos.',
        parameters: {
          type: 'OBJECT',
          properties: {
            nombre: { type: 'STRING', description: 'Nombre del cliente.' },
            email: { type: 'STRING', description: 'Correo electrónico del cliente.' },
            direccion: { type: 'STRING', description: 'Dirección completa del domicilio.' },
            modalidad: { type: 'STRING', enum: ['in_situ', 'recogida'] },
            num_cuchillos: { type: 'INTEGER' },
            tiene_enchufe_15m: { type: 'BOOLEAN' },
            fecha: { type: 'STRING', description: 'Fecha YYYY-MM-DD.' },
            hora: { type: 'STRING', description: 'Hora HH:MM entre 10:00 y 13:00.' },
            notas: { type: 'STRING', description: 'Notas opcionales.' }
          },
          required: [
            'nombre',
            'email',
            'direccion',
            'modalidad',
            'num_cuchillos',
            'tiene_enchufe_15m',
            'fecha',
            'hora'
          ]
        }
      },
      {
        name: 'lookup_appointment_by_email',
        description:
          'Busca y vincula la cita activa del usuario utilizando su correo electrónico cuando el chat aún no tenía la cita vinculada.',
        parameters: {
          type: 'OBJECT',
          properties: {
            email: {
              type: 'STRING',
              description: 'Correo electrónico con el que el usuario realizó la reserva.'
            }
          },
          required: ['email']
        }
      },
      {
        name: 'update_appointment',
        description:
          'Modifica uno o varios datos de la cita existente del usuario (fecha, hora, dirección completa, correo electrónico, número de cuchillos, modalidad, nombre, notas o estado). Pasa únicamente los campos que el usuario desea cambiar.',
        parameters: {
          type: 'OBJECT',
          properties: {
            fecha: { type: 'STRING', description: 'Nueva fecha en formato YYYY-MM-DD (lunes a viernes).' },
            hora: { type: 'STRING', description: 'Nueva hora de inicio en formato HH:MM (entre 10:00 y 13:00).' },
            direccion: { type: 'STRING', description: 'Nueva dirección completa.' },
            email: { type: 'STRING', description: 'Nuevo correo electrónico.' },
            num_cuchillos: { type: 'INTEGER', description: 'Nuevo número de cuchillos de acero de filo liso.' },
            modalidad: {
              type: 'STRING',
              enum: ['in_situ', 'recogida'],
              description: 'Nueva modalidad: in_situ o recogida.'
            },
            nombre: { type: 'STRING', description: 'Nuevo nombre.' },
            notas: { type: 'STRING', description: 'Nuevas notas o indicaciones para el domicilio.' },
            tiene_enchufe_15m: { type: 'BOOLEAN', description: 'Si dispone de enchufe a menos de 15 metros.' },
            estado: {
              type: 'STRING',
              enum: ['confirmada', 'cancelada'],
              description: 'Pasa "cancelada" solo si el usuario pide explícitamente anular/cancelar su cita.'
            },
            email_actual: {
              type: 'STRING',
              description: 'Correo electrónico actual si la cita no estaba vinculada por Telegram.'
            }
          }
        }
      },
      {
        name: 'request_human_attention',
        description:
          'Solicita atención humana directa de Emil y le envía un aviso inmediato con el motivo y contacto del cliente.',
        parameters: {
          type: 'OBJECT',
          properties: {
            motivo: {
              type: 'STRING',
              description: 'Resumen de la consulta o petición que el cliente quiere tratar directamente con Emil.'
            },
            nombre: {
              type: 'STRING',
              description: 'Nombre del cliente si se conoce.'
            },
            email: {
              type: 'STRING',
              description: 'Correo electrónico del cliente para que Emil pueda responderle.'
            }
          },
          required: ['motivo']
        }
      }
    ]
  }
];

/**
 * Construye una respuesta basada directamente en los fragmentos recuperados de la documentación o en los datos de la cita
 * únicamente si la API de Gemini no estuviera disponible.
 */
function buildDocumentationDirectReply(ragChunks, ownAppointments) {
  if (ownAppointments && ownAppointments.length > 0) {
    const c = ownAppointments[0];
    return (
      `Aquí tienes todos los datos de tu cita:\n\n` +
      `${formatAppointmentDetailsForTelegram(c)}\n\n` +
      `Si deseas modificar cualquier dato (fecha, hora, dirección, correo electrónico, número de cuchillos o modalidad), indícamelo y lo actualizo.`
    );
  }

  const relevant = ragChunks.slice(0, 2);
  if (relevant.length > 0) {
    return relevant
      .map((c) => c.content.replace(/^#+\s*.+$/gm, '').replace(/\s+/g, ' ').trim())
      .join('\n\n')
      .slice(0, 900);
  }

  return 'Por favor, indícame tu consulta sobre cuchillos, afilado o los datos de tu cita.';
}

/**
 * Llama a la API REST de Google Gemini con fallback multimodelo automático.
 */
async function callGeminiGenerateContent({ apiKey, systemInstruction, contents, tools }) {
  const models = [
    process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.6-flash',
    'gemini-3.7-flash'
  ];

  const uniqueModels = [...new Set(models)];
  let lastError = null;

  for (const modelName of uniqueModels) {
    const cleanModel = modelName.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const payload = {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents,
      generationConfig: {
        temperature: 0.3
      }
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000)
      });

      if (!res.ok) {
        const errBody = await res.text();
        lastError = new Error(`Gemini (${cleanModel}) HTTP ${res.status}: ${errBody}`);
        continue;
      }

      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('No se pudo conectar con Gemini API');
}

/**
 * Ejecuta una interacción del Agente IA Kusin para un USUARIO (Web o Telegram Público).
 */
export async function runKusinUserAgent({
  message,
  history = [],
  channel = 'web',
  verifiedTelegramChatId = null
}) {
  const cleanMsg = String(message || '').trim();
  if (!cleanMsg) {
    return {
      ok: true,
      reply: '¿En qué puedo ayudarte con tus cuchillos o con tu cita de afilado?',
      ragSources: [],
      toolEvents: []
    };
  }

  // 1. Recuperar fragmentos científicos y técnicos del motor RAG
  const ragChunks = ragEngine.search(cleanMsg, 6);
  const ragSources = ragChunks.map((c) => ({ id: c.id, title: c.title, source: c.source }));

  // 2. Si es Telegram Público, cargar EXCLUSIVAMENTE las citas propias del chat_id verificado (Zero-Trust)
  let ownAppointments =
    channel === 'telegram_user' && verifiedTelegramChatId
      ? await getUserOwnAppointmentsByTelegramId(verifiedTelegramChatId)
      : [];

  const systemInstruction = buildUserAgentSystemPrompt({
    ragChunks,
    ownAppointments,
    channel
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'tu_clave_privada_gemini_aqui') {
    return {
      ok: true,
      provider: 'rag_local_fallback',
      reply: buildDocumentationDirectReply(ragChunks, ownAppointments),
      ragSources,
      toolEvents: []
    };
  }

  // 3. Construir historial de conversación para Gemini
  const contents = [];
  for (const turn of history.slice(-10)) {
    if (!turn?.text) continue;
    contents.push({
      role: turn.role === 'assistant' || turn.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(turn.text) }]
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: cleanMsg }]
  });

  const toolEvents = [];
  let bookedAppointment = null;

  try {
    let geminiData = await callGeminiGenerateContent({
      apiKey,
      systemInstruction,
      contents,
      tools: USER_GEMINI_TOOLS
    });

    // Soportar hasta 3 pasos encadenados de herramientas (ej. lookup -> check_availability -> update_appointment)
    for (let step = 0; step < 3; step++) {
      const parts = geminiData?.candidates?.[0]?.content?.parts || [];
      const fnCallPart = parts.find((p) => p.functionCall);
      if (!fnCallPart?.functionCall) break;

      const fnCall = fnCallPart.functionCall;
      const fnName = fnCall.name;
      const fnArgs = fnCall.args || {};
      let toolResult = { ok: false };

      if (fnName === 'check_availability') {
        toolResult = await checkAvailabilityZeroTrust({
          ...fnArgs,
          excludeCitaId: ownAppointments[0]?.id || null
        });
        toolEvents.push({
          tool: 'check_availability',
          summary: `Huecos libres el ${toolResult.fecha}: ${toolResult.free_times.join(', ') || 'sin huecos'}`
        });
      } else if (fnName === 'book_appointment') {
        toolResult = await createAppointmentInPocketBase({
          ...fnArgs,
          origen: channel === 'telegram_user' ? 'telegram_ai_agent' : 'web_ai_agent',
          telegram_chat_id: verifiedTelegramChatId || ''
        });
        if (toolResult.ok && toolResult.appointment) {
          bookedAppointment = toolResult.appointment;
          toolEvents.push({
            tool: 'book_appointment',
            summary: `Cita confirmada (${toolResult.appointment.fecha} a las ${toolResult.appointment.hora})`
          });
        }
      } else if (fnName === 'lookup_appointment_by_email') {
        toolResult = await findAndLinkAppointmentByEmail(fnArgs.email, verifiedTelegramChatId);
        if (toolResult.ok && toolResult.cita) {
          ownAppointments = [toolResult.cita];
          toolEvents.push({
            tool: 'lookup_appointment_by_email',
            summary: `Cita localizada para ${toolResult.cita.email} (${toolResult.cita.fecha} ${toolResult.cita.hora_inicio})`
          });
        }
      } else if (fnName === 'update_appointment') {
        toolResult = await updateUserAppointmentInPocketBase(fnArgs, verifiedTelegramChatId);
        if (toolResult.ok && toolResult.cita) {
          ownAppointments = [toolResult.cita];
          bookedAppointment = toolResult.cita;
          toolEvents.push({
            tool: 'update_appointment',
            summary: `Cita actualizada (${toolResult.cita.fecha} a las ${toolResult.cita.hora_inicio})`
          });
        }
      } else if (fnName === 'request_human_attention') {
        toolResult = await notifyEmilHumanAttention({
          ...fnArgs,
          channel,
          ownAppointments
        });
        toolEvents.push({
          tool: 'request_human_attention',
          summary: 'Aviso de atención humana directa enviado a Emil'
        });
      }

      contents.push({
        role: 'model',
        parts: [{ functionCall: fnCall }]
      });
      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: fnName,
              response: { output: toolResult }
            }
          }
        ]
      });

      geminiData = await callGeminiGenerateContent({
        apiKey,
        systemInstruction: buildUserAgentSystemPrompt({
          ragChunks,
          ownAppointments,
          channel
        }),
        contents,
        tools: USER_GEMINI_TOOLS
      });
    }

    let replyText =
      geminiData?.candidates?.[0]?.content?.parts
        ?.filter((p) => !p.thought)
        ?.map((p) => p.text || '')
        .join(' ')
        .trim() || buildDocumentationDirectReply(ragChunks, ownAppointments);

    // Eliminar cualquier mención accidental a "Pozuelo de Alarcón y alrededores"
    replyText = replyText
      .replace(/\s*en\s+\*?Pozuelo de Alarcón y alrededores\*?/gi, '')
      .replace(/Pozuelo de Alarcón y alrededores/gi, '');

    if (channel === 'web') {
      replyText = replyText.replace(/\*\*/g, '').replace(/\*/g, '');
    }

    return {
      ok: true,
      provider: 'gemini_rag',
      reply: replyText,
      ragSources,
      toolEvents,
      appointment: bookedAppointment
    };
  } catch (err) {
    console.error('[KusinUserAgent] Error en Gemini API:', err.message);
    return {
      ok: true,
      provider: 'rag_local_fallback',
      reply: buildDocumentationDirectReply(ragChunks, ownAppointments),
      ragSources,
      toolEvents,
      appointment: bookedAppointment
    };
  }
}

/**
 * ============================================================================
 * CANAL PRIVADO Y OPACO DE ADMINISTRACIÓN PARA EMIL (2.º BOT DE TELEGRAM)
 * ============================================================================
 */

async function listAllPocketBaseAppointments(limit = 15) {
  try {
    const res = await fetch(
      `${POCKETBASE_INTERNAL_URL}/api/collections/citas/records?sort=-fecha,-hora_inicio&perPage=${limit}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function runKusinAdminAgent({ message, adminName = 'Emil' }) {
  const text = String(message || '').trim();
  const stats = ragEngine.getStats();

  // Comando directo para enseñar una regla o documento desde el chat privado
  if (text.toLowerCase().startsWith('/aprender ')) {
    const note = text.slice(10).trim();
    const res = ragEngine.ingestTextDocument({
      title: `Directriz Técnica de Emil (${new Date().toLocaleDateString('es-ES')})`,
      rawText: note,
      source: 'emil_telegram_direct'
    });
    return (
      `🧠 *Conocimiento técnico indexado en Kusin*\n\n` +
      `• Fragmentos nuevos añadidos: *${res.addedChunks}*\n` +
      `• Total fragmentos en memoria RAG: *${res.totalChunks}*\n\n` +
      `Ya estoy utilizando este criterio para responder a los usuarios en la web y en Telegram.`
    );
  }

  if (text.toLowerCase() === '/estado' || text.toLowerCase() === '/stats') {
    const citas = await listAllPocketBaseAppointments(10);
    return (
      `🔐 *Panel Privado de Control Kusin (Solo Emil)*\n\n` +
      `📚 *Motor RAG Técnico:*\n` +
      `• Fragmentos base (Doctrina Emil + Libro 822 págs): *${stats.staticChunks}*\n` +
      `• Fragmentos dinámicos aprendidos por Telegram: *${stats.dynamicChunks}*\n` +
      `• Total fragmentos activos: *${stats.totalChunks}*\n\n` +
      `📅 *Citas recientes en PocketBase:* *${citas.length}*\n` +
      (citas.length > 0
        ? citas
            .slice(0, 8)
            .map(
              (c) =>
                `  - *${c.fecha} ${c.hora_inicio}* · ${c.nombre} (${c.email}) · ${c.num_cuchillos} cuchillos (${c.modalidad}) · ${c.direccion}`
            )
            .join('\n')
        : '  (Sin citas registradas)') +
      `\n\n💡 *Comandos y acciones privadas:*\n` +
      `• Adjúntame aquí cualquier archivo *.pdf*, *.txt* o *.md* (en español o inglés) y lo indexaré en el motor RAG al instante.\n` +
      `• Escribe \`/aprender <nota técnica>\` para grabar una directriz prioritaria.\n` +
      `• Hazme cualquier pregunta técnica o sobre tu agenda de citas.`
    );
  }

  const allCitas = await listAllPocketBaseAppointments(15);
  const ragChunks = ragEngine.search(text, 6);
  const ragContext = ragChunks
    .map((c, idx) => `[FRAGMENTO ${idx + 1} - ${c.title} (${c.source})]:\n${c.content}`)
    .join('\n\n');

  const adminSystemPrompt = `Eres Kusin en su MODO PRIVADO DE ADMINISTRACIÓN hablando exclusivamente con tu creador y maestro artesano, ${adminName} (propietario de vecindario.madkusin.com).
Este canal es 100 % opaco y aislado de los clientes. Aquí tienes acceso total a la agenda completa de PocketBase y al motor RAG.

ESTADO DEL MOTOR RAG:
- Fragmentos estáticos: ${stats.staticChunks}
- Fragmentos dinámicos subidos por Emil: ${stats.dynamicChunks}
- Últimos documentos dinámicos: ${stats.dynamicTitles.join(', ') || 'ninguno aún'}

AGENDA COMPLETA DE CITAS EN POCKETBASE (Confidencial para Emil):
${JSON.stringify(allCitas, null, 2)}

FRAGMENTOS TÉCNICOS RECUPERADOS DEL RAG PARA LA CONSULTA DE EMIL:
${ragContext}

INSTRUCCIONES PARA RESPONDER A EMIL:
- Si Emil te hace una pregunta técnica sobre cuchillos, aceros o sobre un documento que acaba de subir (aunque esté en inglés), respóndele en español con precisión basándote en la documentación.
- Si Emil te pregunta por sus citas o agenda, dale todos los detalles completos (fechas, horarios, nombres, direcciones completas, correos electrónicos y número de cuchillos).`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'tu_clave_privada_gemini_aqui') {
    const sample = ragChunks[0];
    return (
      `🔐 *[Modo Admin Privado - RAG Activo (${stats.totalChunks} fragmentos)]*\n\n` +
      `Fragmento más relevante recuperado para tu consulta (*${sample?.title || 'Base'}*):\n` +
      `_"${sample?.content?.slice(0, 380) || ''}..."_\n\n` +
      `📅 Citas actuales en agenda: *${allCitas.length}*.`
    );
  }

  try {
    const geminiData = await callGeminiGenerateContent({
      apiKey,
      systemInstruction: adminSystemPrompt,
      contents: [{ role: 'user', parts: [{ text }] }],
      tools: []
    });

    return (
      geminiData?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(' ').trim() ||
      'Consulta procesada en el canal privado.'
    );
  } catch (err) {
    console.error('[KusinAdminAgent] Fallback RAG en canal admin:', err.message);
    const topChunks = ragChunks.slice(0, 2);
    const excerpts = topChunks
      .map(
        (c, i) =>
          `*${i + 1}. [${c.title}]* (${c.source}):\n_"${c.content.replace(/\s+/g, ' ').slice(0, 320)}..."_`
      )
      .join('\n\n');
    return `🔐 *Respuesta Técnica RAG (Modo Privado Emil)*\n\n${excerpts}`;
  }
}

/**
 * Sintetiza voz neuronal humana hiperrealista con Gemini TTS (gemini-3.8-flash-lite-tts / gemini-3.8-flash-tts)
 * para que en el Modo Voz de la web Kusin suene cálido, natural y humano.
 */
export async function synthesizeKusinNeuralSpeech(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'tu_clave_privada_gemini_aqui' || !text?.trim()) {
    return { ok: false, reason: 'NO_API_KEY_OR_TEXT' };
  }

  const voiceName = process.env.GEMINI_VOICE_NAME || 'Aoede';
  const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];

  for (const model of ttsModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: text.replace(/\*/g, '').trim()
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName }
              }
            }
          }
        }),
        signal: AbortSignal.timeout(6500)
      });

      if (!res.ok) continue;
      const data = await res.json();
      const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (inlineData?.data) {
        return {
          ok: true,
          model,
          mimeType: inlineData.mimeType || 'audio/wav',
          audioBase64: inlineData.data
        };
      }
    } catch {
      // Intentar siguiente modelo TTS
    }
  }

  return { ok: false, reason: 'TTS_UNAVAILABLE' };
}
