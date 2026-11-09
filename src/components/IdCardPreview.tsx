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
  // Using Deep Charcoal pattern on Pure White background with ample quiet zone.
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

  // Name formatting
  const formattedName = useMemo(() => {
    return (employee.fullName || 'Employee Name').trim();
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

  const cardContainerClass = `relative overflow-hidden bg-gradient-to-b from-[#FFFFFF] via-[#FAFBFA] to-[#F2F4F3] select-none text-[#222222] ${
    printModeMm ? 'rounded-[3.18mm]' : 'rounded-[14px]'
  } flex flex-col justify-between font-sans ${
    !forPrintOrPdf && showShadow
      ? 'shadow-2xl ring-1 ring-black/10'
      : 'shadow-none ring-0 border-0 outline-none'
  }`;

  // =========================================================================
  // FRONT SIDE — Modern & Professional Business Vector Style
  // Top: Dark Charcoal Grey Header (#464646) with Vibrant Orange Polygon (#F3841D) & Wave Crest
  // Mid: Pure White (#FFFFFF) with Centered Circular Photo, Name, Designation & Aligned Details
  // Bottom: Dark Charcoal Wave (#464646) with Vibrant Orange Accent Ribbon (#F3841D)
  // =========================================================================
  const renderFrontSide = () => (
    <div
      id={containerId ? `${containerId}-front` : undefined}
      style={cardStyle}
      className={cardContainerClass}
    >
      {/* Luxury PVC Card Corner Sheen */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-white/12 via-white/5 to-transparent pointer-events-none z-30" />

      {/* Background SVG Artwork: Header Charcoal + Orange Triangle, Wave Divider & Bottom Wave */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <svg viewBox="0 0 320 508" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <linearGradient id="charcoalGrad" x1="0" y1="0" x2="320" y2="200" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4A4A4A" />
              <stop offset="100%" stopColor="#3C3C3C" />
            </linearGradient>

            <linearGradient id="orangeAccentGrad" x1="85" y1="0" x2="320" y2="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FB923C" />
              <stop offset="60%" stopColor="#F3841D" />
              <stop offset="100%" stopColor="#EA7611" />
            </linearGradient>

            <linearGradient id="bottomCharcoalGrad" x1="0" y1="460" x2="320" y2="508" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#464646" />
              <stop offset="100%" stopColor="#383838" />
            </linearGradient>

            {/* Premium Satin Pearl Tone for White Body */}
            <linearGradient id="frontBodyToneGrad" x1="160" y1="120" x2="160" y2="470" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
              <stop offset="40%" stopColor="#FAFBFB" stopOpacity="0.94" />
              <stop offset="80%" stopColor="#F5F7F6" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#EFF2F0" stopOpacity="0.97" />
            </linearGradient>

            {/* Premium Micro-Guilloche Dual-Tone Security Mesh for White Body */}
            <pattern id="frontPremiumMesh" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M0 10 Q5 0 10 10 T20 10" fill="none" stroke="#F3841D" strokeWidth="0.35" strokeOpacity="0.05" />
              <path d="M10 0 Q15 10 20 0 T30 0" fill="none" stroke="#464646" strokeWidth="0.25" strokeOpacity="0.035" />
              <circle cx="10" cy="10" r="1.2" fill="#F3841D" fillOpacity="0.04" />
            </pattern>
            <radialGradient id="frontSecurityGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F3841D" stopOpacity="0.045" />
              <stop offset="60%" stopColor="#F3841D" stopOpacity="0.015" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Base Satin Tone & Security Mesh rendered FIRST (behind wave paths) */}
          <rect x="0" y="0" width="320" height="508" fill="url(#frontBodyToneGrad)" />
          <rect x="0" y="0" width="320" height="508" fill="url(#frontPremiumMesh)" />
          <circle cx="160" cy="320" r="115" fill="url(#frontSecurityGlow)" />
          <circle cx="160" cy="320" r="75" fill="none" stroke="#F3841D" strokeWidth="0.4" strokeDasharray="3 3" strokeOpacity="0.07" />
          <circle cx="160" cy="320" r="50" fill="none" stroke="#464646" strokeWidth="0.3" strokeOpacity="0.05" />

          {/* 1. Base Dark Charcoal Header Shape — Dynamic undulating wave */}
          <path
            d="M0 0 L320 0 L320 185 C240 225, 175 195, 120 170 C65 145, 25 160, 0 185 Z"
            fill="url(#charcoalGrad)"
          />

          {/* 2. Top-Right Orange Diagonal Wave Shape — Vibrant orange wave swoop */}
          <path
            d="M90 0 L320 0 L320 185 C250 220, 190 190, 145 148 L90 0 Z"
            fill="url(#orangeAccentGrad)"
          />

          {/* 3. Orange Dividing Wave Ribbon beneath Header */}
          <path
            d="M0 185 C25 160, 65 145, 120 170 C175 195, 240 225, 320 185"
            stroke="#F3841D"
            strokeWidth="4.5"
            strokeLinecap="round"
          />

          {/* 4. Bottom Dark Charcoal Wave Shape */}
          <path
            d="M0 465 C85 435, 200 495, 320 460 L320 508 L0 508 Z"
            fill="url(#bottomCharcoalGrad)"
          />

          {/* 5. Bottom Orange Accent Wave Ribbon */}
          <path
            d="M0 465 C85 435, 200 495, 320 460"
            stroke="#F3841D"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Top Header: Company Logo Centered & Significantly Larger on Dark Charcoal */}
      <div className="relative z-10 w-full pt-3 px-3 flex flex-col items-center justify-center text-center">
        <HomeRecipeLogo
          size="2xl"
          customLogoUrl={currentSettings.companyLogo}
          variant="light"
          className="mx-auto"
        />
      </div>

      {/* Circular Employee Photo: Enlarged (114px) and Moved Further DOWNWARD (mt-6) */}
      <div className="relative z-20 flex justify-center mt-6">
        <div className="p-[3.5px] rounded-full bg-gradient-to-tr from-[#EA7611] via-[#F3841D] to-[#FDBA74] shadow-[0_14px_32px_rgba(0,0,0,0.24)] flex items-center justify-center">
          <div className="p-[3.5px] rounded-full bg-white flex items-center justify-center">
            <div className="w-[114px] h-[114px] rounded-full overflow-hidden bg-slate-100 flex items-center justify-center ring-1 ring-black/5">
              {employee.photoUrl ? (
                <img
                  src={employee.photoUrl}
                  alt={employee.fullName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full rounded-full object-cover object-top block"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-slate-200 flex items-center justify-center text-[#464646] font-black text-3xl">
                  {employee.fullName ? employee.fullName.charAt(0).toUpperCase() : 'HR'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mid-Body: Name & Job Position — 100% Inside Pure White Section */}
      <div className="relative z-10 text-center px-4 mt-2">
        <h2 className="text-[17px] font-black tracking-tight text-[#0F172A] uppercase leading-tight font-sans">
          {formattedName}
        </h2>
        <p className="text-[10px] font-extrabold text-[#EA7611] uppercase tracking-[0.18em] mt-0.5">
          {employee.designationName || 'Job Position'}
        </p>
        <div className="w-12 h-[2px] bg-gradient-to-r from-transparent via-[#F3841D] to-transparent mx-auto mt-1" />
      </div>

      {/* Employee Details List (ID, Blood Group, Phone, Email, Address) — 100% Inside Pure White Section */}
      <div className="relative z-10 px-5 mt-2 flex-1 flex flex-col justify-start">
        <div className="space-y-1.5 text-[10px] font-medium text-[#1E293B] w-full bg-white/70 backdrop-blur-xs rounded-xl p-2.5 border border-slate-100 shadow-2xs">
          {/* ID Row */}
          <div className="grid grid-cols-[68px_10px_1fr] items-center">
            <span className="font-bold text-slate-600 text-[10.5px]">ID</span>
            <span className="font-bold text-[#F3841D]">:</span>
            <div>
              <span className="font-mono-num font-black text-[#0F172A] tracking-wider text-[11px] bg-slate-100 border border-slate-200/90 px-2 py-0.5 rounded shadow-2xs inline-block">
                {employee.employeeCode || 'HRF-1001'}
              </span>
            </div>
          </div>

          {/* Blood Group Row */}
          <div className="grid grid-cols-[68px_10px_1fr] items-center">
            <span className="font-bold text-slate-600 text-[10.5px]">Blood Group</span>
            <span className="font-bold text-[#F3841D]">:</span>
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-black bg-gradient-to-r from-orange-100 to-amber-100 text-[#C25E09] border border-[#F3841D]/50 shadow-2xs">
                {employee.bloodGroup || 'A+'}
              </span>
            </div>
          </div>

          {/* Phone Row */}
          <div className="grid grid-cols-[68px_10px_1fr] items-center">
            <span className="font-bold text-slate-600 text-[10.5px]">Phone</span>
            <span className="font-bold text-[#F3841D]">:</span>
            <span className="font-mono-num font-bold text-[#0F172A]">
              {employee.mobile || '01850999178'}
            </span>
          </div>

          {/* Email Row */}
          <div className="grid grid-cols-[68px_10px_1fr] items-center">
            <span className="font-bold text-slate-600 text-[10.5px]">Email</span>
            <span className="font-bold text-[#F3841D]">:</span>
            <span className="font-medium text-slate-700 truncate text-[9.5px]">
              {employee.email || 'homerecipefoods.official@gmail.com'}
            </span>
          </div>

          {/* Address Row */}
          <div className="grid grid-cols-[68px_10px_1fr] items-start">
            <span className="font-bold text-slate-600 text-[10.5px] pt-0.5">Address</span>
            <span className="font-bold text-[#F3841D] pt-0.5">:</span>
            <span className="text-[9px] leading-tight font-medium text-slate-700 line-clamp-2 break-words">
              {employee.currentAddress || '15/149, Shah Garibullah H/S, Khulshi, Chittagong'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Spacer for Wave Margin */}
      <div className="relative z-10 h-7" />
    </div>
  );

  // =========================================================================
  // BACK SIDE — Modern & Professional Business Vector Style
  // Top: Dark Charcoal Header (#464646) with Elegant Wave & Vibrant Orange Accent Crest
  // Mid: Pure White (#FFFFFF) with "Terms & Conditions" Orange Dots, Joined/Expiry Dates, Contacts, QR & Signature
  // Bottom: Dark Charcoal Wave (#464646) with Vibrant Orange Accent Ribbon (#F3841D)
  // =========================================================================
  const renderBackSide = () => (
    <div
      id={containerId ? `${containerId}-back` : undefined}
      style={cardStyle}
      className={cardContainerClass}
    >
      {/* Luxury PVC Card Corner Sheen */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-white/12 via-white/5 to-transparent pointer-events-none z-30" />

      {/* Background SVG Artwork: Header Charcoal Wave with Orange Accent & Bottom Wave */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <svg viewBox="0 0 320 508" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <linearGradient id="backCharcoalGrad" x1="0" y1="0" x2="320" y2="90" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4A4A4A" />
              <stop offset="100%" stopColor="#3C3C3C" />
            </linearGradient>

            <linearGradient id="backBottomCharcoalGrad" x1="0" y1="460" x2="320" y2="508" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#464646" />
              <stop offset="100%" stopColor="#383838" />
            </linearGradient>

            {/* Premium Satin Pearl Tone for Back White Body */}
            <linearGradient id="backBodyToneGrad" x1="160" y1="90" x2="160" y2="470" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
              <stop offset="40%" stopColor="#FAFBFB" stopOpacity="0.94" />
              <stop offset="80%" stopColor="#F5F7F6" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#EFF2F0" stopOpacity="0.97" />
            </linearGradient>

            {/* Premium Micro-Guilloche Dual-Tone Security Mesh for Back White Body */}
            <pattern id="backPremiumMesh" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M0 10 Q5 0 10 10 T20 10" fill="none" stroke="#F3841D" strokeWidth="0.35" strokeOpacity="0.05" />
              <path d="M10 0 Q15 10 20 0 T30 0" fill="none" stroke="#464646" strokeWidth="0.25" strokeOpacity="0.035" />
              <circle cx="10" cy="10" r="1.2" fill="#F3841D" fillOpacity="0.04" />
            </pattern>
            <radialGradient id="backSecurityGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F3841D" stopOpacity="0.045" />
              <stop offset="60%" stopColor="#F3841D" stopOpacity="0.015" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Base Satin Tone & Security Mesh rendered FIRST (behind wave paths) */}
          <rect x="0" y="0" width="320" height="508" fill="url(#backBodyToneGrad)" />
          <rect x="0" y="0" width="320" height="508" fill="url(#backPremiumMesh)" />
          <circle cx="160" cy="280" r="110" fill="url(#backSecurityGlow)" />
          <circle cx="160" cy="280" r="68" fill="none" stroke="#F3841D" strokeWidth="0.4" strokeDasharray="3 3" strokeOpacity="0.07" />
          <circle cx="160" cy="280" r="45" fill="none" stroke="#464646" strokeWidth="0.3" strokeOpacity="0.05" />

          {/* 1. Top Charcoal Header Wave — Raised contour so all text sits 100% in pure white */}
          <path
            d="M0 0 L320 0 L320 74 C215 58, 115 96, 0 75 Z"
            fill="url(#backCharcoalGrad)"
          />

          {/* 2. Top Orange Accent Wave Crest Line */}
          <path
            d="M0 75 C115 96, 215 58, 320 74"
            stroke="#F3841D"
            strokeWidth="4.5"
            strokeLinecap="round"
          />

          {/* 3. Bottom Dark Charcoal Wave Shape */}
          <path
            d="M0 465 C85 435, 200 495, 320 460 L320 508 L0 508 Z"
            fill="url(#backBottomCharcoalGrad)"
          />

          {/* 4. Bottom Orange Accent Wave Ribbon */}
          <path
            d="M0 465 C85 435, 200 495, 320 460"
            stroke="#F3841D"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Top Header: Centered Company Logo on Charcoal Background */}
      <div className="relative z-10 w-full pt-2 px-4 h-[76px] flex flex-col items-center justify-center text-center">
        <HomeRecipeLogo
          size="md"
          customLogoUrl={currentSettings.companyLogo}
          variant="light"
          className="mx-auto"
        />
        <div className="text-[7.2px] font-black text-slate-200 uppercase tracking-widest mt-0.5">
          {currentSettings.companyName || 'Home Recipe Foods'}
        </div>
      </div>

      {/* Middle Section: Terms & Conditions with Solid Orange Bullet Dots — 100% Inside Pure White */}
      <div className="relative z-10 px-5 pt-6 pb-1 flex-1 flex flex-col justify-start space-y-2">
        <h3 className="text-center font-black text-xs text-[#0F172A] tracking-wider uppercase mb-0.5">
          Terms & Conditions
        </h3>

        {/* Bulleted Terms matching the vector image's orange circular dots */}
        <div className="space-y-1.5 text-left">
          {(currentSettings.termsAndConditions || []).slice(0, 4).map((term, index) => {
            const parts = term.split('।');
            const title = parts[0] ? `${parts[0]}।` : term;
            const desc = parts.slice(1).join('।').trim();

            return (
              <div key={index} className="flex items-start gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F3841D] shrink-0 mt-0.5 shadow-2xs" />
                <div className="text-[7.8px] leading-[11px] text-slate-700 flex-1">
                  <span className="font-bold text-[#111827] mr-1">{title}</span>
                  {desc && <span className="text-slate-600 font-normal">{desc}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Joined Date & Expiry Date row matching the vector card layout */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[8.5px] font-semibold text-slate-700 px-1">
          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-800">Joined Date</span>
            <span className="font-bold text-[#F3841D]">:</span>
            <span className="font-mono-num font-bold text-[#111827]">{issueDateFormatted}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-800">Expiry Date</span>
            <span className="font-bold text-[#F3841D]">:</span>
            <span className="font-mono-num font-bold text-[#111827]">{expireDateFormatted}</span>
          </div>
        </div>

        {/* Contacts, Offline QR & Signature Section */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-[1fr_96px] gap-2 items-center">
          {/* Company Contacts with Orange Icons */}
          <div className="space-y-1 text-[7.8px] text-slate-700">
            <div className="flex items-center gap-1.5">
              <span className="text-[#F3841D] shrink-0">
                <Mail className="w-3 h-3" />
              </span>
              <span className="truncate">{currentSettings.companyEmail || 'homerecipefoods.official@gmail.com'}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[#F3841D] shrink-0">
                <Phone className="w-3 h-3" />
              </span>
              <span className="font-mono-num font-semibold">{currentSettings.companyPhone || '01743-890178'}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[#F3841D] shrink-0">
                <Globe className="w-3 h-3" />
              </span>
              <span className="truncate">{currentSettings.facebookPage || 'HOME RECIPE FOODS'}</span>
            </div>

            <div className="flex items-start gap-1.5">
              <span className="text-[#F3841D] shrink-0 mt-0.5">
                <MapPin className="w-3 h-3" />
              </span>
              <span className="text-[7.2px] leading-snug line-clamp-2">
                {currentSettings.officeAddress || '15/149, Shah Garibullah H/S, Khulshi, Chittagong'}
              </span>
            </div>
          </div>

          {/* Right Column: Signature & QR Code */}
          <div className="flex flex-col items-center justify-center">
            {/* Signature Block: Always renders Authorized Person's Name & Designation */}
            {currentSettings.signatureVisibility && (
              <div className="mb-1 text-center w-full">
                <div className="min-h-[22px] flex items-center justify-center px-1">
                  {currentSettings.authorizedSignatureUrl ? (
                    <img
                      src={currentSettings.authorizedSignatureUrl}
                      alt="Authorized Signature"
                      referrerPolicy="no-referrer"
                      className="max-h-6 max-w-[90px] object-contain block mx-auto"
                    />
                  ) : (
                    <div className="font-serif italic font-bold text-[9.5px] text-slate-800 leading-none">
                      {currentSettings.authorizedPersonName || 'মোঃ মাহমুদুল হাসান'}
                    </div>
                  )}
                </div>

                {/* Signature Underline */}
                <div className="w-full border-t border-slate-300 mt-0.5 mb-0.5" />

                {/* Authorized Person's Name */}
                <div className="text-[7.5px] font-black text-[#111827] leading-tight truncate">
                  {currentSettings.authorizedPersonName || 'মোঃ মাহমুদুল হাসান'}
                </div>

                {/* Authorized Person's Designation */}
                <div className="text-[6.5px] font-semibold text-slate-600 leading-tight truncate">
                  {currentSettings.authorizedPersonDesignation || 'Managing Director / Chairman'}
                </div>
              </div>
            )}

            {/* Dedicated Pure White Square for 100% Offline QR Code */}
            <div className="p-1 bg-white rounded-lg shadow-xs border-2 border-[#F3841D] flex items-center justify-center">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Employee Offline Identity QR Code"
                  className="w-[54px] h-[54px] block object-contain"
                />
              ) : (
                <div className="w-[54px] h-[54px] bg-white flex items-center justify-center text-[7px] text-[#222222] font-mono">
                  Offline QR
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Spacer for Wave Margin */}
      <div className="relative z-10 h-7" />
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
