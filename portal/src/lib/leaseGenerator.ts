/**
 * Lease Generator — deterministic PDF generation from templates
 *
 * Approach: Structured PDF layout via pdf-lib.
 * 1. Parse HTML template body extracting text blocks and anchor positions
 * 2. Render sections as text using pdf-lib with known coordinates
 * 3. Anchors ([[SIGNATURE:...]], [[DATE:...]], [[INITIAL:...]], [[CHECK:...]], [[TEXT:...]]) become
 *    known rectangles in the output → field map
 *
 * NO guessing. Every field coordinate comes from explicit anchor positions.
 */

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type {
  LeaseTemplate,
  SignatureFieldDef,
  LeaseSignatureFieldValue,
  FieldOwnerRole,
  FieldPhase,
} from '../types';

/* ─── Constants ─── */
const PAGE_WIDTH = 612;   // US Letter
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 60;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const LINE_HEIGHT = 14;
const HEADING_SIZE = 16;
const BODY_SIZE = 10;
const SMALL_SIZE = 8;

// Signature/field box dimensions
const SIG_BOX_WIDTH = 200;
const SIG_BOX_HEIGHT = 40;
const DATE_BOX_WIDTH = 140;
const DATE_BOX_HEIGHT = 24;
const INITIAL_BOX_WIDTH = 60;
const INITIAL_BOX_HEIGHT = 24;
const CHECK_BOX_WIDTH = 20;
const CHECK_BOX_HEIGHT = 20;
const TEXT_BOX_WIDTH = 240;
const TEXT_BOX_HEIGHT = 24;

/* ─── Anchor regex ─── */
const ANCHOR_REGEX = /\[\[(SIGNATURE|DATE|INITIAL|CHECK|TEXT):([^\]]+)\]\]/g;
const PLACEHOLDER_REGEX = /\{\{([A-Z_]+)\}\}/g;

/* ─── Types ─── */
interface LayoutBlock {
  type: 'heading' | 'paragraph' | 'anchor' | 'spacer';
  text?: string;
  anchor?: SignatureFieldDef;
}

export interface GenerationResult {
  pdfBytes: Uint8Array;
  fieldMap: LeaseSignatureFieldValue[];
}

/* ─── Placeholder substitution ─── */
export function substitutePlaceholders(
  templateBody: string,
  values: Record<string, string>,
): string {
  return templateBody.replace(PLACEHOLDER_REGEX, (match, key: string) => {
    return values[key] !== undefined ? values[key] : match;
  });
}

/* ─── Validate anchors ─── */
export function validateAnchors(
  templateBody: string,
  signatureSchema: SignatureFieldDef[],
): string[] {
  const errors: string[] = [];
  for (const field of signatureSchema) {
    if (!templateBody.includes(field.anchor)) {
      errors.push(`Template missing required anchor ${field.anchor}`);
    }
  }
  return errors;
}

/* ─── Parse HTML template into layout blocks ─── */
function parseTemplate(body: string, signatureSchema: SignatureFieldDef[]): LayoutBlock[] {
  const blocks: LayoutBlock[] = [];
  // Build anchor lookup
  const anchorMap = new Map<string, SignatureFieldDef>();
  for (const s of signatureSchema) {
    anchorMap.set(s.anchor, s);
  }

  // Strip HTML tags but preserve structure
  // Convert <h1>-<h6> to heading blocks, <p>/<div>/<br> to paragraph breaks
  let html = body;

  // Normalize line breaks
  html = html.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<\/p>/gi, '\n\n');
  html = html.replace(/<\/div>/gi, '\n');
  html = html.replace(/<\/li>/gi, '\n');

  // Extract headings
  html = html.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n##HEADING##$1##/HEADING##\n');

  // Strip remaining HTML tags
  html = html.replace(/<[^>]+>/g, '');

  // Decode basic HTML entities
  html = html.replace(/&amp;/g, '&');
  html = html.replace(/&lt;/g, '<');
  html = html.replace(/&gt;/g, '>');
  html = html.replace(/&quot;/g, '"');
  html = html.replace(/&#39;/g, "'");
  html = html.replace(/&nbsp;/g, ' ');

  // Split into lines
  const lines = html.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      blocks.push({ type: 'spacer' });
      continue;
    }

    // Check for heading marker
    const headingMatch = line.match(/^##HEADING##(.+?)##\/HEADING##$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', text: headingMatch[1].trim() });
      continue;
    }

    // Check if line contains an anchor
    const anchorMatch = line.match(ANCHOR_REGEX);
    if (anchorMatch) {
      let remaining = line;
      let anchorRegexInner = /\[\[(SIGNATURE|DATE|INITIAL|CHECK|TEXT):([^\]]+)\]\]/;
      let m: RegExpMatchArray | null;
      while ((m = remaining.match(anchorRegexInner))) {
        const before = remaining.substring(0, m.index!).trim();
        if (before) {
          blocks.push({ type: 'paragraph', text: before });
        }
        const fullAnchor = m[0];
        const def = anchorMap.get(fullAnchor);
        if (def) {
          blocks.push({ type: 'anchor', anchor: def });
        } else {
          // Unknown anchor, render as text
          blocks.push({ type: 'paragraph', text: fullAnchor });
        }
        remaining = remaining.substring(m.index! + fullAnchor.length);
      }
      const after = remaining.trim();
      if (after) {
        blocks.push({ type: 'paragraph', text: after });
      }
      continue;
    }

    // Regular paragraph
    blocks.push({ type: 'paragraph', text: line });
  }

  return blocks;
}

/* ─── Word-wrap text to fit width ─── */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

/* ─── Draw dashed rectangle for field boxes ─── */
function drawFieldBox(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  font: PDFFont,
) {
  // Draw border
  page.drawRectangle({
    x, y, width: w, height: h,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 0.75,
    color: rgb(0.97, 0.97, 0.97),
  });
  // Draw label above
  page.drawText(label, {
    x: x + 2,
    y: y + h + 3,
    size: 7,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  // Draw X marker inside
  page.drawText('X', {
    x: x + w / 2 - 4,
    y: y + h / 2 - 5,
    size: 12,
    font,
    color: rgb(0.75, 0.75, 0.75),
  });
}

/* ─── Main generation function ─── */
export async function generateLeasePdf(
  template: LeaseTemplate,
  fieldValues: Record<string, string>,
): Promise<GenerationResult> {
  // 1. Validate anchors
  const errors = validateAnchors(template.templateBody, template.signatureSchema);
  if (errors.length > 0) {
    throw new Error(`Template validation failed:\n${errors.join('\n')}`);
  }

  // 2. Substitute placeholders
  const filledBody = substitutePlaceholders(template.templateBody, fieldValues);

  // 3. Parse into layout blocks
  const blocks = parseTemplate(filledBody, template.signatureSchema);

  // 4. Create PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN_TOP;
  let pageNum = 1;
  const fieldMap: LeaseSignatureFieldValue[] = [];

  function ensureSpace(needed: number): void {
    if (cursorY - needed < MARGIN_BOTTOM) {
      // Add page number footer
      page.drawText(`Page ${pageNum}`, {
        x: PAGE_WIDTH / 2 - 20,
        y: MARGIN_BOTTOM / 2,
        size: SMALL_SIZE,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pageNum++;
      cursorY = PAGE_HEIGHT - MARGIN_TOP;
    }
  }

  for (const block of blocks) {
    switch (block.type) {
      case 'spacer':
        cursorY -= LINE_HEIGHT * 0.5;
        break;

      case 'heading': {
        ensureSpace(HEADING_SIZE + LINE_HEIGHT);
        cursorY -= 6; // extra space before heading
        page.drawText(block.text!, {
          x: MARGIN_LEFT,
          y: cursorY,
          size: HEADING_SIZE,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.15),
        });
        cursorY -= HEADING_SIZE + 4;
        // Underline
        page.drawLine({
          start: { x: MARGIN_LEFT, y: cursorY },
          end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: cursorY },
          thickness: 0.5,
          color: rgb(0.7, 0.7, 0.7),
        });
        cursorY -= LINE_HEIGHT * 0.5;
        break;
      }

      case 'paragraph': {
        const lines = wrapText(block.text!, font, BODY_SIZE, CONTENT_WIDTH);
        for (const line of lines) {
          ensureSpace(LINE_HEIGHT);
          page.drawText(line, {
            x: MARGIN_LEFT,
            y: cursorY,
            size: BODY_SIZE,
            font,
            color: rgb(0.15, 0.15, 0.15),
          });
          cursorY -= LINE_HEIGHT;
        }
        break;
      }

      case 'anchor': {
        const def = block.anchor!;
        let boxW: number, boxH: number;
        if (def.type === 'signature') {
          boxW = SIG_BOX_WIDTH;
          boxH = SIG_BOX_HEIGHT;
        } else if (def.type === 'date') {
          boxW = DATE_BOX_WIDTH;
          boxH = DATE_BOX_HEIGHT;
        } else if (def.type === 'check') {
          boxW = CHECK_BOX_WIDTH;
          boxH = CHECK_BOX_HEIGHT;
        } else if (def.type === 'text') {
          boxW = TEXT_BOX_WIDTH;
          boxH = TEXT_BOX_HEIGHT;
        } else {
          boxW = INITIAL_BOX_WIDTH;
          boxH = INITIAL_BOX_HEIGHT;
        }

        // Extra spacing before anchor
        cursorY -= 4;
        ensureSpace(boxH + 20);

        const boxX = MARGIN_LEFT;
        const boxY = cursorY - boxH;

        drawFieldBox(page, boxX, boxY, boxW, boxH, def.displayLabel, font);

        // Store in field map with deterministic coordinates
        fieldMap.push({
          fieldId: def.id,
          type: def.type,
          role: def.role,
          pageNumber: pageNum,
          x: boxX,
          y: boxY,
          width: boxW,
          height: boxH,
          required: def.required,
          displayLabel: def.displayLabel,
          ownerRole: def.ownerRole,
          phase: def.phase,
        });

        cursorY = boxY - LINE_HEIGHT;
        break;
      }
    }
  }

  // Final page number
  page.drawText(`Page ${pageNum}`, {
    x: PAGE_WIDTH / 2 - 20,
    y: MARGIN_BOTTOM / 2,
    size: SMALL_SIZE,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Footer with template info
  page.drawText(
    `Generated from template "${template.name}" v${template.version}`,
    {
      x: MARGIN_LEFT,
      y: MARGIN_BOTTOM / 2,
      size: 6,
      font: fontItalic,
      color: rgb(0.6, 0.6, 0.6),
    },
  );

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes: new Uint8Array(pdfBytes), fieldMap };
}

/* ─── Apply signatures to PDF ─── */
export async function applySignaturesToPdf(
  originalPdfBytes: Uint8Array,
  completedFields: LeaseSignatureFieldValue[],
  signerName: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const pages = pdfDoc.getPages();

  for (const field of completedFields) {
    if (!field.completedAt) continue;
    const pageIndex = field.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const pg = pages[pageIndex];

    if (field.type === 'signature' && field.signedImagePath) {
      // The signedImagePath will be a data URL or bytes — handled by caller
      // For typed signatures, render text in italic
      if (field.value) {
        pg.drawText(field.value, {
          x: field.x + 4,
          y: field.y + field.height / 2 - 6,
          size: 18,
          font: fontItalic,
          color: rgb(0.05, 0.05, 0.2),
        });
      }
    } else if (field.type === 'date') {
      pg.drawText(field.value || new Date().toLocaleDateString('en-US'), {
        x: field.x + 4,
        y: field.y + field.height / 2 - 5,
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
    } else if (field.type === 'initial') {
      pg.drawText(field.value || signerName.split(' ').map(n => n[0]).join(''), {
        x: field.x + 4,
        y: field.y + field.height / 2 - 5,
        size: 12,
        font: fontItalic,
        color: rgb(0.05, 0.05, 0.2),
      });
    }
  }

  // Stamp signing metadata
  const lastPage = pages[pages.length - 1];
  const ts = new Date().toISOString();
  lastPage.drawText(
    `E-signed by ${signerName} on ${ts}`,
    { x: 40, y: 16, size: 7, font, color: rgb(0.4, 0.4, 0.4) },
  );

  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}

/**
 * Embed a PNG signature image into a PDF at the specified field coordinates.
 */
export async function embedSignatureImage(
  pdfDoc: PDFDocument,
  pageIndex: number,
  field: LeaseSignatureFieldValue,
  imageBytes: Uint8Array,
): Promise<void> {
  const pngImage = await pdfDoc.embedPng(imageBytes);
  const pages = pdfDoc.getPages();
  if (pageIndex < 0 || pageIndex >= pages.length) return;
  const pg = pages[pageIndex];

  const aspectRatio = pngImage.width / pngImage.height;
  const drawH = field.height - 4;
  const drawW = Math.min(drawH * aspectRatio, field.width - 4);

  pg.drawImage(pngImage, {
    x: field.x + 2,
    y: field.y + 2,
    width: drawW,
    height: drawH,
  });
}

/* ─── Extract available placeholder keys from template body ─── */
export function extractPlaceholders(body: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(PLACEHOLDER_REGEX.source, 'g');
  while ((match = regex.exec(body))) {
    found.add(match[1]);
  }
  return Array.from(found);
}

/* ─── Extract anchors from template body ─── */
export function extractAnchors(body: string): Array<{ type: string; detail: string; full: string }> {
  const found: Array<{ type: string; detail: string; full: string }> = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(ANCHOR_REGEX.source, 'g');
  while ((match = regex.exec(body))) {
    found.push({ type: match[1], detail: match[2], full: match[0] });
  }
  return found;
}

/* ─── Build default fieldSchema from placeholder list ─── */
export function buildFieldSchemaFromPlaceholders(
  keys: string[],
): Array<{ key: string; label: string; type: 'text' | 'date' | 'money' | 'list' | 'boolean'; required: boolean }> {
  return keys.map(key => {
    let type: 'text' | 'date' | 'money' | 'list' | 'boolean' = 'text';
    if (key.includes('DATE')) type = 'date';
    else if (key.includes('AMOUNT') || key.includes('RENT') || key.includes('DEPOSIT') || key.includes('FEE')) type = 'money';
    else if (key.includes('OCCUPANTS') || key.includes('PETS') || key.includes('UTILITIES')) type = 'list';

    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return { key, label, type, required: true };
  });
}

/* ─── Determine ownerRole and phase from anchor detail ─── */
function inferOwnerAndPhase(type: string, detail: string): { ownerRole: FieldOwnerRole; phase: FieldPhase; required: boolean } {
  const lowerDetail = detail.toLowerCase();
  // Move-in inspection anchors: [[CHECK:move_in:...]] or [[TEXT:move_in:...]]
  if (lowerDetail.startsWith('move_in') || lowerDetail.startsWith('inspection') || lowerDetail.includes('inspection')) {
    return { ownerRole: 'tenant', phase: 'move_in_inspection', required: false };
  }
  // Signing anchors: signature, date (for signing), initial
  if (type === 'SIGNATURE' || type === 'INITIAL') {
    return { ownerRole: 'tenant', phase: 'signing', required: true };
  }
  if (type === 'DATE') {
    return { ownerRole: 'tenant', phase: 'signing', required: true };
  }
  return { ownerRole: 'tenant', phase: 'any', required: true };
}

/* ─── Build signatureSchema from anchor list ─── */
export function buildSignatureSchemaFromAnchors(
  anchors: Array<{ type: string; detail: string; full: string }>,
): SignatureFieldDef[] {
  return anchors.map((a, i) => {
    const type = a.type.toLowerCase() as 'signature' | 'date' | 'initial' | 'check' | 'text';
    const parts = a.detail.split(':');
    // For namespace-based anchors (move_in:field, inspection:field), role is always tenant
    const isNamespaced = ['move_in', 'inspection'].includes(parts[0]);
    const role = (!isNamespaced && parts[0] === 'landlord' ? 'landlord' : 'tenant') as 'tenant' | 'landlord';
    const section = isNamespaced ? parts.slice(1).join(':') || parts[0] : parts.slice(1).join(':') || parts[0];
    const id = `${type}_${a.detail.replace(/[^a-zA-Z0-9]/g, '_')}_${i}`;
    const { ownerRole, phase, required } = inferOwnerAndPhase(a.type, a.detail);
    const displayLabel = section
      ? `${type === 'check' ? '[Check]' : type === 'text' ? '[Text]' : role === 'landlord' ? 'Landlord' : 'Tenant'} ${type === 'check' || type === 'text' ? section.replace(/_/g, ' ') : type + ' (' + section.replace(/_/g, ' ') + ')'}`
      : `${role === 'landlord' ? 'Landlord' : 'Tenant'} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    return { id, type, role, anchor: a.full, required, displayLabel, ownerRole, phase };
  });
}
