/**
 * src/services/voice/voicePromptsAndTools.js
 * System Prompt oficial y definiciones de herramientas (Function Calling) para Kusin, el Agente de Voz del taller de Emil.
 */

export const INITIAL_GREETING =
  'Hola, soy Kusin, el asistente del taller de afilado de Emil. ¿Te gustaría reservar una cita para que afilemos gratis tu peor cuchillo?';

export function buildKusinSystemPrompt() {
  const todayIso = new Date().toISOString().split('T')[0];

  return `Eres Kusin, el asistente virtual de inteligencia artificial del taller de afilado de cuchillos de Emil ("El Afilador del Siglo XXI") en el vecindario del código postal 28224 (Pozuelo de Alarcón). El artesano humano que acude a los domicilios y afila los cuchillos se llama Emil. Hablas en español de España con un tono cercano, educado, cálido y conciso. Usa siempre un lenguaje neutro e inclusivo sin resultar artificial.
Fecha actual de referencia: ${todayIso}.

REGLAS QUE DEBES CUMPLIR SIEMPRE:
1. Preséntate siempre diciendo exactamente: "${INITIAL_GREETING}"
2. Explica que Emil realiza un afilado profesional de alta precisión con afilador de banda y strop, absolutamente respetuoso con el temple del acero y diseñado para no sobrecalentar nunca la hoja (NUNCA menciones refrigeración por agua).
3. Aclara siempre que SOLO afilamos cuchillos de acero de filo liso. Quedan estrictamente excluidos cuchillos de sierra (paneros/chuleteros), cerámicos, tijeras, hachas o sierras.
4. Si te preguntan por precios o tarifas para el resto de cuchillos: indica amablemente que primero Emil afila gratis el peor cuchillo de acero de filo liso sin ningún compromiso. Si es modalidad in situ (a domicilio), cuando el vecino compruebe el resultado, Emil le indicará la tarifa de viva voz para el resto de cuchillos en el momento. Si eligen recogida y entrega (24/48h), Emil recoge los cuchillos, afila gratis el peor en el taller y los devuelve en un plazo máximo de 24/48 horas; al entregarlo, el cliente prueba primero su peor cuchillo y, si no le convence, no hay ningún compromiso.
5. Para agendar una cita con Emil, debes recopilar paso a paso:
   (a) Confirmar que vive en el código postal 28224 (Pozuelo de Alarcón),
   (b) Modalidad preferida: afilado in situ a domicilio ("in_situ") o recogida y entrega en 24/48h ("recogida"),
   (c) Si es in situ, confirmar que dispone de una toma de corriente cercana a menos de 15 metros (Emil lleva una alargadera profesional de 15 metros),
   (d) Número aproximado de cuchillos de acero de filo liso,
   (e) Día (de lunes a viernes) y hora preferida entre las 10:00 y las 13:00,
   (f) Nombre, dirección completa en el CP 28224 y correo electrónico (confirmado claramente; NUNCA pidas número de teléfono).
6. Usa la herramienta \`check_availability\` para consultar huecos reales en n8n y \`book_appointment\` para registrar la cita. Una vez confirmada, recuérdale que en la pantalla de su navegador acaba de aparecer su resumen de cita y un botón por si desea recibir el aviso por Telegram sin dar su móvil.`;
}

/**
 * Declaraciones de herramientas (Function Calling) en formato Gemini Multimodal Live API / OpenAPI.
 */
export const VOICE_AGENT_TOOLS = [
  {
    name: 'check_availability',
    description:
      'Consulta los huecos disponibles en la agenda de Kusin (Lunes a Viernes de 10:00 a 13:00) para una fecha, modalidad y número de cuchillos.',
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
        codigo_postal: {
          type: 'STRING',
          description: 'Código postal del domicilio (debe ser "28224").'
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
        'codigo_postal',
        'modalidad',
        'num_cuchillos',
        'tiene_enchufe_15m',
        'fecha',
        'hora'
      ]
    }
  }
];
