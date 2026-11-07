import React, { useEffect, useState, useMemo } from 'react';
import { Mail, Phone, MapPin, Globe } from 'lucide-react';
import { HomeRecipeLogo } from './HomeRecipeLogo.tsx';
import {
  CloudIdCardSettings,
  DEFAULT_ID_CARD_SETTINGS,
} from '../services/standaloneFirestoreEngine.ts';
import {
  buildOfflineIdCardData,
  generateOfflineQrDataUrl,
  calculateIdCardDates,
} from '../utils/offlineQrCode.ts';

export interface IdCardEmployeeData {
  id: number;
  employeeCode: string;
  fullName: string;
  photoUrl?: string;
  mobile: string;
  emergencyContact?: string;
  bloodGroup?: string;
  email?: string;
  departmentName?: string;
  designationName?: string;
  joiningDate?: string;
  currentAddress?: string;
  permanentAddress?: string;
  employmentStatus?: string;
}

interface IdCardPreviewProps {
  employee: IdCardEmployeeData;
  settings?: CloudIdCardSettings | null;
  side?: 'front' | 'back' | 'both';
  scale?: number;
  showShadow?: boolean;
  className?: string;
  containerId?: string;
  forPrintOrPdf?: boolean;
  printModeMm?: boolean;
}

export const IdCardPreview: React.FC<IdCardPreviewProps> = ({
  employee,
  settings,
  side = 'both',
  scale = 1,
  showShadow = true,
  className = '',
  containerId,
  forPrintOrPdf = false,
  printModeMm = false,
}) => {
  const currentSettings = settings || DEFAULT_ID_CARD_SETTINGS;
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Calculate Issue Date & Expire Date (DD/MM/YY format for card, YYYY-MM-DD for QR payload)
  const { issueDateFormatted, expireDateFormatted } = useMemo(() => {
    return calculateIdCardDates(employee.joiningDate, currentSettings.validityYears || 5);
  }, [employee.joiningDate, currentSettings.validityYears]);

  // Generate 100% Offline Structured JSON QR Code
  // Encodes employee identity data directly into the QR pattern.
  // NO URLs, NO external websites, NO internet or server requests required on scan.
  // Using Dark Coffee Brown (#38251D) pattern on Pure White (#FFFFFF) background with ample quiet zone.
  useEffect(() => {
    let active = true;

    const payload = buildOfflineIdCardData(employee, currentSettings);

    generateOfflineQrDataUrl(payload, {
      width: 260,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setQrCodeDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate offline QR Code:', err);
      });

    return () => {
      active = false;
    };
  }, [
    employee.fullName,
    employee.employeeCode,
    employee.id,
    employee.designationName,
    employee.departmentName,
    employee.bloodGroup,
    employee.mobile,
    employee.employmentStatus,
    employee.joiningDate,
    currentSettings.validityYears,
    currentSettings.companyName,
  ]);

  // Name splitting: First word/MD in Coffee Bronze #8B6348, remainder in Rich Dark Coffee #38251D
  const { namePrefix, nameRemainder } = useMemo(() => {
    const clean = (employee.fullName || 'কর্মচারী').trim();
    if (clean.toUpperCase().startsWith('MD ') || clean.toUpperCase().startsWith('MD. ')) {
      return {
        namePrefix: clean.slice(0, 3).toUpperCase(),
        nameRemainder: clean.slice(3).trim().toUpperCase(),
      };
    }
    const parts = clean.split(' ');
    if (parts.length > 1) {
      return {
        namePrefix: parts[0].toUpperCase(),
        nameRemainder: parts.slice(1).join(' ').toUpperCase(),
      };
    }
    return {
      namePrefix: clean.toUpperCase(),
      nameRemainder: '',
    };
  }, [employee.fullName]);

  // Standard CR80 Card Dimensions: 54mm x 85.6mm (Ratio ~ 0.63:1)
  // Scaled for crisp display: 320px x 508px
  const baseWidth = 320;
  const baseHeight = 508;

  const cardStyle: React.CSSProperties = {
    width: printModeMm ? '54mm' : `${baseWidth}px`,
    height: printModeMm ? '85.6mm' : `${baseHeight}px`,
    minWidth: printModeMm ? '54mm' : `${baseWidth}px`,
    minHeight: printModeMm ? '85.6mm' : `${baseHeight}px`,
    maxWidth: printModeMm ? '54mm' : undefined,
    maxHeight: printModeMm ? '85.6mm' : undefined,
    boxSizing: 'border-box',
    transform: !printModeMm && scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: 'top left',
    boxShadow: forPrintOrPdf ? 'none' : undefined,
    border: 'none',
    outline: 'none',
  };

  const cardContainerClass = `relative overflow-hidden bg-[#FFF9EF] select-none text-[#38251D] ${
    printModeMm ? 'rounded-[3.18mm]' : 'rounded-[14px]'
  } flex flex-col justify-between font-sans ${
    !forPrintOrPdf && showShadow
      ? 'shadow-2xl ring-1 ring-[#38251D]/25'
      : 'shadow-none ring-0 border-0 outline-none'
  }`;

  // =========================================================================
  // FRONT SIDE — Premium Luxury Dark Coffee Edition
  // (#38251D, #493025, #624331, #8B6348, #D6B477, #F3E8D6, #FFF9EF)
  // =========================================================================
  const renderFrontSide = () => (
    <div
      id={containerId ? `${containerId}-front` : undefined}
      style={cardStyle}
      className={cardContainerClass}
    >
      {/* Background Artwork: Multi-tone Dark Coffee Gradient, Layered Shapes, Gold Hairlines & Embossed Motifs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <svg viewBox="0 0 320 508" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            {/* Header Multi-tone Dark Coffee Gradient */}
            <linearGradient id="frontDarkCoffeeGrad" x1="0" y1="0" x2="320" y2="145" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38251D" />
              <stop offset="40%" stopColor="#493025" />
              <stop offset="75%" stopColor="#624331" />
              <stop offset="100%" stopColor="#38251D" />
            </linearGradient>

            {/* Bronze to Gold Metallic Accent Gradient */}
            <linearGradient id="frontBronzeGoldGrad" x1="0" y1="0" x2="320" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#8B6348" />
              <stop offset="35%" stopColor="#D6B477" />
              <stop offset="70%" stopColor="#A07354" />
              <stop offset="100%" stopColor="#8B6348" />
            </linearGradient>

            {/* Bottom Coffee Ribbon Gradient */}
            <linearGradient id="frontBottomCoffeeGrad" x1="0" y1="470" x2="320" y2="508" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38251D" />
              <stop offset="50%" stopColor="#493025" />
              <stop offset="100%" stopColor="#38251D" />
            </linearGradient>

            {/* Subtle Embossed Geometric Grid Motif */}
            <pattern id="luxeEmbossedGrid" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="11" cy="11" r="0.75" fill="#8B6348" fillOpacity="0.14" />
              <path d="M0 11 L22 11 M11 0 L11 22" stroke="#8B6348" strokeWidth="0.5" strokeOpacity="0.08" />
              <path d="M0 0 L22 22 M22 0 L0 22" stroke="#D6B477" strokeWidth="0.35" strokeOpacity="0.07" strokeDasharray="1 3" />
            </pattern>
          </defs>

          {/* Full Card Subtle Embossed Background Texture */}
          <rect x="0" y="0" width="320" height="508" fill="url(#luxeEmbossedGrid)" />

          {/* Top Header Background Wave Shape in Rich Dark Coffee */}
          <path d="M0 0 L320 0 L320 122 C240 144, 120 114, 0 136 Z" fill="url(#frontDarkCoffeeGrad)" />

          {/* Layer 1: Dark Mocha (#624331) Intermediate Band */}
          <path d="M0 131 C120 111, 240 141, 320 119 L320 127 C240 147, 120 119, 0 137 Z" fill="#624331" fillOpacity="0.95" />

          {/* Layer 2: Coffee Bronze (#8B6348) Wave Band */}
          <path d="M0 135 C120 115, 240 143, 320 123 L320 133 C240 151, 120 125, 0 143 Z" fill="#8B6348" fillOpacity="0.9" />

          {/* Layer 3: Warm Cream (#F3E8D6) Wave Band */}
          <path d="M0 138 C120 118, 240 145, 320 126 L320 138 C240 154, 120 128, 0 146 Z" fill="#F3E8D6" />

          {/* Layer 4: Champagne Gold (#D6B477) Sharp Accent Wave Line */}
          <path d="M0 140 C120 119, 240 146, 320 128" stroke="#D6B477" strokeWidth="2.4" strokeLinecap="round" />

          {/* Mid-body Smooth Abstract Depth Curves in Warm Cream & Bronze */}
          <path d="M-20 225 C60 195, 80 295, 160 265 C240 235, 280 315, 340 285 L340 345 C280 365, 230 305, 150 325 C70 345, 40 265, -20 285 Z" fill="#F3E8D6" fillOpacity="0.6" />
          <path d="M-10 245 C90 205, 180 325, 330 265" stroke="#D6B477" strokeWidth="0.8" strokeDasharray="4 4" strokeOpacity="0.4" />

          {/* Bottom Layered Coffee Shapes in Warm Cream, Coffee Bronze & Rich Dark Coffee */}
          <path d="M0 482 C90 468, 210 496, 320 476 L320 508 L0 508 Z" fill="#F3E8D6" />
          <path d="M0 490 C100 476, 220 500, 320 484 L320 508 L0 508 Z" fill="#8B6348" />
          <path d="M0 495 C110 483, 230 503, 320 491 L320 508 L0 508 Z" fill="url(#frontBottomCoffeeGrad)" />
          <path d="M0 495 C110 483, 230 503, 320 491" stroke="#D6B477" strokeWidth="2" />
        </svg>
      </div>

      {/* 1. Header: Rich Dark Coffee Header with Home Recipe Foods Logo */}
      <div className="relative w-full pt-3 pb-9 px-4 flex flex-col items-center z-10">
        {/* Decorative Golden Hairlines in Header Corners */}
        <div className="absolute top-0 right-0 w-28 h-28 overflow-hidden pointer-events-none opacity-30">
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
            <line x1="0" y1="100" x2="100" y2="0" stroke="#D6B477" strokeWidth="1" />
            <line x1="20" y1="100" x2="100" y2="20" stroke="#D6B477" strokeWidth="1.5" />
            <line x1="40" y1="100" x2="100" y2="40" stroke="#F3E8D6" strokeWidth="0.8" />
            <circle cx="85" cy="15" r="2.5" fill="#D6B477" />
          </svg>
        </div>
        <div className="absolute top-0 left-0 w-24 h-24 overflow-hidden pointer-events-none opacity-20">
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
            <line x1="100" y1="100" x2="0" y2="0" stroke="#D6B477" strokeWidth="1" />
            <line x1="80" y1="100" x2="0" y2="20" stroke="#F3E8D6" strokeWidth="1" />
          </svg>
        </div>

        {/* Company Logo at Top Header (Original Ratio & Color Preserved) */}
        <div className="z-20">
          <HomeRecipeLogo
            size="md"
            customLogoUrl={currentSettings.companyLogo}
            variant="light"
          />
        </div>
      </div>

      {/* 2. Large Circular Employee Photo Frame with Champagne Gold Double Border */}
      <div className="relative -mt-10 z-20 flex justify-center">
        {/* Outer Metallic Ring: Champagne Gold (#D6B477) + Coffee Bronze (#8B6348) */}
        <div className="w-[104px] h-[104px] rounded-full p-[2.5px] bg-gradient-to-tr from-[#D6B477] via-[#8B6348] to-[#D6B477] shadow-[0_6px_20px_rgba(56,37,29,0.35)] flex items-center justify-center">
          {/* Inner Ring: Crisp Ivory (#FFF9EF) */}
          <div className="w-full h-full rounded-full p-[2px] bg-[#FFF9EF]">
            {employee.photoUrl ? (
              <img
                src={employee.photoUrl}
                alt={employee.fullName}
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-full object-cover object-top block"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-[#F3E8D6] flex items-center justify-center text-[#38251D] font-black text-2xl">
                {employee.fullName ? employee.fullName.charAt(0).toUpperCase() : 'HR'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Employee Name & Designation — Premium Ivory Text Panel with Gold Accent Hairlines */}
      <div className="relative z-20 mx-4 mt-1 px-3 py-2 bg-[#FFF9EF] rounded-xl border border-[#D6B477]/50 shadow-xs text-center">
        {/* Employee Name */}
        <h2 className="text-[17px] font-black tracking-tight leading-tight uppercase font-sans">
          <span className="text-[#8B6348] mr-1.5">{namePrefix}</span>
          <span className="text-[#38251D]">{nameRemainder}</span>
        </h2>

        {/* Designation with Champagne Gold Accents & Diamond Ornament */}
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          <span className="w-4 h-[1px] bg-[#D6B477]" />
          <span className="text-[9.5px] font-bold tracking-widest text-[#8B6348] uppercase">
            {employee.designationName || 'Chief Technology Officer'}
          </span>
          <span className="w-4 h-[1px] bg-[#D6B477]" />
        </div>
      </div>

      {/* 4. Information Section — Warm Cream & Ivory with Rich Dark Coffee Text */}
      <div className="relative z-20 flex-1 px-4 pt-1.5 pb-2 flex flex-col justify-between">
        {/* Employee ID Highlighted in Luxury Coffee Bronze & Champagne Gold Badge */}
        <div className="bg-gradient-to-r from-[#8B6348] via-[#A07354] to-[#493025] text-white px-3 py-1.5 rounded-lg flex items-center justify-between border border-[#D6B477] shadow-xs">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#F3E8D6]">
            Employee ID No.
          </span>
          <span className="font-mono-num font-black text-[13px] tracking-widest text-[#FFF9EF]">
            {employee.employeeCode || '20251'}
          </span>
        </div>

        {/* Employee Details Grid with High-Contrast Rich Dark Coffee Text */}
        <div className="mt-1 text-[10.5px] font-medium space-y-1 text-[#38251D] w-full px-0.5">
          {/* Blood Group */}
          <div className="grid grid-cols-[72px_12px_1fr] items-baseline pb-1 border-b border-[#F3E8D6]">
            <span className="font-bold text-[#38251D] text-left">Blood Group</span>
            <span className="font-bold text-[#D6B477] text-center">:</span>
            <div className="text-right">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#FFF9EF] border border-[#8B6348] text-[#8B6348] shadow-2xs">
                {employee.bloodGroup || 'A+'}
              </span>
            </div>
          </div>

          {/* Phone */}
          <div className="grid grid-cols-[72px_12px_1fr] items-baseline pb-1 border-b border-[#F3E8D6]">
            <span className="font-bold text-[#38251D] text-left">Phone</span>
            <span className="font-bold text-[#D6B477] text-center">:</span>
            <span className="font-mono-num font-bold text-[#38251D] text-right text-[10.5px]">
              {employee.mobile || '+880 1841-269089'}
            </span>
          </div>

          {/* Email */}
          <div className="grid grid-cols-[72px_12px_1fr] items-baseline pb-1 border-b border-[#F3E8D6]">
            <span className="font-bold text-[#38251D] text-left">Email</span>
            <span className="font-bold text-[#D6B477] text-center">:</span>
            <span className="font-semibold text-[#493025] text-right text-[10px] break-all">
              {employee.email || 'hridoy222@gmail.com'}
            </span>
          </div>

          {/* Address */}
          <div className="grid grid-cols-[72px_12px_1fr] items-start pb-0.5">
            <span className="font-bold text-[#38251D] text-left pt-0.5">Address</span>
            <span className="font-bold text-[#D6B477] text-center pt-0.5">:</span>
            <span className="text-[9px] leading-tight font-medium text-[#624331] text-right break-words line-clamp-2">
              {employee.currentAddress || 'Mahammad Pur, Senbag, Noakhali'}
            </span>
          </div>
        </div>

        {/* Bottom Accent Space */}
        <div className="h-2" />
      </div>
    </div>
  );

  // =========================================================================
  // BACK SIDE — Premium Luxury Dark Coffee Edition
  // (#38251D, #493025, #624331, #8B6348, #D6B477, #F3E8D6, #FFF9EF)
  // =========================================================================
  const renderBackSide = () => (
    <div
      id={containerId ? `${containerId}-back` : undefined}
      style={cardStyle}
      className={cardContainerClass}
    >
      {/* Background Artwork: Multi-tone Dark Coffee Curves, Geometric Patterns & Gold Accent Lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <svg viewBox="0 0 320 508" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <linearGradient id="backHeaderDarkCoffee" x1="0" y1="0" x2="320" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38251D" />
              <stop offset="50%" stopColor="#493025" />
              <stop offset="100%" stopColor="#38251D" />
            </linearGradient>
            <linearGradient id="backBottomDarkCoffee" x1="0" y1="320" x2="320" y2="508" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38251D" />
              <stop offset="45%" stopColor="#493025" />
              <stop offset="80%" stopColor="#624331" />
              <stop offset="100%" stopColor="#38251D" />
            </linearGradient>
          </defs>

          {/* Full Card Embossed Geometric Pattern */}
          <rect x="0" y="0" width="320" height="508" fill="url(#luxeEmbossedGrid)" opacity="0.8" />

          {/* Mid-body Soft Cream Organic Wave for Depth */}
          <path d="M-20 180 C80 150, 200 240, 340 190 L340 250 C220 290, 100 210, -20 240 Z" fill="#F3E8D6" fillOpacity="0.65" />
          <path d="M-10 190 C90 160, 210 250, 330 200" stroke="#D6B477" strokeWidth="0.8" strokeDasharray="3 3" strokeOpacity="0.4" />
        </svg>
      </div>

      {/* 1. Top Section: Rich Dark Coffee Header */}
      <div className="relative z-10 bg-gradient-to-r from-[#38251D] via-[#493025] to-[#38251D] px-4 py-2 border-b-2 border-[#D6B477] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#D6B477]" />
          <span className="text-[9.5px] font-black tracking-widest text-[#FFF9EF] uppercase">
            Terms & Conditions
          </span>
        </div>
        <div className="text-[8px] font-bold text-[#D6B477] uppercase tracking-wider">
          Home Recipe Foods
        </div>
      </div>

      {/* 2. Middle Section: Terms and Conditions in Ivory Panel with Dark Coffee Text */}
      <div className="relative z-10 px-3.5 pt-1.5 pb-1 space-y-1 text-left flex-1">
        {(currentSettings.termsAndConditions || []).slice(0, 5).map((term, index) => {
          const parts = term.split('।');
          const title = parts[0] ? `${parts[0]}।` : term;
          const desc = parts.slice(1).join('।').trim();

          return (
            <div key={index} className="flex items-start gap-1.5">
              {/* Rich Dark Coffee & Champagne Gold Number Marker */}
              <div className="shrink-0 mt-0.5 w-3.5 h-3.5 rounded-full bg-[#38251D] border border-[#D6B477] text-[7.5px] font-bold text-[#FFF9EF] flex items-center justify-center shadow-2xs">
                {index + 1}
              </div>
              <div className="text-[7.8px] leading-[10.5px] text-[#38251D] flex-1">
                <span className="font-bold text-[#38251D] mr-1">{title}</span>
                {desc && <span className="text-[#624331] font-normal">{desc}</span>}
              </div>
            </div>
          );
        })}

        {/* Issue Date, Expire Date & Company Logo Row on Warm Cream Background */}
        <div className="w-full mt-1.5 pt-1 border-t border-[#F3E8D6] flex items-center justify-between px-1">
          {/* Issue & Expire Date */}
          <div className="text-[8.5px] font-semibold text-[#38251D] space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#38251D]">Issue Date</span>
              <span className="font-mono-num font-bold text-[#8B6348]">
                : {issueDateFormatted}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#38251D]">Expire Date</span>
              <span className="font-mono-num font-bold text-[#8B6348]">
                : {expireDateFormatted}
              </span>
            </div>
          </div>

          {/* Company Logo on Back Side (Preserving Original Ratio & Transparency) */}
          <div className="scale-90 origin-right">
            <HomeRecipeLogo
              size="sm"
              customLogoUrl={currentSettings.companyLogo}
              variant="dark"
            />
          </div>
        </div>
      </div>

      {/* 3. Bottom Section: Rich Dark Coffee Multi-Tone Background (#38251D to #493025) - ZERO BLACK */}
      <div className="relative z-10 bg-gradient-to-br from-[#38251D] via-[#493025] to-[#38251D] text-white px-3.5 pt-2 pb-2.5 border-t-2 border-[#D6B477]">
        {/* Official Information Header Badge */}
        <div className="mb-1.5 flex items-center justify-between">
          <div className="inline-block border border-[#D6B477] rounded-full px-2.5 py-0.5 bg-[#38251D]/90">
            <span className="text-[8px] font-extrabold tracking-widest text-[#D6B477] uppercase">
              Official Information
            </span>
          </div>
          <div className="text-[7.5px] text-[#F3E8D6] font-medium tracking-wider">
            Cardholder Helpline
          </div>
        </div>

        {/* Two-Column Layout: Contacts on Left, QR Code & Signature on Right */}
        <div className="grid grid-cols-[1fr_88px] gap-2 items-center">
          {/* Company Contacts with Champagne Gold Icons */}
          <div className="space-y-1 text-[8px] sm:text-[8.5px]">
            {/* Email */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#D6B477] shrink-0">
                <Mail className="w-3 h-3" />
              </span>
              <span className="break-all text-[#FFF9EF] font-medium">
                {currentSettings.companyEmail || 'homerecipefoods.official@gmail.com'}
              </span>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#D6B477] shrink-0">
                <Phone className="w-3 h-3" />
              </span>
              <span className="font-mono-num font-semibold text-[#FFF9EF]">
                {currentSettings.companyPhone || '01743-890178'}
              </span>
            </div>

            {/* Facebook */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#D6B477] shrink-0">
                <Globe className="w-3 h-3" />
              </span>
              <span className="font-bold text-[#FFF9EF] truncate">
                {currentSettings.facebookPage || 'HOME RECIPE FOODS'}
              </span>
            </div>

            {/* Address */}
            <div className="flex items-start gap-1.5">
              <span className="text-[#D6B477] shrink-0 mt-0.5">
                <MapPin className="w-3 h-3" />
              </span>
              <span className="text-[7.5px] leading-snug text-[#F3E8D6]">
                {currentSettings.officeAddress ||
                  '15/149, Shah Garibullah H/S, Khulshi, Chittagong, Bangladesh'}
              </span>
            </div>
          </div>

          {/* Right Side: QR Code + Authorized Signature with Dedicated Clean Ivory Panels */}
          <div className="flex flex-col items-center justify-center">
            {/* Authorized Signature Block with Dedicated Clean Ivory Panel */}
            {currentSettings.signatureVisibility && (
              <div className="mb-1 text-center w-full">
                <div className="bg-[#FFF9EF] rounded-md px-1.5 py-0.5 border border-[#D6B477] shadow-2xs inline-block w-full">
                  {currentSettings.authorizedSignatureUrl ? (
                    <img
                      src={currentSettings.authorizedSignatureUrl}
                      alt="Authorized Signature"
                      referrerPolicy="no-referrer"
                      className="h-4.5 mx-auto object-contain"
                    />
                  ) : (
                    <div className="font-serif italic text-[9.5px] text-[#38251D] tracking-wider leading-none">
                      {currentSettings.authorizedPersonName || 'M. Hasan'}
                    </div>
                  )}
                </div>
                <div className="text-[6px] text-[#F3E8D6] font-medium scale-90 mt-0.5">
                  কর্তৃপক্ষের স্বাক্ষর
                </div>
              </div>
            )}

            {/* Dedicated Pure White Square Area for 100% Offline QR Code */}
            <div className="p-1.5 bg-white rounded-lg shadow-xs border border-[#D6B477] flex flex-col items-center justify-center">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Employee Offline Identity QR Code"
                  className="w-[58px] h-[58px] block object-contain"
                />
              ) : (
                <div className="w-[58px] h-[58px] bg-white flex items-center justify-center text-[7.5px] text-[#38251D] font-mono">
                  Offline QR
                </div>
              )}
            </div>
            <div className="text-[5.5px] text-[#D6B477] font-semibold tracking-wider mt-0.5 uppercase">
              Offline QR Data
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (side === 'front') {
    return <div className={`inline-block ${className}`}>{renderFrontSide()}</div>;
  }

  if (side === 'back') {
    return <div className={`inline-block ${className}`}>{renderBackSide()}</div>;
  }

  return (
    <div className={`flex flex-wrap items-center justify-center gap-6 ${className}`}>
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          সামনের অংশ (Front Side)
        </span>
        {renderFrontSide()}
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          পিছনের অংশ (Back Side)
        </span>
        {renderBackSide()}
      </div>
    </div>
  );
};
