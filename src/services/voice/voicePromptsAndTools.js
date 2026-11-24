/**
 * src/services/voice/voicePromptsAndTools.js
 * System Prompt oficial y definiciones de herramientas (Function Calling) para Kusin, el Agente Técnico del taller de Emil.
 */

export const INITIAL_GREETING =
  'Hola, soy Kusin, el asistente técnico del taller de Emil. Puedes hacerme cualquier pregunta sobre tus cuchillos o el afilado, reservar una cita nueva, o consultar y modificar los datos de tu cita.';

export function buildKusinSystemPrompt() {
  const todayIso = new Date().toISOString().split('T')[0];

  return `Eres Kusin, el asistente técnico de inteligencia artificial del taller de afilado de cuchillos de Emil.
Fecha actual de referencia: ${todayIso}.

DIRECTRICES QUE DEBES CUMPLIR SIEMPRE:
1. Sin respuestas preestablecidas: responde a todas las preguntas del usuario de forma natural, clara y precisa basándote en la documentación técnica y de servicio del taller de Emil.
2. Nunca muestres códigos internos de cita (#id) ni menciones códigos postales ni "Pozuelo de Alarcón y alrededores".
3. Cuando el usuario consulte su cita, muéstrale todos los datos disponibles (fecha, hora, dirección completa, correo electrónico y número de cuchillos, junto con modalidad y notas) y ofrécele modificar cualquier dato que necesite.
4. Nunca pidas número de teléfono.`;
}

/**
 * Declaraciones de herramientas (Function Calling) en formato Gemini Multimodal Live API / OpenAPI.
 */
export const VOICE_AGENT_TOOLS = [
  {
    name: 'check_availability',
    description:
      'Consulta los huecos disponibles en la agenda (Lunes a Viernes de 10:00 a 13:00) para una fecha, modalidad y número de cuchillos.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fecha: {
          type: 'STRING',
          description: 'Fecha deseada en formato YYYY-MM-DD (solo lunes a viernes).'
        },
        modalidad: {
          type: 'STRING',
          enum: ['in_situ', 'recogida'],
          description:
            'Modalidad del servicio: "in_situ" (afilado en el domicilio con enchufe a <15m) o "recogida" (recogida y entrega en 24/48h).'
        },
        num_cuchillos: {
          type: 'INTEGER',
          description: 'Número aproximado de cuchillos de acero de filo liso (mínimo 1).'
        }
      },
      required: ['fecha', 'modalidad', 'num_cuchillos']
    }
  },
  {
    name: 'book_appointment',
    description:
      'Registra la cita de afilado en el sistema y actualiza la pantalla del usuario con la confirmación y el enlace al Bot de Telegram.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nombre: {
          type: 'STRING',
          description: 'Nombre de la persona que reserva.'
        },
        email: {
          type: 'STRING',
          description: 'Correo electrónico confirmado donde recibirá los detalles de la cita.'
        },
        direccion: {
          type: 'STRING',
          description: 'Dirección completa del domicilio (calle, número, portal o chalé).'
        },
        modalidad: {
          type: 'STRING',
          enum: ['in_situ', 'recogida'],
          description: 'Modalidad elegida: "in_situ" o "recogida".'
        },
        num_cuchillos: {
          type: 'INTEGER',
          description: 'Número estimado de cuchillos de acero de filo liso.'
        },
        tiene_enchufe_15m: {
          type: 'BOOLEAN',
          description:
            'True si es modalidad in_situ y confirma tener un enchufe a menos de 15 metros.'
        },
        fecha: {
          type: 'STRING',
          description: 'Fecha acordada en formato YYYY-MM-DD.'
        },
        hora: {
          type: 'STRING',
          description: 'Hora de inicio acordada en formato HH:MM (entre 10:00 y 13:00).'
        },
        notas: {
          type: 'STRING',
          description: 'Indicaciones opcionales de timbre, puerta o urbanización.'
        }
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
    description: 'Busca la cita activa del usuario utilizando su correo electrónico.',
    parameters: {
      type: 'OBJECT',
      properties: {
        email: {
          type: 'STRING',
          description: 'Correo electrónico con el que se realizó la reserva.'
        }
      },
      required: ['email']
    }
  },
  {
    name: 'update_appointment',
    description:
      'Modifica uno o varios datos de la cita existente del usuario (fecha, hora, dirección completa, correo electrónico, número de cuchillos, modalidad, nombre o notas).',
    parameters: {
      type: 'OBJECT',
      properties: {
        fecha: { type: 'STRING', description: 'Nueva fecha en formato YYYY-MM-DD.' },
        hora: { type: 'STRING', description: 'Nueva hora de inicio HH:MM (10:00 a 13:00).' },
        direccion: { type: 'STRING', description: 'Nueva dirección completa.' },
        email: { type: 'STRING', description: 'Nuevo correo electrónico.' },
        num_cuchillos: { type: 'INTEGER', description: 'Nuevo número de cuchillos.' },
        modalidad: { type: 'STRING', enum: ['in_situ', 'recogida'] },
        nombre: { type: 'STRING', description: 'Nuevo nombre.' },
        notas: { type: 'STRING', description: 'Nuevas notas.' },
        email_actual: { type: 'STRING', description: 'Correo electrónico actual de la cita.' }
      }
    }
  }
];
