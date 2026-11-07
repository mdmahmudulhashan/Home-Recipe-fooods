import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { IdCardEmployeeData } from '../components/IdCardPreview.tsx';

// Standard CR80 Card Dimensions in millimeters
export const CR80_WIDTH_MM = 54;
export const CR80_HEIGHT_MM = 85.6;

/**
 * Captures an HTML element into a lossless, high-DPI PNG data URL using html-to-image.
 * We strictly use PNG (never JPEG) to prevent lossy Discrete Cosine Transform (DCT)
 * edge ringing artifacts, which appear as black/dark separator lines on card borders.
 */
export async function captureElementToImageData(element: HTMLElement): Promise<string> {
  const options = {
    pixelRatio: 2.5, // 2.5x high-res DPI (crisp 300+ DPI equivalent for print)
    backgroundColor: '#FFF9EF', // Match Ivory background, never black
    cacheBust: false,
    skipFonts: true, // Prevents SecurityError on remote Google Fonts cssRules
    fontEmbedCSS: '',
    imagePlaceholder:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  };

  return await toPng(element, options);
}

/**
 * Downloads a high-resolution PDF for a single employee (Front, Back, or Both pages).
 * Strictly enforces CR80 portrait dimensions (54mm x 85.6mm) on every page.
 */
export async function downloadIdCardPdf(
  frontElement: HTMLElement | null,
  backElement: HTMLElement | null,
  employee: IdCardEmployeeData,
  mode: 'both' | 'front' | 'back' = 'both'
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [CR80_WIDTH_MM, CR80_HEIGHT_MM],
    compress: true,
  });

  let pageAdded = false;

  // Page 1: Front Side
  if ((mode === 'both' || mode === 'front') && frontElement) {
    const imgData = await captureElementToImageData(frontElement);
    pdf.addImage(imgData, 'PNG', 0, 0, CR80_WIDTH_MM, CR80_HEIGHT_MM, undefined, 'FAST');
    pageAdded = true;
  }

  // Page 2: Back Side
  if ((mode === 'both' || mode === 'back') && backElement) {
    const imgData = await captureElementToImageData(backElement);
    if (pageAdded) {
      pdf.addPage([CR80_WIDTH_MM, CR80_HEIGHT_MM], 'portrait');
    }
    pdf.addImage(imgData, 'PNG', 0, 0, CR80_WIDTH_MM, CR80_HEIGHT_MM, undefined, 'FAST');
  }

  const cleanName = (employee.fullName || 'employee')
    .replace(/[^\w\s\u0980-\u09FF]/gi, '')
    .trim()
    .replace(/\s+/g, '_');
  const filename = `ID_Card_${employee.employeeCode || employee.id}_${cleanName || 'Employee'}.pdf`;
  pdf.save(filename);
}

export interface BulkExportItem {
  employee: IdCardEmployeeData;
  frontElement: HTMLElement | null;
  backElement: HTMLElement | null;
}

/**
 * Downloads a multi-page PDF containing multiple employees in strict sequence:
 * Page 1: Emp 1 Front
 * Page 2: Emp 1 Back
 * Page 3: Emp 2 Front
 * Page 4: Emp 2 Back
 * (Or if mode is 'front': Emp 1 Front, Emp 2 Front...; if 'back': Emp 1 Back, Emp 2 Back...)
 */
export async function downloadBulkIdCardPdf(
  items: BulkExportItem[],
  mode: 'both' | 'front' | 'back' = 'both',
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (items.length === 0) return;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [CR80_WIDTH_MM, CR80_HEIGHT_MM],
    compress: true,
  });

  let isFirstPage = true;
  const total = items.length;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (onProgress) onProgress(i + 1, total);

    // Front Side
    if (mode === 'both' || mode === 'front') {
      if (item.frontElement) {
        const imgData = await captureElementToImageData(item.frontElement);
        if (!isFirstPage) {
          pdf.addPage([CR80_WIDTH_MM, CR80_HEIGHT_MM], 'portrait');
        }
        pdf.addImage(imgData, 'PNG', 0, 0, CR80_WIDTH_MM, CR80_HEIGHT_MM, undefined, 'FAST');
        isFirstPage = false;
      }
    }

    // Back Side
    if (mode === 'both' || mode === 'back') {
      if (item.backElement) {
        const imgData = await captureElementToImageData(item.backElement);
        if (!isFirstPage) {
          pdf.addPage([CR80_WIDTH_MM, CR80_HEIGHT_MM], 'portrait');
        }
        pdf.addImage(imgData, 'PNG', 0, 0, CR80_WIDTH_MM, CR80_HEIGHT_MM, undefined, 'FAST');
        isFirstPage = false;
      }
    }
  }

  const filename = `HomeRecipeFoods_ID_Cards_Bulk_${items.length}_Cards.pdf`;
  pdf.save(filename);
}

/**
 * Downloads an A4 Sheet Grid PDF (210mm x 297mm) with 6 cards per page
 * (2 columns x 3 rows). Perfect for standard desktop color printers.
 * If mode === 'both', Front and Back of each employee are placed side-by-side
 * for convenient dual-sided folding or pouch lamination.
 */
export async function downloadA4SheetIdCardPdf(
  items: BulkExportItem[],
  mode: 'both' | 'front' | 'back' = 'both',
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (items.length === 0) return;

  const A4_W = 210;
  const A4_H = 297;
  const CARD_W = CR80_WIDTH_MM; // 54mm
  const CARD_H = CR80_HEIGHT_MM; // 85.6mm

  // Layout: 2 columns x 3 rows = 6 cards per A4 page
  const COLS = 2;
  const ROWS = 3;
  const CARDS_PER_PAGE = COLS * ROWS; // 6 cards

  // Compute margins to center grid perfectly on A4
  const GAP_X = 14; // mm between cols
  const GAP_Y = 6;  // mm between rows
  const TOTAL_GRID_W = COLS * CARD_W + (COLS - 1) * GAP_X; // 108 + 14 = 122mm
  const TOTAL_GRID_H = ROWS * CARD_H + (ROWS - 1) * GAP_Y; // 256.8 + 12 = 268.8mm
  const MARGIN_X = (A4_W - TOTAL_GRID_W) / 2; // ~44mm
  const MARGIN_Y = (A4_H - TOTAL_GRID_H) / 2; // ~14.1mm

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [A4_W, A4_H],
    compress: true,
  });

  // Prepare cards array based on mode
  interface CardSlot {
    imgData: string;
    label: string;
  }
  const allCards: CardSlot[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (onProgress) onProgress(i + 1, items.length);

    if (mode === 'both') {
      if (item.frontElement) {
        const fImg = await captureElementToImageData(item.frontElement);
        allCards.push({ imgData: fImg, label: `${item.employee.employeeCode} (Front)` });
      }
      if (item.backElement) {
        const bImg = await captureElementToImageData(item.backElement);
        allCards.push({ imgData: bImg, label: `${item.employee.employeeCode} (Back)` });
      }
    } else if (mode === 'front' && item.frontElement) {
      const fImg = await captureElementToImageData(item.frontElement);
      allCards.push({ imgData: fImg, label: `${item.employee.employeeCode} (Front)` });
    } else if (mode === 'back' && item.backElement) {
      const bImg = await captureElementToImageData(item.backElement);
      allCards.push({ imgData: bImg, label: `${item.employee.employeeCode} (Back)` });
    }
  }

  // Lay cards onto A4 pages
  for (let idx = 0; idx < allCards.length; idx++) {
    const pageIndex = Math.floor(idx / CARDS_PER_PAGE);
    const slotOnPage = idx % CARDS_PER_PAGE;

    if (pageIndex > 0 && slotOnPage === 0) {
      pdf.addPage([A4_W, A4_H], 'portrait');
    }

    const col = slotOnPage % COLS;
    const row = Math.floor(slotOnPage / COLS);

    const x = MARGIN_X + col * (CARD_W + GAP_X);
    const y = MARGIN_Y + row * (CARD_H + GAP_Y);

    const card = allCards[idx];
    pdf.addImage(card.imgData, 'PNG', x, y, CARD_W, CARD_H, undefined, 'FAST');
  }

  const filename = `HomeRecipeFoods_ID_Cards_A4_Sheet_${items.length}_Employees.pdf`;
  pdf.save(filename);
}

/**
 * Injects dynamic CSS @page and layout overrides for in-browser printing.
 * Guarantees zero margins, exact dimensions, and hides all non-card UI elements.
 */
export function injectIdCardPrintStyles(format: 'cr80' | 'a4'): void {
  // Remove any previously injected print styles
  const existing = document.getElementById('id-card-print-styles-override');
  if (existing) existing.remove();

  const styleEl = document.createElement('style');
  styleEl.id = 'id-card-print-styles-override';

  if (format === 'cr80') {
    styleEl.innerHTML = `
      @page {
        size: 54mm 85.6mm portrait !important;
        margin: 0mm !important;
      }
      @media print {
        html, body {
          width: 54mm !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        /* Hide all application chrome, navbar, sidebar, dashboard, buttons */
        body > *:not(#id-card-print-portal),
        #root > *:not(#id-card-print-portal),
        header, nav, aside, footer, .no-print {
          display: none !important;
        }
        #id-card-print-portal {
          display: block !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 54mm !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .id-card-page-cr80 {
          width: 54mm !important;
          height: 85.6mm !important;
          min-width: 54mm !important;
          min-height: 85.6mm !important;
          max-width: 54mm !important;
          max-height: 85.6mm !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          position: relative !important;
          break-after: page !important;
          page-break-after: always !important;
          box-shadow: none !important;
          border: none !important;
          outline: none !important;
        }
        .id-card-page-cr80:last-child {
          break-after: auto !important;
          page-break-after: auto !important;
        }
      }
    `;
  } else {
    // A4 Sheet Grid Layout (2 cols x 3 rows = 6 cards per A4 page)
    styleEl.innerHTML = `
      @page {
        size: A4 portrait !important;
        margin: 12mm 10mm !important;
      }
      @media print {
        html, body {
          width: 210mm !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body > *:not(#id-card-print-portal),
        #root > *:not(#id-card-print-portal),
        header, nav, aside, footer, .no-print {
          display: none !important;
        }
        #id-card-print-portal {
          display: block !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .id-card-sheet-a4 {
          width: 190mm !important;
          box-sizing: border-box !important;
          margin: 0 auto !important;
          padding: 0 !important;
          display: grid !important;
          grid-template-columns: 54mm 54mm !important;
          justify-content: center !important;
          align-content: start !important;
          gap: 6mm 14mm !important;
          break-after: page !important;
          page-break-after: always !important;
        }
        .id-card-sheet-a4:last-child {
          break-after: auto !important;
          page-break-after: auto !important;
        }
        .id-card-a4-slot {
          width: 54mm !important;
          height: 85.6mm !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          box-shadow: none !important;
          border: none !important;
        }
      }
    `;
  }

  document.head.appendChild(styleEl);
}

/**
 * Removes injected print override styles after print dialog closes.
 */
export function removeIdCardPrintStyles(): void {
  const existing = document.getElementById('id-card-print-styles-override');
  if (existing) existing.remove();
}
