# Guía Paso a Paso de Infraestructura y Tareas Manuales (`vecindario.madkusin.com`)

Esta guía contiene el **checklist completo de actividades manuales, autorizaciones y permisos** que debes configurar para conectar la web en producción con **PocketBase**, **n8n**, **Google Calendar**, **Bot de Telegram**, **Gemini Live API** y **Cloudflare Pages**.

> **Nota importante:** La aplicación web ya incluye un **Modo Híbrido y Fallback Inteligente**, por lo que puedes probar tanto el calendario como el **Asistente de Voz** en tu navegador desde el minuto 1 sin haber configurado todavía ningún servicio externo.

---

## 1. Importar la Colección `citas` en PocketBase (1 clic)

1. Entra al panel de administración de tu instancia de **PocketBase** (ej. `https://pb.madkusin.com/_/` o `http://127.0.0.1:8090/_/`).
2. En el menú lateral izquierdo, ve a **Settings (icono de engranaje)** $\rightarrow$ **Import collections**.
3. Pulsa en **Load from JSON file** y selecciona el archivo:
   - `backend-reference/pocketbase-collection-citas.json`
4. Revisa la vista previa (creará la colección `citas` con todos los campos validados: `nombre`, `email`, `direccion`, `codigo_postal` con regex `^28224$`, `modalidad`, `num_cuchillos`, `duracion_minutos`, `tiene_enchufe_15m`, `confirma_filo_liso`, `fecha`, `hora_inicio`, `hora_fin`, `notas`, `estado`, `origen`, `gcal_event_id`, `telegram_chat_id`).
5. Haz clic en **Confirm and import**.
6. **Permiso para n8n:** Crea un usuario administrador o token de API en PocketBase para que n8n pueda insertar registros en `/api/collections/citas/records` (o si n8n y PocketBase corren en la misma red privada de Docker en DigitalOcean, permite creación interna).

---

## 2. Crear el Bot de Telegram para Recordatorios Sin Teléfono (`@BotFather`)

1. Abre Telegram y busca el bot oficial verificando el check azul: **`@BotFather`**.
2. Envía el comando `/newbot`.
3. Nombre visible sugerido: `Kusin · Avisos de Cita (28224)`.
4. Nombre de usuario (debe terminar en `bot`): por ejemplo `madkusin_citas_bot`.
5. `@BotFather` te entregará un **HTTP API Token** (ej. `7123456789:AAH...`). Guárdalo para pegarlo en las credenciales de Telegram dentro de **n8n**.
6. Cuando el vecino pulse el botón post-reserva (`https://t.me/madkusin_citas_bot?start=cita_ID`), Telegram enviará automáticamente a n8n el mensaje `/start cita_ID` junto con el `chat.id` del usuario (sin exponer su número de móvil), permitiendo a n8n actualizar el campo `telegram_chat_id` en PocketBase y enviarle el recordatorio.

---

## 3. Importar y Conectar los Flujos en n8n (DigitalOcean)

1. Abre tu panel de **n8n** $\rightarrow$ **Workflows** $\rightarrow$ **Add Workflow** $\rightarrow$ menú `...` (arriba a la derecha) $\rightarrow$ **Import from File...**.
2. Selecciona el archivo:
   - `backend-reference/n8n-workflows-spec.json`
3. Configura las **3 credenciales** dentro de los nodos importados:
   - **Google Calendar OAuth2 API:** Autoriza tu cuenta de Google donde llevas la agenda de Kusin (en los nodos `Google Calendar - Leer Eventos Mañana` y `Google Calendar - Crear Bloque Cita`).
   - **PocketBase URL / Auth:** Ajusta la URL de tu PocketBase en el nodo `PocketBase - Insertar Cita en Colección citas`.
   - **SMTP / Email:** Configura tus credenciales de correo saliente (`citas@madkusin.com`) en el nodo `Enviar Email de Confirmación + Enlace Telegram`.
4. Pulsa **Activate** (arriba a la derecha) para activar el workflow en producción y copia las 2 URLs de producción de los nodos Webhook:
   - `VITE_N8N_WEBHOOK_DISPONIBILIDAD` (ej. `https://n8n.madkusin.com/webhook/vecindario-disponibilidad`)
   - `VITE_N8N_WEBHOOK_RESERVAR` (ej. `https://n8n.madkusin.com/webhook/vecindario-reservar`)

---

## 4. Obtener la Clave de Voz en Tiempo Real (Google AI Studio / ElevenLabs)

1. Entra en [Google AI Studio](https://aistudio.google.com/apikey) con tu cuenta de Google.
2. Pulsa en **Create API Key** y copia la clave generada (`AIzaSy...`).
3. Esta clave se configurará **únicamente como variable privada (`GEMINI_API_KEY`)** en Cloudflare Pages para que la función serverless `/functions/api/voice-config.js` la gestione sin exponerla en el código fuente estático.
4. *(Opcional en el futuro)* Si más adelante clonas la voz de Kusin en **ElevenLabs Conversational AI**, solo tendrás que definir en Cloudflare:
   - `VOICE_PROVIDER=elevenlabs`
   - `ELEVENLABS_API_KEY=...`
   - `ELEVENLABS_AGENT_ID=...`

---

## 5. Desplegar en Cloudflare Pages bajo `vecindario.madkusin.com`

1. Sube este repositorio a tu cuenta de **GitHub** o **GitLab**.
2. Entra en el panel de **Cloudflare Dashboard** $\rightarrow$ **Workers & Pages** $\rightarrow$ **Create** $\rightarrow$ pestaña **Pages** $\rightarrow$ **Connect to Git**.
3. Selecciona el repositorio y configura el **Build settings**:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. En **Environment variables (Production & Preview)** añade:
   - `VITE_N8N_WEBHOOK_DISPONIBILIDAD` = `https://tu-n8n.madkusin.com/webhook/vecindario-disponibilidad`
   - `VITE_N8N_WEBHOOK_RESERVAR` = `https://tu-n8n.madkusin.com/webhook/vecindario-reservar`
   - `VITE_TELEGRAM_BOT_USERNAME` = `madkusin_citas_bot`
   - `GEMINI_API_KEY` = *(Tu clave de Google AI Studio marcada como **Encrypt / Secret**)*
   - `GEMINI_LIVE_MODEL` = `models/gemini-2.0-flash-exp`
   - `GEMINI_VOICE_NAME` = `Aoede`
5. Una vez completado el primer despliegue, ve a la pestaña **Custom domains** dentro de tu proyecto de Cloudflare Pages:
   - Haz clic en **Set up a custom domain**.
   - Escribe **`vecindario.madkusin.com`** y confirma (Cloudflare creará automáticamente el registro CNAME y el certificado SSL).
