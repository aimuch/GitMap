import * as path from 'path';
import * as zlib from 'zlib';

export interface SpreadsheetSheetData {
  name: string;
  rows: string[][];
  totalRows: number;
  totalCols: number;
  truncated: boolean;
}

export interface SpreadsheetPreviewResult {
  kind: 'spreadsheet';
  format: 'xlsx' | 'xls' | 'ods';
  sheets: SpreadsheetSheetData[];
}

export type DocxBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string; isList?: boolean }
  | { type: 'table'; rows: string[][] };

export interface DocxPreviewResult {
  kind: 'docx';
  format: 'docx';
  blocks: DocxBlock[];
  truncated: boolean;
}

export interface PptxSlideData {
  index: number;
  title: string;
  paragraphs: string[];
  tables: string[][][];
  notes: string;
}

export interface PptxPreviewResult {
  kind: 'pptx';
  format: 'pptx';
  slides: PptxSlideData[];
  truncated: boolean;
}

export interface ArchiveEntryMeta {
  path: string;
  isDirectory: boolean;
  size: number;
  compressedSize: number;
  method: string;
}

export interface ArchivePreviewResult {
  kind: 'archive';
  format: 'zip';
  entries: ArchiveEntryMeta[];
  totalFiles: number;
  totalSize: number;
  totalCompressedSize: number;
  truncated: boolean;
}

export type OfficePreviewResult =
  | SpreadsheetPreviewResult
  | DocxPreviewResult
  | PptxPreviewResult
  | ArchivePreviewResult;

const MAX_XML_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_EXTRACTED_BYTES = 32 * 1024 * 1024;
const MAX_SHEETS = 24;
const MAX_ROWS_PER_SHEET = 2000;
const MAX_COLS_PER_SHEET = 100;
const MAX_DOCX_BLOCKS = 1200;

/* ==================== XML & Zip Helpers ==================== */

function safeFromCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
    return '';
  }
  return String.fromCodePoint(cp);
}

function decodeXmlEntities(raw: string): string {
  if (!raw || !raw.includes('&')) return raw;
  return raw.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_m, tok: string) => {
    if (tok === 'amp') return '&';
    if (tok === 'lt') return '<';
    if (tok === 'gt') return '>';
    if (tok === 'quot') return '"';
    if (tok === 'apos') return "'";
    if (tok.startsWith('#x') || tok.startsWith('#X')) {
      return safeFromCodePoint(parseInt(tok.slice(2), 16));
    }
    if (tok.startsWith('#')) {
      return safeFromCodePoint(parseInt(tok.slice(1), 10));
    }
    return '';
  });
}

function getAttr(tagAttrs: string, attrName: string): string | null {
  const re = new RegExp(`(?:^|\\s)${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const m = re.exec(tagAttrs);
  if (!m) return null;
  return decodeXmlEntities(m[1] !== undefined ? m[1] : (m[2] || ''));
}

/**
 * Minimal, zip-bomb-safe ZIP reader (STORE + DEFLATE) reading only requested entries via the Central Directory.
 */
export function extractZipEntries(
  buf: Buffer,
  filter?: (entryPath: string) => boolean
): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  if (buf.length < 22) throw new Error('Invalid or truncated ZIP archive.');

  // Find End of Central Directory (EOCD) signature 0x06054b50 within last 64KB + 22 bytes
  const minPos = Math.max(0, buf.length - 65557);
  let eocdPos = -1;
  for (let p = buf.length - 22; p >= minPos; p--) {
    if (buf.readUInt32LE(p) === 0x06054b50) {
      eocdPos = p;
      break;
    }
  }
  if (eocdPos === -1) throw new Error('ZIP End of Central Directory record not found.');

  const totalEntries = buf.readUInt16LE(eocdPos + 10);
  const cdSize = buf.readUInt32LE(eocdPos + 12);
  const cdOffset = buf.readUInt32LE(eocdPos + 16);
  if (cdOffset + cdSize > buf.length) {
    throw new Error('Corrupted ZIP Central Directory.');
  }

  let cursor = cdOffset;
  let totalExtracted = 0;
  for (let i = 0; i < totalEntries && cursor + 46 <= cdOffset + cdSize; i++) {
    if (buf.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = buf.readUInt16LE(cursor + 10);
    const compSize = buf.readUInt32LE(cursor + 20);
    const uncompSize = buf.readUInt32LE(cursor + 24);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const localHeaderOffset = buf.readUInt32LE(cursor + 42);
    const entryName = buf.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8').replace(/^\/+/, '');
    cursor += 46 + nameLen + extraLen + commentLen;

    if (filter && !filter(entryName)) continue;
    if (uncompSize > MAX_XML_ENTRY_BYTES) continue;
    const remainingBudget = MAX_TOTAL_EXTRACTED_BYTES - totalExtracted;
    if (remainingBudget <= 0) break;
    if (localHeaderOffset + 30 > buf.length) continue;
    if (buf.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

    const lNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const lExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
    if (dataStart + compSize > buf.length) continue;

    const rawSlice = buf.subarray(dataStart, dataStart + compSize);
    if (method === 0) {
      if (rawSlice.length > remainingBudget) continue;
      totalExtracted += rawSlice.length;
      out.set(entryName, Buffer.from(rawSlice));
    } else if (method === 8) {
      const cap = Math.min(MAX_XML_ENTRY_BYTES, remainingBudget);
      const inflated = zlib.inflateRawSync(rawSlice, { maxOutputLength: cap });
      totalExtracted += inflated.length;
      out.set(entryName, inflated);
    }
  }
  return out;
}

/* ==================== Excel (.xlsx / .xlsm) Parser ==================== */

function colLettersToIndex(letters: string): number {
  let idx = 0;
  const up = letters.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const c = up.charCodeAt(i);
    if (c < 65 || c > 90) break;
    idx = idx * 26 + (c - 64);
  }
  return Math.max(0, idx - 1);
}

function isDateNumberFormat(numFmtId: number, customCode?: string): boolean {
  if ((numFmtId >= 14 && numFmtId <= 22) || (numFmtId >= 45 && numFmtId <= 47)) return true;
  if (!customCode) return false;
  // Strip quoted literal text & color/condition brackets
  const cleaned = customCode.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').toLowerCase();
  return /[ymd]/.test(cleaned) && !/#|0\.0/.test(cleaned);
}

function formatExcelSerialDate(serial: number, date1904 = false): string {
  if (!Number.isFinite(serial) || serial < 0 || serial > 2958465) return String(serial);
  let epochMs: number;
  if (date1904) {
    // Mac Excel 1904 date system (day 0 = 1904-01-01)
    epochMs = Date.UTC(1904, 0, 1) + Math.round(serial * 86400 * 1000);
  } else {
    // Excel 1900 date system (accounts for 1900 leap-year bug: day 60 = Feb 29, 1900)
    const adjusted = serial > 60 ? serial - 1 : serial;
    epochMs = Date.UTC(1899, 11, 31) + Math.round(adjusted * 86400 * 1000);
  }
  const d = new Date(epochMs);
  if (Number.isNaN(d.getTime())) return String(serial);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const hasTime = Math.abs(serial - Math.floor(serial)) > 1e-6;
  return hasTime ? `${dateStr} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : dateStr;
}

function parseSharedStringsXml(xml: string): string[] {
  const strings: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml)) !== null) {
    const inner = m[1];
    // Strip phonetic pronunciation (<rPh>...</rPh>) so Japanese/CJK ruby text isn't duplicated
    const clean = inner.replace(/<rPh\b[^>]*>[\s\S]*?<\/rPh>/g, '');
    let text = '';
    tRe.lastIndex = 0;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(clean)) !== null) {
      text += decodeXmlEntities(tm[1]);
    }
    strings.push(text);
  }
  return strings;
}

function parseDateStyleIndices(stylesXml: string): Set<number> {
  const dateStyles = new Set<number>();
  if (!stylesXml) return dateStyles;

  const customFmts = new Map<number, string>();
  const numFmtRe = /<numFmt\b([^>]*)\/>/g;
  let nm: RegExpExecArray | null;
  while ((nm = numFmtRe.exec(stylesXml)) !== null) {
    const idStr = getAttr(nm[1], 'numFmtId');
    const code = getAttr(nm[1], 'formatCode');
    if (idStr && code) customFmts.set(parseInt(idStr, 10), code);
  }

  const cellXfsMatch = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml);
  if (!cellXfsMatch) return dateStyles;

  const xfRe = /<xf\b([^>]*?)(?:\/>|>[\s\S]*?<\/xf>)/g;
  let xm: RegExpExecArray | null;
  let idx = 0;
  while ((xm = xfRe.exec(cellXfsMatch[1])) !== null) {
    const idStr = getAttr(xm[1], 'numFmtId');
    if (idStr) {
      const id = parseInt(idStr, 10);
      if (isDateNumberFormat(id, customFmts.get(id))) {
        dateStyles.add(idx);
      }
    }
    idx++;
  }
  return dateStyles;
}

function parseXlsxSheetXml(
  xml: string,
  sharedStrings: string[],
  dateStyles: Set<number>,
  date1904 = false
): Omit<SpreadsheetSheetData, 'name'> {
  const rows: string[][] = [];
  let maxCols = 0;
  let totalRows = 0;
  let truncated = false;

  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  const vRe = /<v\b[^>]*>([\s\S]*?)<\/v>/;
  const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;

  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml)) !== null) {
    totalRows++;
    if (rows.length >= MAX_ROWS_PER_SHEET) {
      truncated = true;
      continue;
    }
    const rowInner = rm[2] || '';
    if (!rowInner) {
      rows.push([]);
      continue;
    }
    const cells: string[] = [];
    let autoCol = 0;
    cellRe.lastIndex = 0;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rowInner)) !== null) {
      const attrs = cm[1];
      const body = cm[2] || '';
      const ref = getAttr(attrs, 'r');
      let colIdx = autoCol;
      if (ref) {
        const letterMatch = /^([A-Za-z]+)/.exec(ref);
        if (letterMatch) colIdx = colLettersToIndex(letterMatch[1]);
      }
      autoCol = colIdx + 1;
      if (colIdx >= MAX_COLS_PER_SHEET) continue;

      const cellType = getAttr(attrs, 't') || '';
      const styleStr = getAttr(attrs, 's');
      let val = '';

      if (cellType === 'inlineStr') {
        tRe.lastIndex = 0;
        let tm: RegExpExecArray | null;
        while ((tm = tRe.exec(body)) !== null) val += decodeXmlEntities(tm[1]);
      } else {
        const vm = vRe.exec(body);
        const rawV = vm ? decodeXmlEntities(vm[1]) : '';
        if (cellType === 's') {
          const sIdx = parseInt(rawV, 10);
          val = Number.isFinite(sIdx) && sIdx >= 0 && sIdx < sharedStrings.length ? sharedStrings[sIdx] : '';
        } else if (cellType === 'b') {
          val = rawV === '1' ? 'TRUE' : 'FALSE';
        } else if (cellType === 'str' || cellType === 'e') {
          val = rawV;
        } else if (rawV !== '') {
          const sId = styleStr ? parseInt(styleStr, 10) : -1;
          if (sId >= 0 && dateStyles.has(sId)) {
            const num = Number(rawV);
            val = Number.isFinite(num) ? formatExcelSerialDate(num, date1904) : rawV;
          } else {
            val = rawV;
          }
        }
      }

      while (cells.length <= colIdx) cells.push('');
      cells[colIdx] = val;
    }

    // Trim trailing empty cells in this row
    while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
    if (cells.length > maxCols) maxCols = cells.length;
    rows.push(cells);
  }

  // Trim trailing completely empty rows
  while (rows.length > 0 && rows[rows.length - 1].length === 0) rows.pop();

  return {
    rows,
    totalRows: Math.max(totalRows, rows.length),
    totalCols: maxCols,
    truncated
  };
}

export function parseXlsxBuffer(buf: Buffer): SpreadsheetPreviewResult {
  const entries = extractZipEntries(buf, (p) => {
    const lower = p.toLowerCase();
    return (
      lower === 'xl/workbook.xml' ||
      lower === 'xl/_rels/workbook.xml.rels' ||
      lower === 'xl/sharedstrings.xml' ||
      lower === 'xl/styles.xml' ||
      (lower.startsWith('xl/worksheets/') && lower.endsWith('.xml'))
    );
  });

  const getEntryText = (target: string): string => {
    const lower = target.toLowerCase();
    for (const [k, v] of entries.entries()) {
      if (k.toLowerCase() === lower) return v.toString('utf8');
    }
    return '';
  };

  const workbookXml = getEntryText('xl/workbook.xml');
  const relsXml = getEntryText('xl/_rels/workbook.xml.rels');
  const sharedStrings = parseSharedStringsXml(getEntryText('xl/sharedstrings.xml'));
  const dateStyles = parseDateStyleIndices(getEntryText('xl/styles.xml'));
  const date1904 = /<workbookPr\b[^>]*\bdate1904\s*=\s*(?:"1"|'1'|"true"|'true')/i.test(workbookXml);

  // Map rId -> normalized target path (handles ../, ./, and leading /)
  const relMap = new Map<string, string>();
  const relRe = /<Relationship\b([^>]*)\/?>/gi;
  let relM: RegExpExecArray | null;
  while ((relM = relRe.exec(relsXml)) !== null) {
    const id = getAttr(relM[1], 'Id');
    const target = getAttr(relM[1], 'Target');
    if (id && target) {
      const cleaned = target.replace(/\\/g, '/');
      const joined = cleaned.startsWith('/') ? cleaned.slice(1) : path.posix.join('xl', cleaned);
      const norm = path.posix.normalize(joined).replace(/^\/+/, '');
      relMap.set(id, norm);
    }
  }

  const sheetDefs: Array<{ name: string; target: string }> = [];
  const sheetRe = /<sheet\b([^>]*)\/?>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = sheetRe.exec(workbookXml)) !== null) {
    const name = getAttr(sm[1], 'name') || `Sheet${sheetDefs.length + 1}`;
    const rId = getAttr(sm[1], 'r:id') || getAttr(sm[1], 'id');
    const target = (rId && relMap.get(rId)) || `xl/worksheets/sheet${sheetDefs.length + 1}.xml`;
    sheetDefs.push({ name, target });
    if (sheetDefs.length >= MAX_SHEETS) break;
  }

  // Fallback if workbook.xml wasn't matched cleanly
  if (sheetDefs.length === 0) {
    const wsKeys = Array.from(entries.keys())
      .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
      .sort();
    wsKeys.slice(0, MAX_SHEETS).forEach((k, i) => sheetDefs.push({ name: `Sheet${i + 1}`, target: k }));
  }

  const sheets: SpreadsheetSheetData[] = sheetDefs.map((def) => {
    const xml = getEntryText(def.target);
    const parsed = xml ? parseXlsxSheetXml(xml, sharedStrings, dateStyles, date1904) : { rows: [], totalRows: 0, totalCols: 0, truncated: false };
    return { name: def.name, ...parsed };
  });

  return { kind: 'spreadsheet', format: 'xlsx', sheets };
}

/* ==================== OpenDocument (.ods) Parser ==================== */

export function parseOdsBuffer(buf: Buffer): SpreadsheetPreviewResult {
  const entries = extractZipEntries(buf, (p) => p.toLowerCase() === 'content.xml');
  const contentBuf = entries.get('content.xml');
  if (!contentBuf) throw new Error('Invalid ODS file: content.xml not found.');
  const xml = contentBuf.toString('utf8');

  const sheets: SpreadsheetSheetData[] = [];
  const tableRe = /<table:table\b([^>]*)>([\s\S]*?)<\/table:table>/g;
  const rowRe = /<table:table-row\b([^>]*)>([\s\S]*?)<\/table:table-row>/g;
  const cellRe = /<table:table-cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-cell>)/g;
  const pRe = /<text:p\b[^>]*>([\s\S]*?)<\/text:p>/g;

  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(xml)) !== null && sheets.length < MAX_SHEETS) {
    const name = getAttr(tm[1], 'table:name') || `Sheet${sheets.length + 1}`;
    const rows: string[][] = [];
    let maxCols = 0;
    let totalRows = 0;
    let truncated = false;

    rowRe.lastIndex = 0;
    let rm: RegExpExecArray | null;
    while ((rm = rowRe.exec(tm[2])) !== null) {
      const repeatRows = Math.min(100, parseInt(getAttr(rm[1], 'table:number-rows-repeated') || '1', 10) || 1);
      const cells: string[] = [];
      cellRe.lastIndex = 0;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rm[2])) !== null && cells.length < MAX_COLS_PER_SHEET) {
        const repeatCols = Math.min(MAX_COLS_PER_SHEET - cells.length, parseInt(getAttr(cm[1], 'table:number-columns-repeated') || '1', 10) || 1);
        const cellBody = cm[2] || '';
        const parts: string[] = [];
        pRe.lastIndex = 0;
        let pm: RegExpExecArray | null;
        while ((pm = pRe.exec(cellBody)) !== null) {
          parts.push(decodeXmlEntities(pm[1].replace(/<[^>]+>/g, '')));
        }
        const val = parts.join('\n');
        // Don't explode trailing repeated empty cells to 1024 columns
        if (val === '' && repeatCols > 32) break;
        for (let c = 0; c < repeatCols; c++) cells.push(val);
      }
      while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      if (cells.length === 0 && repeatRows > 20) continue;
      for (let r = 0; r < repeatRows; r++) {
        totalRows++;
        if (rows.length < MAX_ROWS_PER_SHEET) {
          if (cells.length > maxCols) maxCols = cells.length;
          rows.push(cells.slice());
        } else {
          truncated = true;
        }
      }
    }
    while (rows.length > 0 && rows[rows.length - 1].length === 0) rows.pop();
    sheets.push({ name, rows, totalRows: Math.max(totalRows, rows.length), totalCols: maxCols, truncated });
  }
  return { kind: 'spreadsheet', format: 'ods', sheets };
}

/* ==================== Legacy Excel (.xls OLE2 / BIFF8) Parser ==================== */

function extractOle2WorkbookStream(buf: Buffer): Buffer {
  // Verify OLE2 CFBF magic: D0 CF 11 E0 A1 B1 1A E1
  if (buf.length < 512 || buf.readUInt32BE(0) !== 0xd0cf11e0 || buf.readUInt32BE(4) !== 0xa1b11ae1) {
    throw new Error('Not a valid legacy Excel (.xls) OLE2 file.');
  }
  const sectorShift = buf.readUInt16LE(30);
  const miniSectorShift = buf.readUInt16LE(32);
  if (sectorShift < 7 || sectorShift > 16 || miniSectorShift < 4 || miniSectorShift > sectorShift) {
    throw new Error('Corrupted legacy Excel (.xls) sector layout.');
  }
  const sectorSize = 1 << sectorShift;
  const miniSectorSize = 1 << miniSectorShift;
  const firstDirSector = buf.readUInt32LE(48);
  const miniCutoff = buf.readUInt32LE(56);
  const firstMiniFatSector = buf.readUInt32LE(60);
  const firstDifatSector = buf.readUInt32LE(68);
  const numDifatSectors = buf.readUInt32LE(72);

  const sectorOffset = (sec: number) => (sec + 1) * sectorSize;
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) {
    const s = buf.readUInt32LE(76 + i * 4);
    if (s < 0xfffffffc) fatSectors.push(s);
  }
  let difatSec = firstDifatSector;
  for (let d = 0; d < numDifatSectors && difatSec < 0xfffffffc; d++) {
    const off = sectorOffset(difatSec);
    if (off + sectorSize > buf.length) break;
    const perSec = sectorSize / 4 - 1;
    for (let i = 0; i < perSec; i++) {
      const s = buf.readUInt32LE(off + i * 4);
      if (s < 0xfffffffc) fatSectors.push(s);
    }
    difatSec = buf.readUInt32LE(off + perSec * 4);
  }

  const fat: number[] = [];
  for (const fsSec of fatSectors) {
    const off = sectorOffset(fsSec);
    if (off + sectorSize > buf.length) continue;
    for (let i = 0; i < sectorSize; i += 4) fat.push(buf.readUInt32LE(off + i));
  }

  const readChain = (startSec: number, maxLen?: number): Buffer => {
    const chunks: Buffer[] = [];
    let sec = startSec;
    let guard = 0;
    let total = 0;
    while (sec < 0xfffffffc && sec < fat.length && guard++ < 65536) {
      const off = sectorOffset(sec);
      if (off + sectorSize > buf.length) break;
      chunks.push(buf.subarray(off, off + sectorSize));
      total += sectorSize;
      if (maxLen !== undefined && total >= maxLen) break;
      sec = fat[sec];
    }
    const joined = Buffer.concat(chunks);
    return maxLen !== undefined ? joined.subarray(0, maxLen) : joined;
  };

  const dirStream = readChain(firstDirSector);
  let rootStart = 0xffffffff;
  let rootSize = 0;
  let wbEntry: { start: number; size: number } | null = null;

  for (let off = 0; off + 128 <= dirStream.length; off += 128) {
    const nameLen = dirStream.readUInt16LE(off + 64);
    if (nameLen < 2 || nameLen > 64) continue;
    const name = dirStream.subarray(off, off + nameLen - 2).toString('utf16le');
    const objType = dirStream[off + 66];
    const startSec = dirStream.readUInt32LE(off + 116);
    const size = dirStream.readUInt32LE(off + 120);
    if (objType === 5) {
      rootStart = startSec;
      rootSize = size;
    } else if (objType === 2 && (name === 'Workbook' || name === 'Book')) {
      wbEntry = { start: startSec, size };
    }
  }
  if (!wbEntry) throw new Error('Excel Workbook stream not found in .xls file.');

  if (wbEntry.size < miniCutoff && rootStart < 0xfffffffc && firstMiniFatSector < 0xfffffffc) {
    const miniContainer = readChain(rootStart, rootSize);
    const miniFatBuf = readChain(firstMiniFatSector);
    const miniFat: number[] = [];
    for (let i = 0; i + 4 <= miniFatBuf.length; i += 4) miniFat.push(miniFatBuf.readUInt32LE(i));
    const chunks: Buffer[] = [];
    let mSec = wbEntry.start;
    let guard = 0;
    while (mSec < 0xfffffffc && mSec < miniFat.length && guard++ < 65536) {
      const mOff = mSec * miniSectorSize;
      if (mOff + miniSectorSize > miniContainer.length) break;
      chunks.push(miniContainer.subarray(mOff, mOff + miniSectorSize));
      mSec = miniFat[mSec];
    }
    return Buffer.concat(chunks).subarray(0, wbEntry.size);
  }
  return readChain(wbEntry.start, wbEntry.size);
}

function decodeRkNumber(rk: number): number {
  const isDiv100 = (rk & 0x01) !== 0;
  const isInt = (rk & 0x02) !== 0;
  let val: number;
  if (isInt) {
    val = rk >> 2;
  } else {
    const tmp = Buffer.alloc(8);
    tmp.writeUInt32LE((rk & 0xfffffffc) >>> 0, 4);
    val = tmp.readDoubleLE(0);
  }
  return isDiv100 ? val / 100 : val;
}

export function parseXlsBuffer(buf: Buffer): SpreadsheetPreviewResult {
  const stream = extractOle2WorkbookStream(buf);
  const sst: string[] = [];
  const sheetMeta: Array<{ name: string; offset: number }> = [];

  // Pass 1: parse global BOUNDSHEET & SST records
  let pos = 0;
  while (pos + 4 <= stream.length) {
    const recId = stream.readUInt16LE(pos);
    const recLen = stream.readUInt16LE(pos + 2);
    const dataStart = pos + 4;
    if (dataStart + recLen > stream.length) break;

    if (recId === 0x0085 && recLen >= 8) {
      const bofOffset = stream.readUInt32LE(dataStart);
      const nameChars = stream[dataStart + 6];
      const flags = stream[dataStart + 7];
      const isUtf16 = (flags & 0x01) !== 0;
      const nameBuf = stream.subarray(dataStart + 8, dataStart + 8 + nameChars * (isUtf16 ? 2 : 1));
      const name = isUtf16 ? nameBuf.toString('utf16le') : nameBuf.toString('latin1');
      if (sheetMeta.length < MAX_SHEETS) sheetMeta.push({ name: name || `Sheet${sheetMeta.length + 1}`, offset: bofOffset });
    } else if (recId === 0x00fc && recLen >= 8) {
      // Collect SST + contiguous CONTINUE (0x003C) records
      const segs: Buffer[] = [stream.subarray(dataStart, dataStart + recLen)];
      let nextPos = dataStart + recLen;
      while (nextPos + 4 <= stream.length && stream.readUInt16LE(nextPos) === 0x003c) {
        const cLen = stream.readUInt16LE(nextPos + 2);
        if (nextPos + 4 + cLen > stream.length) break;
        segs.push(stream.subarray(nextPos + 4, nextPos + 4 + cLen));
        nextPos += 4 + cLen;
      }
      const uniqueCount = segs[0].readUInt32LE(4);
      let sIdx = 0;
      let sOff = 8;
      const readByte = () => {
        while (sIdx < segs.length && sOff >= segs[sIdx].length) { sIdx++; sOff = 0; }
        return sIdx < segs.length ? segs[sIdx][sOff++] : 0;
      };
      const readU16 = () => readByte() | (readByte() << 8);
      const readU32 = () => (readU16() | (readU16() << 16)) >>> 0;

      for (let i = 0; i < uniqueCount && sIdx < segs.length && i < 200_000; i++) {
        const charCount = readU16();
        let flags = readByte();
        let highByte = (flags & 0x01) !== 0;
        const richRuns = (flags & 0x08) !== 0 ? readU16() : 0;
        const extBytes = (flags & 0x04) !== 0 ? readU32() : 0;
        let outStr = '';
        let rem = charCount;
        while (rem > 0 && sIdx < segs.length) {
          if (sOff >= segs[sIdx].length) {
            sIdx++;
            sOff = 0;
            if (sIdx >= segs.length) break;
            highByte = (segs[sIdx][sOff++] & 0x01) !== 0;
          }
          const avail = segs[sIdx].length - sOff;
          const step = highByte ? 2 : 1;
          const takeChars = Math.min(rem, Math.floor(avail / step));
          if (takeChars <= 0) { sOff = segs[sIdx].length; continue; }
          const slice = segs[sIdx].subarray(sOff, sOff + takeChars * step);
          outStr += highByte ? slice.toString('utf16le') : slice.toString('latin1');
          sOff += takeChars * step;
          rem -= takeChars;
        }
        let skip = richRuns * 4 + extBytes;
        while (skip > 0 && sIdx < segs.length) {
          const avail = segs[sIdx].length - sOff;
          if (avail >= skip) { sOff += skip; skip = 0; }
          else { skip -= avail; sIdx++; sOff = 0; }
        }
        sst.push(outStr);
      }
      pos = nextPos;
      continue;
    } else if (recId === 0x000a) {
      break;
    }
    pos = dataStart + recLen;
  }

  // Pass 2: parse each worksheet
  const sheets: SpreadsheetSheetData[] = sheetMeta.map((meta) => {
    const rowMap = new Map<number, string[]>();
    let maxRow = -1;
    let maxCols = 0;
    let truncated = false;
    let p = meta.offset;
    let lastFormulaCell: { r: number; c: number } | null = null;

    const setCell = (r: number, c: number, val: string) => {
      if (r > maxRow) maxRow = r;
      if (r >= MAX_ROWS_PER_SHEET) { truncated = true; return; }
      if (c >= MAX_COLS_PER_SHEET) return;
      let row = rowMap.get(r);
      if (!row) { row = []; rowMap.set(r, row); }
      while (row.length <= c) row.push('');
      row[c] = val;
      if (c + 1 > maxCols) maxCols = c + 1;
    };

    while (p + 4 <= stream.length) {
      const id = stream.readUInt16LE(p);
      const len = stream.readUInt16LE(p + 2);
      const ds = p + 4;
      if (ds + len > stream.length) break;

      if (id === 0x000a) break; // EOF
      if (id === 0x00fd && len >= 10) {
        // LABELSST
        const r = stream.readUInt16LE(ds);
        const c = stream.readUInt16LE(ds + 2);
        const sIdx = stream.readUInt32LE(ds + 6);
        setCell(r, c, sst[sIdx] ?? '');
      } else if (id === 0x0204 && len >= 9) {
        // LABEL
        const r = stream.readUInt16LE(ds);
        const c = stream.readUInt16LE(ds + 2);
        const chars = stream.readUInt16LE(ds + 6);
        const isUtf16 = (stream[ds + 8] & 0x01) !== 0;
        const sBuf = stream.subarray(ds + 9, ds + 9 + chars * (isUtf16 ? 2 : 1));
        setCell(r, c, isUtf16 ? sBuf.toString('utf16le') : sBuf.toString('latin1'));
      } else if (id === 0x0203 && len >= 14) {
        // NUMBER
        setCell(stream.readUInt16LE(ds), stream.readUInt16LE(ds + 2), String(stream.readDoubleLE(ds + 6)));
      } else if (id === 0x027e && len >= 10) {
        // RK
        setCell(stream.readUInt16LE(ds), stream.readUInt16LE(ds + 2), String(decodeRkNumber(stream.readInt32LE(ds + 6))));
      } else if (id === 0x00bd && len >= 12) {
        // MULRK
        const r = stream.readUInt16LE(ds);
        const firstCol = stream.readUInt16LE(ds + 2);
        const lastCol = stream.readUInt16LE(ds + len - 2);
        let off = ds + 4;
        for (let c = firstCol; c <= lastCol && off + 6 <= ds + len - 2; c++, off += 6) {
          setCell(r, c, String(decodeRkNumber(stream.readInt32LE(off + 2))));
        }
      } else if (id === 0x0205 && len >= 8) {
        // BOOLERR
        const r = stream.readUInt16LE(ds);
        const c = stream.readUInt16LE(ds + 2);
        const isErr = stream[ds + 7] !== 0;
        setCell(r, c, isErr ? '#ERR' : (stream[ds + 6] ? 'TRUE' : 'FALSE'));
      } else if (id === 0x0006 && len >= 20) {
        // FORMULA cached value
        const r = stream.readUInt16LE(ds);
        const c = stream.readUInt16LE(ds + 2);
        if (stream.readUInt16LE(ds + 12) === 0xffff) {
          const kind = stream[ds + 6];
          if (kind === 0) lastFormulaCell = { r, c }; // string follows in STRING record (0x0207)
          else if (kind === 1) setCell(r, c, stream[ds + 8] ? 'TRUE' : 'FALSE');
        } else {
          setCell(r, c, String(stream.readDoubleLE(ds + 6)));
        }
      } else if (id === 0x0207 && lastFormulaCell && len >= 3) {
        const chars = stream.readUInt16LE(ds);
        const isUtf16 = (stream[ds + 2] & 0x01) !== 0;
        const sBuf = stream.subarray(ds + 3, ds + 3 + chars * (isUtf16 ? 2 : 1));
        setCell(lastFormulaCell.r, lastFormulaCell.c, isUtf16 ? sBuf.toString('utf16le') : sBuf.toString('latin1'));
        lastFormulaCell = null;
      } else if (id !== 0x003c) {
        lastFormulaCell = null;
      }

      p = ds + len;
    }

    const rows: string[][] = [];
    const limit = Math.min(maxRow + 1, MAX_ROWS_PER_SHEET);
    for (let r = 0; r < limit; r++) {
      rows.push(rowMap.get(r) || []);
    }
    while (rows.length > 0 && rows[rows.length - 1].length === 0) rows.pop();
    return {
      name: meta.name,
      rows,
      totalRows: Math.max(maxRow + 1, rows.length),
      totalCols: maxCols,
      truncated
    };
  });

  return { kind: 'spreadsheet', format: 'xls', sheets };
}

/* ==================== Word (.docx) Parser ==================== */

function extractWordParagraphText(pXml: string): string {
  // Replace tabs and breaks cleanly, then collect <w:t> runs
  const withBreaks = pXml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n');
  const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let out = '';
  let m: RegExpExecArray | null;
  while ((m = tRe.exec(withBreaks)) !== null) {
    out += decodeXmlEntities(m[1]);
  }
  return out;
}

export function parseDocxBuffer(buf: Buffer): DocxPreviewResult {
  const entries = extractZipEntries(buf, (p) => p.toLowerCase() === 'word/document.xml');
  const docBuf = entries.get('word/document.xml');
  if (!docBuf) throw new Error('Invalid DOCX file: word/document.xml not found.');
  const xml = docBuf.toString('utf8');
  const bodyMatch = /<w:body\b[^>]*>([\s\S]*?)<\/w:body>/.exec(xml);
  const bodyXml = bodyMatch ? bodyMatch[1] : xml;

  const blocks: DocxBlock[] = [];
  let truncated = false;

  // Walk top-level <w:p> and <w:tbl> elements sequentially
  const tokenRe = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(bodyXml)) !== null) {
    if (blocks.length >= MAX_DOCX_BLOCKS) {
      truncated = true;
      break;
    }
    const chunk = m[0];
    if (chunk.startsWith('<w:tbl')) {
      const rows: string[][] = [];
      const trRe = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
      const tcRe = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
      const pRe = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
      let trm: RegExpExecArray | null;
      while ((trm = trRe.exec(chunk)) !== null && rows.length < 200) {
        const cells: string[] = [];
        tcRe.lastIndex = 0;
        let tcm: RegExpExecArray | null;
        while ((tcm = tcRe.exec(trm[1])) !== null && cells.length < 40) {
          const cellLines: string[] = [];
          pRe.lastIndex = 0;
          let pm: RegExpExecArray | null;
          while ((pm = pRe.exec(tcm[1])) !== null) {
            const txt = extractWordParagraphText(pm[0]).trim();
            if (txt) cellLines.push(txt);
          }
          cells.push(cellLines.join('\n'));
        }
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length > 0) blocks.push({ type: 'table', rows });
    } else {
      const text = extractWordParagraphText(chunk).trim();
      if (!text) continue;
      const styleM = /<w:pStyle\b[^>]*w:val="([^"]+)"/i.exec(chunk);
      const styleVal = (styleM ? styleM[1] : '').toLowerCase();
      const headM = /heading\s*(\d)/.exec(styleVal);
      if (styleVal === 'title') {
        blocks.push({ type: 'heading', level: 1, text });
      } else if (headM) {
        blocks.push({ type: 'heading', level: Math.min(6, Math.max(1, parseInt(headM[1], 10))), text });
      } else {
        const isList = /<w:numPr\b/.test(chunk);
        blocks.push({ type: 'paragraph', text, ...(isList ? { isList: true } : {}) });
      }
    }
  }

  return { kind: 'docx', format: 'docx', blocks, truncated };
}

/* ==================== PowerPoint (.pptx) Parser (inspired by DocsView) ==================== */

function extractDrawingParagraphs(xml: string): string[] {
  const out: string[] = [];
  const pRe = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  const tRe = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(xml)) !== null) {
    let line = '';
    tRe.lastIndex = 0;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(pm[1])) !== null) line += decodeXmlEntities(tm[1]);
    const trimmed = line.trim();
    if (trimmed) out.push(trimmed);
  }
  return out;
}

export function parsePptxBuffer(buf: Buffer): PptxPreviewResult {
  const entries = extractZipEntries(buf, (p) => {
    const l = p.toLowerCase();
    return (
      /^ppt\/slides\/slide\d+\.xml$/.test(l) ||
      /^ppt\/notesslides\/notesslide\d+\.xml$/.test(l)
    );
  });

  const slideKeys = Array.from(entries.keys())
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
    .sort((a, b) => {
      const na = parseInt((/\d+/.exec(a) || ['0'])[0], 10);
      const nb = parseInt((/\d+/.exec(b) || ['0'])[0], 10);
      return na - nb;
    });

  const MAX_SLIDES = 120;
  const truncated = slideKeys.length > MAX_SLIDES;
  const slides: PptxSlideData[] = [];

  for (let i = 0; i < Math.min(slideKeys.length, MAX_SLIDES); i++) {
    const key = slideKeys[i];
    const numMatch = /slide(\d+)\.xml$/i.exec(key);
    const slideNum = numMatch ? parseInt(numMatch[1], 10) : i + 1;
    const xml = entries.get(key)!.toString('utf8');

    // Extract tables (<a:tbl>) separately so cells don't mix into prose paragraphs
    const tables: string[][][] = [];
    const withoutTables = xml.replace(/<a:tbl\b[^>]*>([\s\S]*?)<\/a:tbl>/g, (_m, tblXml: string) => {
      const rows: string[][] = [];
      const trRe = /<a:tr\b[^>]*>([\s\S]*?)<\/a:tr>/g;
      const tcRe = /<a:tc\b[^>]*>([\s\S]*?)<\/a:tc>/g;
      let trm: RegExpExecArray | null;
      while ((trm = trRe.exec(tblXml)) !== null && rows.length < 100) {
        const cells: string[] = [];
        tcRe.lastIndex = 0;
        let tcm: RegExpExecArray | null;
        while ((tcm = tcRe.exec(trm[1])) !== null && cells.length < 30) {
          cells.push(extractDrawingParagraphs(tcm[1]).join(' '));
        }
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length > 0) tables.push(rows);
      return '';
    });

    const paragraphs = extractDrawingParagraphs(withoutTables);
    const title = paragraphs.length > 0 ? paragraphs[0] : `Slide ${slideNum}`;
    const bodyParagraphs = paragraphs.length > 1 ? paragraphs.slice(1) : [];

    // Find matching speaker notes if present
    let notes = '';
    for (const [nk, nbuf] of entries.entries()) {
      if (nk.toLowerCase() === `ppt/notesslides/notesslide${slideNum}.xml`) {
        const nLines = extractDrawingParagraphs(nbuf.toString('utf8')).filter((l) => !/^\d+$/.test(l));
        notes = nLines.join('\n');
        break;
      }
    }

    slides.push({ index: slideNum, title, paragraphs: bodyParagraphs, tables, notes });
  }

  return { kind: 'pptx', format: 'pptx', slides, truncated };
}

/* ==================== Zero-Decompress ZIP Archive Inspector (inspired by DocsView) ==================== */

export function parseZipListingBuffer(buf: Buffer): ArchivePreviewResult {
  if (buf.length < 22) throw new Error('Invalid or truncated ZIP archive.');
  const minPos = Math.max(0, buf.length - 65557);
  let eocdPos = -1;
  for (let p = buf.length - 22; p >= minPos; p--) {
    if (buf.readUInt32LE(p) === 0x06054b50) {
      eocdPos = p;
      break;
    }
  }
  if (eocdPos === -1) throw new Error('ZIP End of Central Directory record not found.');

  const totalEntries = buf.readUInt16LE(eocdPos + 10);
  const cdSize = buf.readUInt32LE(eocdPos + 12);
  const cdOffset = buf.readUInt32LE(eocdPos + 16);
  if (cdOffset + cdSize > buf.length) throw new Error('Corrupted ZIP Central Directory.');

  const MAX_LIST = 2000;
  const entries: ArchiveEntryMeta[] = [];
  let totalFiles = 0;
  let totalSize = 0;
  let totalCompressedSize = 0;
  let cursor = cdOffset;

  for (let i = 0; i < totalEntries && cursor + 46 <= cdOffset + cdSize; i++) {
    if (buf.readUInt32LE(cursor) !== 0x02014b50) break;
    const methodNum = buf.readUInt16LE(cursor + 10);
    const compSize = buf.readUInt32LE(cursor + 20);
    const uncompSize = buf.readUInt32LE(cursor + 24);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const entryName = buf.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');
    cursor += 46 + nameLen + extraLen + commentLen;

    const isDirectory = entryName.endsWith('/');
    if (!isDirectory) {
      totalFiles++;
      totalSize += uncompSize;
      totalCompressedSize += compSize;
    }
    if (entries.length < MAX_LIST) {
      entries.push({
        path: entryName,
        isDirectory,
        size: uncompSize,
        compressedSize: compSize,
        method: methodNum === 0 ? 'STORE' : methodNum === 8 ? 'DEFLATE' : `M${methodNum}`
      });
    }
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  return {
    kind: 'archive',
    format: 'zip',
    entries,
    totalFiles,
    totalSize,
    totalCompressedSize,
    truncated: totalEntries > MAX_LIST
  };
}

/* ==================== Unified Dispatcher ==================== */

const ZIP_ARCHIVE_EXTS = new Set(['.zip', '.vsix', '.whl', '.jar', '.apk', '.nupkg', '.epub']);

export function isSupportedOfficePreviewPath(filePath: string): boolean {
  const ext = path.extname(filePath || '').toLowerCase();
  return (
    ext === '.xlsx' ||
    ext === '.xlsm' ||
    ext === '.xls' ||
    ext === '.ods' ||
    ext === '.docx' ||
    ext === '.pptx' ||
    ZIP_ARCHIVE_EXTS.has(ext)
  );
}

export function parseOfficePreviewBuffer(filePath: string, buf: Buffer): OfficePreviewResult {
  const ext = path.extname(filePath || '').toLowerCase();
  if (ext === '.xlsx' || ext === '.xlsm') return parseXlsxBuffer(buf);
  if (ext === '.ods') return parseOdsBuffer(buf);
  if (ext === '.xls') return parseXlsBuffer(buf);
  if (ext === '.docx') return parseDocxBuffer(buf);
  if (ext === '.pptx') return parsePptxBuffer(buf);
  if (ZIP_ARCHIVE_EXTS.has(ext)) return parseZipListingBuffer(buf);
  throw new Error(`Unsupported office preview format: ${ext || '(none)'}`);
}
