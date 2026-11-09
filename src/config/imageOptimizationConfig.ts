/**
 * GLOBAL AUTOMATIC IMAGE OPTIMIZATION CONFIGURATION
 * Home Recipe Foods HR & Payroll Management System
 */

export type ImageCategory =
  | 'COMPANY_LOGO'
  | 'EMPLOYEE_PROFILE'
  | 'ID_CARD_PHOTO'
  | 'DOCUMENTS'
  | 'PRODUCT_IMAGES'
  | 'SIGNATURE'
  | 'GENERAL';

export interface ImageOptimizationProfile {
  category: ImageCategory;
  nameBn: string;
  descriptionBn: string;
  maxWidth: number;
  maxHeight: number;
  quality: number; // 0.0 - 1.0 (85% - 92%)
  preferredFormat: 'image/webp' | 'image/png' | 'image/jpeg';
  preserveTransparency: boolean;
  minScaleFactor?: number;
}

export const IMAGE_OPTIMIZATION_CONFIG = {
  // 1. Central Maximum Upload Limit (20 MB)
  maxUploadBytes: 20 * 1024 * 1024, // 20 MB in bytes
  maxUploadMb: 20,

  // 2. Allowed Input MIME Types
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/svg+xml',
    'image/avif',
  ],

  // 3. Category-specific optimization profiles
  profiles: {
    COMPANY_LOGO: {
      category: 'COMPANY_LOGO',
      nameBn: 'কোম্পানি লোগো (Company Logo)',
      descriptionBn: 'স্বচ্ছতা (Transparency) ও হাই-প্রেসিশন ভেক্টর শার্পনেস অক্ষুণ্ণ রাখে',
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.92,
      preferredFormat: 'image/webp', // WebP supports lossless/lossy with alpha
      preserveTransparency: true,
    },
    EMPLOYEE_PROFILE: {
      category: 'EMPLOYEE_PROFILE',
      nameBn: 'কর্মচারী প্রোফাইল ছবি (Employee Profile Photo)',
      descriptionBn: 'উন্নত চেহারা, স্পষ্ট মুখাবয়ব ও স্বাভাবিক ত্বকের রং বজায় রাখে',
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.88,
      preferredFormat: 'image/webp',
      preserveTransparency: false,
    },
    ID_CARD_PHOTO: {
      category: 'ID_CARD_PHOTO',
      nameBn: 'আইডি কার্ড ফটো (ID Card Photo)',
      descriptionBn: 'প্রিন্ট-ফ্রেন্ডলি ক্রিস্প হাই-রেজোলিউশন (CR80 Standard Print)',
      maxWidth: 1000,
      maxHeight: 1200,
      quality: 0.90,
      preferredFormat: 'image/webp',
      preserveTransparency: false,
    },
    DOCUMENTS: {
      category: 'DOCUMENTS',
      nameBn: 'নথিপত্র ও সনদপত্র (Documents / Certificates)',
      descriptionBn: 'নথিপত্রের সূক্ষ্ম লেখা ও সিল স্পষ্টভাবে পাঠযোগ্য রাখে',
      maxWidth: 1800,
      maxHeight: 1800,
      quality: 0.90,
      preferredFormat: 'image/webp',
      preserveTransparency: false,
    },
    PRODUCT_IMAGES: {
      category: 'PRODUCT_IMAGES',
      nameBn: 'পণ্য ও খাদ্য সামগ্রীর ছবি (Product Images)',
      descriptionBn: 'খাদ্য দ্রব্যের উজ্জ্বল ও হাই কোয়ালিটি ওয়েবপি প্রেজেন্টেশন',
      maxWidth: 1400,
      maxHeight: 1400,
      quality: 0.88,
      preferredFormat: 'image/webp',
      preserveTransparency: true,
    },
    SIGNATURE: {
      category: 'SIGNATURE',
      nameBn: 'অনুমোদিত স্বাক্ষর (Authorized Signature)',
      descriptionBn: 'স্বচ্ছ ব্যাকগ্রাউন্ড ও কালো/নীল কালির নিখুঁত রেখা বজায় রাখে',
      maxWidth: 800,
      maxHeight: 400,
      quality: 0.92,
      preferredFormat: 'image/png', // PNG strictly ensures crisp transparent stroke
      preserveTransparency: true,
    },
    GENERAL: {
      category: 'GENERAL',
      nameBn: 'অন্যান্য ছবি (General Images)',
      descriptionBn: 'ভারসাম্যপূর্ণ অপটিমাইজেশন ও দ্রুত লোডিং',
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.85,
      preferredFormat: 'image/webp',
      preserveTransparency: true,
    },
  } as Record<ImageCategory, ImageOptimizationProfile>,
};

/**
 * Format raw byte size into human readable string (e.g. 8.5 MB, 450 KB)
 */
export function formatImageSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
