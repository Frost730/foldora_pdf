import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import { Job } from '../types';

export const CLIENT_SIDE_SUPPORTED_TOOLS = [
  'rotate-pdf',
  'merge-pdf',
  'split-pdf',
  'add-watermark',
  'remove-pages',
  'extract-pages',
];

export function canRunClientSide(toolId: string): boolean {
  return CLIENT_SIDE_SUPPORTED_TOOLS.includes(toolId);
}

function hexToRgb01(hex: string): [number, number, number] {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) return [0.5, 0.5, 0.5];
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
}

function parsePageRanges(rangeStr: string, totalPages: number): number[] {
  if (!rangeStr || !rangeStr.trim()) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const indices: Set<number> = new Set();
  const parts = rangeStr.split(',');
  for (const part of parts) {
    const p = part.trim();
    if (p.includes('-')) {
      const [startStr, endStr] = p.split('-');
      const start = Math.max(1, parseInt(startStr, 10));
      const end = Math.min(totalPages, parseInt(endStr, 10));
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          indices.add(i - 1);
        }
      }
    } else {
      const idx = parseInt(p, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= totalPages) {
        indices.add(idx - 1);
      }
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}

export async function executeClientSidePdf(
  toolId: string,
  files: File[],
  options: Record<string, any>
): Promise<Job> {
  if (!files || files.length === 0) {
    throw new Error('No files provided for client-side processing');
  }

  let pdfBytes: Uint8Array;
  let outFilename = 'processed_document.pdf';

  if (toolId === 'rotate-pdf') {
    const file = files[0];
    outFilename = file.name.replace(/\.pdf$/i, '') + '_rotated.pdf';
    const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const angle = Number(options.angle ?? 90);
    const pages = doc.getPages();
    pages.forEach((p) => {
      const current = p.getRotation().angle;
      p.setRotation(degrees((current + angle) % 360));
    });
    pdfBytes = await doc.save();
  } else if (toolId === 'merge-pdf') {
    outFilename = 'merged_document.pdf';
    const mergedDoc = await PDFDocument.create();
    for (const f of files) {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      const copied = await mergedDoc.copyPages(doc, doc.getPageIndices());
      copied.forEach((p) => mergedDoc.addPage(p));
    }
    pdfBytes = await mergedDoc.save();
  } else if (toolId === 'split-pdf') {
    const file = files[0];
    outFilename = file.name.replace(/\.pdf$/i, '') + '_extracted.pdf';
    const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const total = doc.getPageCount();
    const indices = parsePageRanges(options.pages || options.page_indices || '1', total);
    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(doc, indices.length > 0 ? indices : [0]);
    copied.forEach((p) => newDoc.addPage(p));
    pdfBytes = await newDoc.save();
  } else if (toolId === 'remove-pages') {
    const file = files[0];
    outFilename = file.name.replace(/\.pdf$/i, '') + '_filtered.pdf';
    const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const total = doc.getPageCount();
    const toRemove = new Set(parsePageRanges(options.pages || options.page_indices || '', total));
    const toKeep = Array.from({ length: total }, (_, i) => i).filter((i) => !toRemove.has(i));
    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(doc, toKeep.length > 0 ? toKeep : [0]);
    copied.forEach((p) => newDoc.addPage(p));
    pdfBytes = await newDoc.save();
  } else if (toolId === 'extract-pages') {
    const file = files[0];
    outFilename = file.name.replace(/\.pdf$/i, '') + '_extracted.pdf';
    const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const total = doc.getPageCount();
    const indices = parsePageRanges(options.pages || options.page_indices || '1', total);
    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(doc, indices.length > 0 ? indices : [0]);
    copied.forEach((p) => newDoc.addPage(p));
    pdfBytes = await newDoc.save();
  } else if (toolId === 'add-watermark') {
    const file = files[0];
    outFilename = file.name.replace(/\.pdf$/i, '') + '_watermarked.pdf';
    const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const text = options.watermark_text || options.text || 'CONFIDENTIAL';
    const opacity = Math.max(0.05, Math.min(1.0, parseFloat(options.opacity ?? '0.3')));
    const rotDeg = parseFloat(options.rotation ?? '45');
    const fSize = Math.max(10, Math.min(120, parseFloat(options.font_size ?? '48')));
    const [r, g, b] = hexToRgb01(options.color_hex || '#94a3b8');

    const pages = doc.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();
      // Draw centered watermark
      page.drawText(text, {
        x: width * 0.25,
        y: height * 0.45,
        size: fSize,
        font,
        color: rgb(r, g, b),
        rotate: degrees(rotDeg),
        opacity,
      });
    }
    pdfBytes = await doc.save();
  } else {
    throw new Error(`Tool ${toolId} not supported client-side, falling back to server`);
  }

  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(blob);


  const job: Job = {
    id: `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    tool_id: toolId,
    status: 'completed',
    progress: 100,
    message: 'Processed 100% locally in your browser (0 MB server RAM, maximum privacy)',
    download_token: 'local_client_token',
    input_files: files.map((f, i) => ({
      file_id: `in_${i}`,
      original_name: f.name,
      size_bytes: f.size,
      content_type: f.type || 'application/pdf',
    })),
    output_files: [
      {
        file_id: 'out_client_0',
        filename: outFilename,
        size_bytes: pdfBytes.byteLength,
        content_type: 'application/pdf',
        download_url: downloadUrl,
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      client_processed: true,
      instant_speed: true,
      total_pages_affected: files.length,
    },
    options,
  };

  return job;
}
