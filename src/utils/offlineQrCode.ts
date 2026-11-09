import QRCode from 'qrcode';
import { IdCardEmployeeData } from '../components/IdCardPreview.tsx';
import { CloudIdCardSettings } from '../services/standaloneFirestoreEngine.ts';

export interface OfflineIdCardQrData {
  type: 'EMPLOYEE_ID_CARD';
  version: number;
  company: string;
  employee_name: string;
  employee_id: string;
  designation: string;
  department: string;
  blood_group: string;
  phone: string;
  employment_status: string;
  issue_date: string;
  expiry_date: string;
}

/**
 * Computes standard ISO dates YYYY-MM-DD for issue_date and expiry_date
 * alongside formatted DD/MM/YY strings for card display.
 */
export function calculateIdCardDates(
  joiningDate?: string,
  validityYears = 5
): {
  issueDateIso: string;
  expiryDateIso: string;
  issueDateFormatted: string;
  expireDateFormatted: string;
} {
  let year = new Date().getFullYear();
  let month = String(new Date().getMonth() + 1).padStart(2, '0');
  let day = String(new Date().getDate()).padStart(2, '0');

  if (joiningDate && typeof joiningDate === 'string' && joiningDate.includes('-')) {
    const parts = joiningDate.split('-');
    if (parts.length >= 3) {
      year = Number(parts[0]) || year;
      month = String(parts[1]).padStart(2, '0');
      day = String(parts[2]).padStart(2, '0');
    }
  }

  const issueDateIso = `${year}-${month}-${day}`;
  const shortYear = String(year).slice(-2);
  const issueDateFormatted = `${day}/${month}/${shortYear}`;

  const expYear = year + Number(validityYears || 5);
  const expiryDateIso = `${expYear}-${month}-${day}`;
  const expShortYear = String(expYear).slice(-2);
  const expireDateFormatted = `${day}/${month}/${expShortYear}`;

  return {
    issueDateIso,
    expiryDateIso,
    issueDateFormatted,
    expireDateFormatted,
  };
}

/**
 * Builds the strict, privacy-safe, structured offline QR payload.
 * Strictly avoids encoding sensitive personal data:
 * NO NID, NO Home Address, NO Salary, NO Bank Info, NO Passwords, NO Emergency Contacts.
 * Missing/unspecified employee fields are left as empty string per user instructions.
 */
export function buildOfflineIdCardData(
  employee: IdCardEmployeeData,
  settings?: CloudIdCardSettings | null
): OfflineIdCardQrData {
  const { issueDateIso, expiryDateIso } = calculateIdCardDates(
    employee.joiningDate,
    settings?.validityYears ?? 5
  );

  return {
    type: 'EMPLOYEE_ID_CARD',
    version: 1,
    company: (settings?.companyName || 'Home Recipe Foods').trim(),
    employee_name: (employee.fullName || '').trim(),
    employee_id: (employee.employeeCode || String(employee.id || '')).trim(),
    designation: (employee.designationName || '').trim(),
    department: (employee.departmentName || '').trim(),
    blood_group: (employee.bloodGroup || '').trim(),
    phone: (employee.mobile || '').trim(),
    employment_status: (employee.employmentStatus || 'Active').trim(),
    issue_date: issueDateIso,
    expiry_date: expiryDateIso,
  };
}

/**
 * Formats the offline payload as an indented JSON string.
 * This guarantees clear readability in standard phone camera QR scanners without requiring internet.
 */
export function formatOfflineQrPayloadJson(payload: OfflineIdCardQrData): string {
  return JSON.stringify(payload, null, 2);
}

/**
 * Generates high-resolution DataURL for the offline QR Code.
 * - Background: Pure White (#FFFFFF)
 * - Pattern: Dark Coffee Brown (#38251D)
 * - Margin / Quiet Zone: 2 (ample white quiet zone for error-free scanning)
 * - Width: 260px (crisp rendering, scannable even at small physical card size)
 * - 100% Client-side local JavaScript execution (no internet or server requests)
 */
export async function generateOfflineQrDataUrl(
  payload: OfflineIdCardQrData | string,
  options: {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  } = {}
): Promise<string> {
  const content = typeof payload === 'string' ? payload : formatOfflineQrPayloadJson(payload);

  return QRCode.toDataURL(content, {
    width: options.width || 260,
    margin: options.margin ?? 2,
    errorCorrectionLevel: options.errorCorrectionLevel || 'M',
    color: {
      dark: '#222222', // Deep Charcoal pattern with maximum contrast on pure white
      light: '#FFFFFF', // Pure White quiet zone & background
    },
  });
}

/**
 * Validates whether a scanned text is a valid Home Recipe Foods Offline ID Card payload.
 */
export function parseAndValidateOfflineQr(rawText: string): {
  isValid: boolean;
  data: OfflineIdCardQrData | null;
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawText.trim());
    if (parsed && typeof parsed === 'object' && parsed.type === 'EMPLOYEE_ID_CARD') {
      return {
        isValid: true,
        data: parsed as OfflineIdCardQrData,
      };
    }
    return {
      isValid: false,
      data: null,
      error: 'কিউআর কোডটিতে বৈধ এমপ্লয়ি আইডি ফরম্যাট পাওয়া যায়নি।',
    };
  } catch {
    return {
      isValid: false,
      data: null,
      error: 'কিউআর কোডের ডেটা সঠিক JSON ফরম্যাটে নেই।',
    };
  }
}
