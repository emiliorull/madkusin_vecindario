/**
 * scripts/build-knowledge.mjs
 * Procesa la Doctrina Científica de Emil (knowledge/emil-scientific-core.md)
 * y el manual técnico completo extraído en knowledge/raw/cuchillos_extracted.txt,
 * generando un índice RAG optimizado y ligero en knowledge/rag-index.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const CORE_MD_PATH = path.join(ROOT_DIR, 'knowledge', 'emil-scientific-core.md');
const BOOK_TXT_PATH = path.join(ROOT_DIR, 'knowledge', 'raw', 'cuchillos_extracted.txt');
const OUTPUT_JSON_PATH = path.join(ROOT_DIR, 'knowledge', 'rag-index.json');

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'en',
  'con', 'por', 'para', 'sin', 'sobre', 'entre', 'hacia', 'hasta', 'desde', 'que', 'se',
  'su', 'sus', 'es', 'son', 'mas', 'pero', 'como', 'cuando', 'donde', 'este', 'esta',
  'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'todo', 'toda', 'todos', 'todas',
  'muy', 'ya', 'no', 'si', 'o', 'u', 'y', 'e', 'ni', 'lo', 'le', 'les', 'me', 'te', 'nos',
  'hay', 'ser', 'estar', 'tener', 'hacer', 'puede', 'pueden', 'cada', 'otro', 'otra',
  'otros', 'otras', 'mismo', 'misma', 'tan', 'tanto', 'también', 'solo', 'sólo'
]);

function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(text, maxKeywords = 22) {
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

function processCoreMarkdown(mdContent) {
  const sections = mdContent.split(/^##\s+/m).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i].trim();
    if (!sec) continue;
    const lines = sec.split('\n');
    const title = lines[0].replace(/^#\s*/, '').trim();
    const content = lines.slice(1).join('\n').trim();
    if (content.length < 40) continue;

    chunks.push({
      id: `core_${i + 1}`,
      source: 'emil_doctrine',
      priority: 3.0,
      title,
      content,
      keywords: extractKeywords(`${title} ${title} ${content}`, 25)
    });
  }
  return chunks;
}

function cleanBookText(raw) {
  const lines = raw.split(/\r?\n/);
  // Saltar las primeras ~290 líneas de derechos de autor e índice punteado
  const bodyLines = lines.slice(290);
  const cleaned = [];

  for (let line of bodyLines) {
    line = line.replace(/\f/g, '').trim();
    if (!line) {
      cleaned.push('');
      continue;
    }
    // Ignorar números de página sueltos o numeración romana del índice
    if (/^\d{1,3}$/.test(line) || /^[ivx]{1,4}$/i.test(line)) continue;
    // Ignorar cabeceras repetitivas de bloque/parte
    if (/^(PARTE \d+|BLOQUE \d+):/i.test(line)) continue;
    // Ignorar líneas de puntos del índice
    if (line.includes('.......')) continue;
    // Arreglar ligaduras tipográficas comunes de InDesign (ﬁ -> fi, ﬂ -> fl)
    line = line.replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl');
    cleaned.push(line);
  }

  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n');
}

function chunkBookText(cleanedText) {
  const paragraphs = cleanedText.split(/\n\n+/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
  const chunks = [];
  let currentTitle = 'Manual Técnico de Cuchillos y Afilado';
  let buffer = [];
  let bufferLen = 0;
  let chunkIndex = 1;

  for (const p of paragraphs) {
    // Detectar títulos de capítulo o subsección (cortos y sin punto final)
    const isHeading =
      p.length > 4 &&
      p.length < 85 &&
      !p.endsWith('.') &&
      !p.endsWith(':') &&
      (/^[A-ZÁÉÍÓÚÑ0-9\s,¿?/-]+$/.test(p) || /^[A-ZÁÉÍÓÚÑ¿][a-záéíóúñ]+(\s+[a-záéíóúñA-ZÁÉÍÓÚÑ¿?0-9“”"-]+){1,9}$/.test(p));

    if (isHeading && p.length < 75) {
      if (bufferLen >= 550) {
        const text = buffer.join('\n\n');
        chunks.push({
          id: `book_${chunkIndex++}`,
          source: 'manual_tecnico_cuchillos',
          priority: 1.0,
          title: currentTitle,
          content: text,
          keywords: extractKeywords(`${currentTitle} ${currentTitle} ${text}`, 20)
        });
        buffer = [];
        bufferLen = 0;
      }
      currentTitle = p;
      continue;
    }

    buffer.push(p);
    bufferLen += p.length;

    if (bufferLen >= 1150) {
      const text = buffer.join('\n\n');
      chunks.push({
        id: `book_${chunkIndex++}`,
        source: 'manual_tecnico_cuchillos',
        priority: 1.0,
        title: currentTitle,
        content: text,
        keywords: extractKeywords(`${currentTitle} ${currentTitle} ${text}`, 20)
      });
      buffer = [];
      bufferLen = 0;
    }
  }

  if (buffer.length > 0 && bufferLen > 100) {
    const text = buffer.join('\n\n');
    chunks.push({
      id: `book_${chunkIndex++}`,
      source: 'manual_tecnico_cuchillos',
      priority: 1.0,
      title: currentTitle,
      content: text,
      keywords: extractKeywords(`${currentTitle} ${currentTitle} ${text}`, 20)
    });
  }

  return chunks;
}

function main() {
  const coreMd = fs.readFileSync(CORE_MD_PATH, 'utf-8');
  const coreChunks = processCoreMarkdown(coreMd);

  let bookChunks = [];
  if (fs.existsSync(BOOK_TXT_PATH)) {
    const rawBook = fs.readFileSync(BOOK_TXT_PATH, 'utf-8');
    const cleaned = cleanBookText(rawBook);
    bookChunks = chunkBookText(cleaned);
  }

  const allChunks = [...coreChunks, ...bookChunks];
  const output = {
    generatedAt: new Date().toISOString(),
    totalChunks: allChunks.length,
    coreChunks: coreChunks.length,
    bookChunks: bookChunks.length,
    chunks: allChunks
  };

  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(output), 'utf-8');
  const sizeKb = (fs.statSync(OUTPUT_JSON_PATH).size / 1024).toFixed(1);
  console.log(`✅ Índice RAG generado en ${OUTPUT_JSON_PATH}`);
  console.log(`   Fragmentos Doctrina Emil: ${coreChunks.length}`);
  console.log(`   Fragmentos Manual Técnico: ${bookChunks.length}`);
  console.log(`   Total Fragmentos: ${allChunks.length} (${sizeKb} KB)`);
}

main();
