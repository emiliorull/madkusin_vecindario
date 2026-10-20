# Madkusin Vecindario (`vecindario.madkusin.com`) — Afilado Profesional en el CP 28224

Aplicación web completa optimizada para conversión hiperlocal en **Pozuelo de Alarcón (Código Postal 28224)**, preparada para desplegar en **Cloudflare Pages** junto con su función serverless (`/functions/api/voice-config.js`), **Agente de Voz con IA ("Asistente de cita")** y flujos de backend para **n8n + PocketBase + Google Calendar + Bot de Telegram**.

## Estructura del Proyecto

- [`index.html`](index.html) / [`src/App.jsx`](src/App.jsx): Interfaz principal (React 18 + Vite + Tailwind CSS + Lucide Icons).
- [`src/utils/scheduling.js`](src/utils/scheduling.js): Motor compartido de reglas de negocio (horario L-V de 10:00 a 13:00, cálculo dinámico de duración del bloque de Google Calendar según modalidad y nº de cuchillos, y validación estricta del CP `28224`).
- [`src/services/appointmentApi.js`](src/services/appointmentApi.js): Cliente para los webhooks de n8n (`VITE_N8N_WEBHOOK_DISPONIBILIDAD` y `VITE_N8N_WEBHOOK_RESERVAR`) con modo *Mock/Fallback* inteligente integrado.
- [`src/services/voice/VoiceAgentService.js`](src/services/voice/VoiceAgentService.js): Servicio desacoplado de Agente de Voz con interfaz `IVoiceProvider` (`GeminiLiveVoiceProvider`, `ElevenLabsVoiceProvider` y `HybridLocalVoiceProvider`) y ejecución de herramientas (`check_availability` y `book_appointment`).
- [`functions/api/voice-config.js`](functions/api/voice-config.js): Serverless Function de Cloudflare Pages para gestionar credenciales de voz (`GEMINI_API_KEY` / `ELEVENLABS_API_KEY`) sin exponer claves privadas en el navegador.
- [`backend-reference/pocketbase-collection-citas.json`](backend-reference/pocketbase-collection-citas.json): Esquema JSON importable en 1 clic para la colección `citas` en PocketBase.
- [`backend-reference/n8n-workflows-spec.json`](backend-reference/n8n-workflows-spec.json): Flujo de trabajo importable para n8n.
- [`backend-reference/GUIA_PASO_A_PASO_INFRAESTRUCTURA.md`](backend-reference/GUIA_PASO_A_PASO_INFRAESTRUCTURA.md): Checklist completo de tareas manuales, permisos y despliegue.

## Comandos Rápidos

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo (incluye modo Fallback de agenda y voz)
npm run dev

# 3. Compilar para producción (Cloudflare Pages -> directorio /dist)
npm run build
```
