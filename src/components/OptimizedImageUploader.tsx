import React, { useState, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  ImageCategory,
  IMAGE_OPTIMIZATION_CONFIG,
  formatImageSize,
} from '../config/imageOptimizationConfig.ts';
import {
  uploadOptimizedImage,
  validateImageFile,
  UploadResult,
} from '../services/imageOptimizationService.ts';
import { ImageOptimizationFeedback } from './ImageOptimizationFeedback.tsx';

export interface OptimizedImageUploaderProps {
  label?: string;
  category: ImageCategory;
  storageFolder: string;
  currentImageUrl?: string | null;
  currentStoragePath?: string | null;
  customFileName?: string;
  disabled?: boolean;
  compact?: boolean;
  aspectRatioHint?: string;
  allowRemove?: boolean;
  onUploadSuccess: (result: UploadResult) => void;
  onImageRemove?: () => void;
  onError?: (errorMsg: string) => void;
  className?: string;
}

export const OptimizedImageUploader: React.FC<OptimizedImageUploaderProps> = ({
  label,
  category,
  storageFolder,
  currentImageUrl,
  currentStoragePath,
  customFileName,
  disabled = false,
  compact = false,
  aspectRatioHint,
  allowRemove = true,
  onUploadSuccess,
  onImageRemove,
  onError,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profile = IMAGE_OPTIMIZATION_CONFIG.profiles[category] || IMAGE_OPTIMIZATION_CONFIG.profiles.GENERAL;

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState<number | undefined>(undefined);
  const [savingsPercent, setSavingsPercent] = useState<number | undefined>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // 1. Initial Validation
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'অবৈধ ছবি ফাইল।');
      onError?.(validation.error || 'অবৈধ ছবি ফাইল।');
      return;
    }

    // Reset state for new run
    setErrorMessage(null);
    setUploadSuccess(false);
    setIsProcessing(true);
    setProgress(5);
    setStatusText('ছবি যাচাই করা হচ্ছে...');
    setOriginalSize(file.size);
    setCompressedSize(undefined);
    setSavingsPercent(undefined);

    // 20-second watchdog guard so UI can never hang indefinitely
    const watchdog = setTimeout(() => {
      setIsProcessing(false);
      setErrorMessage('প্রক্রিয়াটি সম্পন্ন হতে অতিরিক্ত সময় লাগছে। পুনরায় চেষ্টা করুন।');
    }, 20000);

    try {
      const result = await uploadOptimizedImage({
        file,
        category,
        storageFolder,
        customFileName,
        oldStoragePath: currentStoragePath || undefined,
        onProgress: (pct, text) => {
          setProgress(pct);
          setStatusText(text);
        },
      });

      clearTimeout(watchdog);
      setCompressedSize(result.compressedSize);
      setSavingsPercent(result.savingsPercent);
      setPreviewUrl(result.previewUrl || result.downloadUrl);
      setUploadSuccess(true);
      setIsProcessing(false);

      // Notify parent
      onUploadSuccess(result);
    } catch (err: any) {
      clearTimeout(watchdog);
      setIsProcessing(false);
      const msg = err.message || 'ছবি অপটিমাইজ ও আপলোড করতে সমস্যা হয়েছে।';
      setErrorMessage(msg);
      onError?.(msg);
    }
  };

  const handleTriggerClick = () => {
    if (disabled || isProcessing) return;
    fileInputRef.current?.click();
  };

  const activeImage = previewUrl || currentImageUrl;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-700">
            {label}
          </label>
          {aspectRatioHint && (
            <span className="text-[11px] text-slate-500 font-mono-num">
              {aspectRatioHint}
            </span>
          )}
        </div>
      )}

      {/* Upload Zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl transition-all duration-200 ${
          disabled || isProcessing
            ? 'opacity-60 bg-slate-50 border-slate-300 pointer-events-none'
            : 'border-slate-300 hover:border-amber-500 bg-white hover:bg-amber-50/20'
        } ${compact ? 'p-3' : 'p-4 sm:p-5'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_OPTIMIZATION_CONFIG.allowedMimeTypes.join(',')}
          onChange={handleFileSelect}
          disabled={disabled || isProcessing}
          className="hidden"
        />

        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Image Thumbnail / Placeholder */}
          <div className="relative group shrink-0">
            {activeImage ? (
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-slate-300 shadow-xs bg-slate-100 flex items-center justify-center">
                <img
                  src={activeImage}
                  alt="Current preview"
                  className="w-full h-full object-contain p-1"
                />
                {!disabled && !isProcessing && (
                  <div
                    onClick={handleTriggerClick}
                    className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity text-[11px] font-semibold gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>পরিবর্তন</span>
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={handleTriggerClick}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg border border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50/50 cursor-pointer transition-colors"
              >
                <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                <span className="text-[10px] mt-1 font-medium">ছবি নেই</span>
              </div>
            )}
          </div>

          {/* Action & Info Area */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={handleTriggerClick}
                  disabled={disabled || isProcessing}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{activeImage ? 'ছবি পরিবর্তন করুন' : 'ছবি নির্বাচন করুন'}</span>
                </button>

                {allowRemove && activeImage && !disabled && !isProcessing && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrl(null);
                      setUploadSuccess(false);
                      onImageRemove?.();
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>মুছে ফেলুন</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px] text-slate-500 mt-2">
                <span className="font-semibold text-amber-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>সর্বোচ্চ ২০ MB ফাইল গ্রহণযোগ্য</span>
                </span>
                <span>•</span>
                <span>স্বয়ংক্রিয় WebP/PNG কম্প্রেশন</span>
                <span>•</span>
                <span>{profile.nameBn}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Realtime Optimization Feedback Widget */}
      <ImageOptimizationFeedback
        originalSize={originalSize}
        compressedSize={compressedSize}
        savingsPercent={savingsPercent}
        progress={progress}
        statusText={statusText}
        isProcessing={isProcessing}
        isSuccess={uploadSuccess}
        error={errorMessage}
        previewUrl={activeImage}
        onDismiss={() => {
          setErrorMessage(null);
          setUploadSuccess(false);
        }}
      />
    </div>
  );
};
