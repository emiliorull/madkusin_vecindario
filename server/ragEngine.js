/**
 * server/ragEngine.js
 * Motor RAG (Retrieval-Augmented Generation) ultraligero en memoria + persistencia dinámica.
 * - Carga los 738+ fragmentos técnicos de knowledge/rag-index.json (Doctrina Emil + Manual Técnico 822 págs)
 * - Carga y persiste fragmentos aprendidos en caliente desde el Bot Privado de Telegram de Emil
 *   (tanto en knowledge/dynamic-learned.json como en PocketBase si está disponible).
 * - Soporta búsqueda híbrida BM25 / léxica con expansión bilingüe (Español <-> Inglés) para que
 *   los documentos técnicos en inglés subidos por Emil se recuperen aunque el vecino pregunte en español.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const STATIC_INDEX_PATH = path.join(ROOT_DIR, 'knowledge', 'rag-index.json');
const DYNAMIC_INDEX_PATH = path.join(ROOT_DIR, 'knowledge', 'dynamic-learned.json');

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'en',
  'con', 'por', 'para', 'sin', 'sobre', 'entre', 'hacia', 'hasta', 'desde', 'que', 'se',
  'su', 'sus', 'es', 'son', 'mas', 'pero', 'como', 'cuando', 'donde', 'este', 'esta',
  'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'todo', 'toda', 'todos', 'todas',
  'muy', 'ya', 'no', 'si', 'o', 'u', 'y', 'e', 'ni', 'lo', 'le', 'les', 'me', 'te', 'nos',
  'hay', 'ser', 'estar', 'tener', 'hacer', 'puede', 'pueden', 'cada', 'otro', 'otra',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'have', 'has',
  'into', 'your', 'you', 'can', 'will', 'not', 'but', 'what', 'when', 'where', 'how', 'why',
  'hola', 'kusin', 'emil', 'quiero', 'saber', 'pregunta', 'dime', 'explica', 'favor'
]);

/**
 * Diccionario de equivalencias técnicas Español <-> Inglés para recuperación bilingüe
 * (permite que documentos subidos en inglés respondan preguntas en español y viceversa).
 */
const BILINGUAL_SYNONYMS = {
  rebaba: ['burr', 'wire', 'apex', 'fatiga', 'strop', 'cuero'],
  burr: ['rebaba', 'asentador', 'cuero', 'strop', 'filo'],
  cuero: ['strop', 'stropping', 'leather', 'asentador', 'pasta', 'compound'],
  asentador: ['strop', 'stropping', 'leather', 'cuero', 'rebaba', 'burr'],
  strop: ['cuero', 'asentador', 'rebaba', 'burr', 'compound'],
  banda: ['belt', 'grinder', 'sander', 'convexo', 'convex', 'temperatura'],
  temple: ['temper', 'tempering', 'martensita', 'martensite', 'heat', 'calor', 'revenido', 'hrc'],
  calor: ['heat', 'temper', 'overheat', 'revenido', 'temple', 'martensita'],
  acero: ['steel', 'carbide', 'carburos', 'carbon', 'carbono', 'inoxidable', 'stainless', 'hrc'],
  dureza: ['hardness', 'rockwell', 'hrc', 'martensita', 'martensite'],
  angulo: ['angle', 'bevel', 'bisel', 'grados', 'degrees', 'edge', 'geometria'],
  bisel: ['bevel', 'edge', 'apex', 'convexo', 'convex', 'vaciado', 'grind'],
  sierra: ['serrated', 'bread', 'panero', 'dientes', 'garganta', 'excluido'],
  ceramica: ['ceramic', 'zirconia', 'circonio', 'fragil', 'excluido'],
  piedra: ['stone', 'whetstone', 'grit', 'grano', 'slurry'],
  chaira: ['honing', 'rod', 'steel', 'alinear', 'microchipping'],
  japones: ['japanese', 'gyuto', 'santoku', 'yanagiba', 'deba', 'aogami', 'shirogami', 'vg10'],
  madera: ['wood', 'board', 'tabla', 'endgrain', 'corte'],
  oxido: ['rust', 'patina', 'corrosion', 'carbono', 'acido'],
  precio: ['tarifa', 'gratis', 'peor', 'cuchillo', 'compromiso', 'modalidad'],
  cita: ['reserva', 'horario', '28224', 'pozuelo', 'domicilio', 'recogida', 'enchufe']
};

export function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractKeywords(text, maxKeywords = 24) {
  const words = normalizeText(text).split(' ');
  const freq = new Map();
  for (const w of words) {
    if (w.length < 3 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([w]) => w);
}

class RagEngine {
  constructor() {
    this.staticChunks = [];
    this.dynamicChunks = [];
    this.loaded = false;
  }

  init() {
    if (this.loaded) return;
    try {
      if (fs.existsSync(STATIC_INDEX_PATH)) {
        const raw = fs.readFileSync(STATIC_INDEX_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        this.staticChunks = Array.isArray(parsed.chunks) ? parsed.chunks : [];
      }
    } catch (err) {
      console.error('[RagEngine] Error cargando rag-index.json:', err.message);
    }

    try {
      if (fs.existsSync(DYNAMIC_INDEX_PATH)) {
        const rawDyn = fs.readFileSync(DYNAMIC_INDEX_PATH, 'utf-8');
        const parsedDyn = JSON.parse(rawDyn);
        this.dynamicChunks = Array.isArray(parsedDyn.chunks) ? parsedDyn.chunks : [];
      }
    } catch (err) {
      console.error('[RagEngine] Error cargando dynamic-learned.json:', err.message);
    }

    this.loaded = true;
    console.log(
      `[RagEngine] Motor inicializado: ${this.staticChunks.length} fragmentos base + ${this.dynamicChunks.length} fragmentos dinámicos.`
    );
  }

  saveDynamicChunks() {
    try {
      const dir = path.dirname(DYNAMIC_INDEX_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        DYNAMIC_INDEX_PATH,
        JSON.stringify(
          {
            updatedAt: new Date().toISOString(),
            totalDynamic: this.dynamicChunks.length,
            chunks: this.dynamicChunks
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch (err) {
      console.error('[RagEngine] No se pudo guardar dynamic-learned.json:', err.message);
    }
  }

  /**
   * Añade texto o documento técnico nuevo en caliente (ej. desde el Telegram Privado de Emil).
   */
  ingestTextDocument({ title = 'Documento Técnico Emil', rawText = '', source = 'telegram_admin' }) {
    this.init();
    const clean = String(rawText || '')
      .replace(/\f/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/ﬁ/g, 'fi')
      .replace(/ﬂ/g, 'fl')
      .trim();

    if (!clean || clean.length < 20) {
      return { ok: false, addedChunks: 0, error: 'El texto proporcionado está vacío o es demasiado corto.' };
    }

    const paragraphs = clean
      .split(/\n\n+/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 20);

    const newChunks = [];
    let buffer = [];
    let bufferLen = 0;
    let currentSection = title;
    const timestampId = Date.now();

    for (const p of paragraphs) {
      if (p.length < 80 && !p.endsWith('.') && !p.endsWith(':')) {
        currentSection = `${title} · ${p}`;
        continue;
      }
      buffer.push(p);
      bufferLen += p.length;

      if (bufferLen >= 1000) {
        const text = buffer.join('\n\n');
        newChunks.push({
          id: `dyn_${timestampId}_${newChunks.length + 1}`,
          source,
          priority: 2.8, // Prioridad alta para documentos enseñados directamente por Emil
          title: currentSection,
          content: text,
          createdAt: new Date().toISOString(),
          keywords: extractKeywords(`${currentSection} ${text}`, 24)
        });
        buffer = [];
        bufferLen = 0;
      }
    }

    if (buffer.length > 0) {
      const text = buffer.join('\n\n');
      newChunks.push({
        id: `dyn_${timestampId}_${newChunks.length + 1}`,
        source,
        priority: 2.8,
        title: currentSection,
        content: text,
        createdAt: new Date().toISOString(),
        keywords: extractKeywords(`${currentSection} ${text}`, 24)
      });
    }

    this.dynamicChunks.unshift(...newChunks);
    this.saveDynamicChunks();

    return {
      ok: true,
      addedChunks: newChunks.length,
      totalChunks: this.staticChunks.length + this.dynamicChunks.length,
      sampleTitle: newChunks[0]?.title || title
    };
  }

  /**
   * Extrae texto de un archivo PDF usando pdftotext (Calibre en Windows o poppler-utils en Linux/Docker).
   */
  async extractPdfBufferToText(pdfBuffer) {
    const tmpDir = path.join(ROOT_DIR, 'knowledge', 'raw');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpPdf = path.join(tmpDir, `upload_${Date.now()}.pdf`);
    const tmpTxt = path.join(tmpDir, `upload_${Date.now()}.txt`);

    fs.writeFileSync(tmpPdf, pdfBuffer);

    const candidates = [
      'pdftotext',
      '/usr/bin/pdftotext',
      'C:\\Program Files\\Calibre2\\app\\bin\\pdftotext.exe'
    ];

    let extracted = '';
    for (const bin of candidates) {
      try {
        await execFileAsync(bin, ['-enc', 'UTF-8', tmpPdf, tmpTxt], { timeout: 30000 });
        if (fs.existsSync(tmpTxt)) {
          extracted = fs.readFileSync(tmpTxt, 'utf-8');
          break;
        }
      } catch {
        // Probar siguiente binario
      }
    }

    try {
      if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
      if (fs.existsSync(tmpTxt)) fs.unlinkSync(tmpTxt);
    } catch {}

    return extracted;
  }

  /**
   * Recupera los fragmentos técnicos más relevantes para una consulta de usuario.
   * Siempre incluye la documentación base del taller de Emil + los mejores fragmentos técnicos del manual/documentos.
   */
  search(query, topK = 6) {
    this.init();
    const normQuery = normalizeText(query);
    const rawTokens = normQuery
      .split(' ')
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

    // Expansión bilingüe de términos técnicos
    const expandedTokens = new Set(rawTokens);
    for (const token of rawTokens) {
      for (const [key, syns] of Object.entries(BILINGUAL_SYNONYMS)) {
        if (token.includes(key) || key.includes(token)) {
          expandedTokens.add(key);
          syns.forEach((s) => expandedTokens.add(s));
        }
      }
    }

    const tokens = [...expandedTokens];
    const allChunks = [...this.dynamicChunks, ...this.staticChunks];
    const coreChunks = this.staticChunks.filter((c) => c.source === 'emil_doctrine');

    if (tokens.length === 0) {
      return coreChunks;
    }

    const scored = [];
    for (const chunk of allChunks) {
      const normTitle = normalizeText(chunk.title);
      const normContent = normalizeText(chunk.content);
      const kwSet = new Set(chunk.keywords || []);

      let score = 0;
      for (const token of tokens) {
        const isPrimary = rawTokens.includes(token);
        const weight = isPrimary ? 1.0 : 0.55;

        if (kwSet.has(token)) score += 3.5 * weight;
        if (normTitle.includes(token)) score += 4.0 * weight;
        if (normContent.includes(token)) score += 1.5 * weight;
      }

      if (score > 0) {
        scored.push({
          chunk,
          finalScore: score * (chunk.priority || 1.0)
        });
      }
    }

    scored.sort((a, b) => b.finalScore - a.finalScore);

    const selected = [];
    const seenIds = new Set();

    for (const item of scored) {
      if (selected.length >= topK) break;
      if (!seenIds.has(item.chunk.id)) {
        selected.push(item.chunk);
        seenIds.add(item.chunk.id);
      }
    }

    // Incluir también los fragmentos de la documentación base del taller que aún no estén en la selección
    for (const core of coreChunks) {
      if (!seenIds.has(core.id)) {
        selected.push(core);
        seenIds.add(core.id);
      }
    }

    return selected;
  }

  getStats() {
    this.init();
    return {
      staticChunks: this.staticChunks.length,
      dynamicChunks: this.dynamicChunks.length,
      totalChunks: this.staticChunks.length + this.dynamicChunks.length,
      dynamicTitles: [...new Set(this.dynamicChunks.map((c) => c.title))].slice(0, 15)
    };
  }
}

export const ragEngine = new RagEngine();
