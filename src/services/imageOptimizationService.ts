import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { storage, firestoreDb, auth } from '../lib/firebase.ts';
import {
  IMAGE_OPTIMIZATION_CONFIG,
  ImageCategory,
  formatImageSize,
} from '../config/imageOptimizationConfig.ts';

export interface OptimizationResult {
  blob: Blob;
  previewUrl: string;
  dataUrl?: string;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  width: number;
  height: number;
  fileType: string;
  fileName: string;
  category: ImageCategory;
}

export interface UploadResult extends OptimizationResult {
  downloadUrl: string;
  storagePath: string;
  isCloudStored?: boolean;
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  fileSizeText?: string;
}

/**
 * Validates file size and format against central configuration
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!file) {
    return { valid: false, error: 'কোনো ফাইল নির্বাচন করা হয়নি।' };
  }

  // 1. Max Upload Limit (20 MB)
  if (file.size > IMAGE_OPTIMIZATION_CONFIG.maxUploadBytes) {
    return {
      valid: false,
      error: `ছবির মূল সাইজ (${formatImageSize(
        file.size
      )}) নির্ধারিত সীমা ২০ মেগাবাইট (${IMAGE_OPTIMIZATION_CONFIG.maxUploadMb} MB)-এর বেশি। অনুগ্রহ করে ২০ MB এর নিচের ছবি নির্বাচন করুন।`,
      fileSizeText: formatImageSize(file.size),
    };
  }

  // 2. MIME type validation
  const isValidType =
    IMAGE_OPTIMIZATION_CONFIG.allowedMimeTypes.includes(file.type.toLowerCase()) ||
    file.type.startsWith('image/');

  if (!isValidType) {
    return {
      valid: false,
      error:
        'অসমর্থিত ফাইল ফরম্যাট! অনুগ্রহ করে শুধুমাত্র JPG, PNG, WebP, GIF বা AVIF ফরম্যাটের ছবি নির্বাচন করুন।',
      fileSizeText: formatImageSize(file.size),
    };
  }

  return { valid: true, fileSizeText: formatImageSize(file.size) };
}

/**
 * Checks if a canvas has transparent pixels
 */
function checkTransparency(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): boolean {
  try {
    const step = Math.max(1, Math.floor(Math.min(width, height) / 80));
    const imgData = ctx.getImageData(0, 0, width, height).data;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const index = (y * width + x) * 4;
        const alpha = imgData[index + 3];
        if (alpha < 250) {
          return true; // Found transparent or semi-transparent pixel
        }
      }
    }
  } catch {
    // If security restricts or getImageData fails, assume false
  }
  return false;
}

/**
 * Converts a Blob to a Base64 Data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('ছবির ডেটা রূপান্তর ব্যর্থ হয়েছে।'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Promise with timeout wrapper
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMsg)), timeoutMs);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
}

/**
 * Browser-side image optimization engine
 * - Respects aspect ratio
 * - Downscales large resolutions based on category profile
 * - Strips EXIF/metadata
 * - Converts to WebP or retains PNG transparency
 * - Yields execution to prevent UI freezing
 */
export async function optimizeImage(
  file: File,
  category: ImageCategory = 'GENERAL',
  onProgress?: (percent: number, statusText: string) => void
): Promise<OptimizationResult> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  onProgress?.(10, 'ফাইল রিড ও ডিকোড করা হচ্ছে...');

  // Yield to browser main thread
  await new Promise((resolve) => setTimeout(resolve, 15));

  const profile = IMAGE_OPTIMIZATION_CONFIG.profiles[category] || IMAGE_OPTIMIZATION_CONFIG.profiles.GENERAL;

  // Load image
  const img = new Image();
  const fileDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('ফাইলটি পড়তে ব্যর্থ হয়েছে।'));
    reader.readAsDataURL(file);
  });

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('ছবির ডেটা ডিকোড করা যায়নি।'));
    img.src = fileDataUrl;
  });

  onProgress?.(25, 'রেজোলিউশন ও অ্যাসপেক্ট রেশিও হিসাব করা হচ্ছে...');

  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;

  // Calculate target dimensions maintaining exact aspect ratio
  let targetWidth = srcWidth;
  let targetHeight = srcHeight;

  if (targetWidth > profile.maxWidth || targetHeight > profile.maxHeight) {
    const ratio = Math.min(
      profile.maxWidth / targetWidth,
      profile.maxHeight / targetHeight
    );
    targetWidth = Math.max(1, Math.round(targetWidth * ratio));
    targetHeight = Math.max(1, Math.round(targetHeight * ratio));
  }

  onProgress?.(45, 'হাই-কোয়ালিটি কম্প্রেশন সম্পাদন করা হচ্ছে...');
  await new Promise((resolve) => setTimeout(resolve, 15));

  // Create canvas for rendering and metadata stripping
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('ব্রাউজার ক্যানভাস ইনিশিয়ালাইজ করা যায়নি।');
  }

  // Smooth scaling configuration
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw image
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Check transparency if requested or for logo/signature
  const isTransparent = profile.preserveTransparency && checkTransparency(ctx, targetWidth, targetHeight);

  // Determine output format
  let outputFormat = profile.preferredFormat;
  if (isTransparent && outputFormat === 'image/jpeg') {
    outputFormat = 'image/webp';
  }

  onProgress?.(55, 'অপটিমাইজড ওয়েবপি/পিএনজি ব্লব তৈরি হচ্ছে...');

  // Convert canvas to Blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('ছবির ব্লব রূপান্তর ব্যর্থ হয়েছে।'));
      },
      outputFormat,
      profile.quality
    );
  });

  const originalSize = file.size;
  const compressedSize = blob.size;
  const savingsPercent = Math.max(
    0,
    Math.round(((originalSize - compressedSize) / originalSize) * 1000) / 10
  );

  const previewUrl = URL.createObjectURL(blob);
  const dataUrl = await blobToDataUrl(blob);

  return {
    blob,
    previewUrl,
    dataUrl,
    originalSize,
    compressedSize,
    savingsPercent,
    width: targetWidth,
    height: targetHeight,
    fileType: outputFormat,
    fileName: file.name,
    category,
  };
}

/**
 * Universal Global Upload Service with Firebase Storage & Resilient Fallback
 * - Enforces 20MB check
 * - Compresses on client to high-efficiency WebP/PNG
 * - Uploads to Firebase Storage with progress tracking
 * - Safe fallback to compact WebP DataURL if Storage bucket/CORS is unreachable
 * - Records metadata in Firestore (image_uploads)
 * - Safe old image cleanup
 */
export async function uploadOptimizedImage(params: {
  file: File;
  category: ImageCategory;
  storageFolder: string;
  customFileName?: string;
  oldStoragePath?: string;
  onProgress?: (percent: number, statusText: string) => void;
}): Promise<UploadResult> {
  const { file, category, storageFolder, customFileName, oldStoragePath, onProgress } = params;

  // 1. Optimize Image (0% - 55%)
  const optimized = await optimizeImage(file, category, (percent, text) => {
    const mapped = Math.round(percent * 0.55);
    onProgress?.(mapped, text);
  });

  onProgress?.(60, 'ক্লাউড স্টোরেজে সংযোগ তৈরি হচ্ছে...');

  // Ensure Firebase Auth session exists for storage rules
  try {
    if (!auth.currentUser) {
      await withTimeout(signInAnonymously(auth), 2500, 'Auth init timeout');
    }
  } catch {
    // Non-fatal if anonymous auth fails or isn't enabled
  }

  // 2. Prepare Storage Path
  const ext = optimized.fileType === 'image/png' ? 'png' : 'webp';
  const cleanStorageFolder = storageFolder.replace(/\/+$/, '').replace(/^\/+/, '');
  const safeBaseName = (customFileName || file.name)
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeBaseName}_${Date.now()}.${ext}`;
  const storagePath = `${cleanStorageFolder}/${fileName}`;

  let downloadUrl = '';
  let isCloudStored = false;

  // 3. Robust Cloud Upload with Smooth Progress Ticker & Timeout Guard
  try {
    const storageRef = ref(storage, storagePath);

    // Progress interval while upload is active (65% -> 85%)
    let currentPct = 65;
    const progressTimer = setInterval(() => {
      if (currentPct < 85) {
        currentPct += 4;
        onProgress?.(
          currentPct,
          `ক্লাউড স্টোরেজে ফাইল আপলোড হচ্ছে... (${Math.round((currentPct - 60) * 4)}%)`
        );
      }
    }, 180);

    try {
      // Direct uploadBytes with 7.5 second timeout
      await withTimeout(
        uploadBytes(storageRef, optimized.blob, {
          contentType: optimized.fileType,
          customMetadata: {
            originalName: file.name,
            category,
            originalSize: String(optimized.originalSize),
            compressedSize: String(optimized.compressedSize),
            savingsPercent: String(optimized.savingsPercent),
          },
        }),
        7500,
        'ক্লাউড স্টোরেজ আপলোড সময়সীমা অতিক্রম করেছে।'
      );

      clearInterval(progressTimer);
      onProgress?.(88, 'ডাউনলোড লিঙ্ক ও ইউআরএল তৈরি করা হচ্ছে...');

      // Retrieve permanent download URL with 4 second timeout
      downloadUrl = await withTimeout(
        getDownloadURL(storageRef),
        4000,
        'ডাউনলোড লিঙ্ক সংগ্রহ সময়সীমা অতিক্রম করেছে।'
      );
      isCloudStored = true;
    } catch (uploadErr) {
      clearInterval(progressTimer);
      throw uploadErr;
    }
  } catch (storageErr) {
    console.warn(
      'Firebase Storage direct upload notice; utilizing optimized asset fallback:',
      storageErr
    );

    // Resilient Fallback: If Firebase Storage has bucket CORS, quota, or network restrictions,
    // utilize the compact optimized WebP/PNG DataURL so user is NEVER blocked!
    onProgress?.(85, 'অপটিমাইজড ইমেজ ডেটা প্রস্তুত করা হচ্ছে...');
    downloadUrl = optimized.dataUrl || (await blobToDataUrl(optimized.blob));
    isCloudStored = false;
  }

  onProgress?.(92, 'মেটাডাটা রেজিস্ট্রি ও রেকর্ড সংরক্ষণ করা হচ্ছে...');

  // 4. Register metadata in Firestore image_uploads collection (non-blocking)
  try {
    const uploadLogId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const user = auth.currentUser;
    await withTimeout(
      setDoc(doc(firestoreDb, 'image_uploads', uploadLogId), {
        category,
        originalFileName: file.name.slice(0, 280),
        storagePath: isCloudStored ? storagePath : `embedded/${fileName}`,
        downloadUrl: downloadUrl.length > 500 ? downloadUrl.slice(0, 80) + '...[dataUrl]' : downloadUrl,
        fileType: optimized.fileType,
        originalSize: optimized.originalSize,
        compressedSize: optimized.compressedSize,
        savingsPercent: optimized.savingsPercent,
        width: optimized.width,
        height: optimized.height,
        isCloudStored,
        uploadedBy: user?.email || user?.uid || 'Admin',
        createdAt: serverTimestamp(),
      }),
      2500,
      'Metadata write timeout'
    );
  } catch {
    // Non-fatal: metadata write can silently skip if offline
  }

  // 5. Safe Replacement: Delete old image if it was in cloud storage
  if (oldStoragePath && oldStoragePath !== storagePath && oldStoragePath.startsWith(cleanStorageFolder)) {
    try {
      const oldRef = ref(storage, oldStoragePath);
      await deleteObject(oldRef);
    } catch {
      // Ignore if old object didn't exist
    }
  }

  onProgress?.(100, 'ছবি সফলভাবে অপটিমাইজ ও সংরক্ষণ সম্পন্ন হয়েছে!');

  return {
    ...optimized,
    downloadUrl,
    storagePath: isCloudStored ? storagePath : `embedded/${fileName}`,
    isCloudStored,
  };
}
