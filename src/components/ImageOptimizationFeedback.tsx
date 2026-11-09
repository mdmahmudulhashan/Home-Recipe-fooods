import React from 'react';
import {
  Sparkles,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  FileImage,
  Loader2,
  HardDrive,
} from 'lucide-react';
import { formatImageSize } from '../config/imageOptimizationConfig.ts';

export interface ImageOptimizationFeedbackProps {
  originalSize: number;
  compressedSize?: number;
  savingsPercent?: number;
  progress: number;
  statusText: string;
  isProcessing: boolean;
  isSuccess: boolean;
  error?: string | null;
  previewUrl?: string | null;
  className?: string;
  onDismiss?: () => void;
}

export const ImageOptimizationFeedback: React.FC<ImageOptimizationFeedbackProps> = ({
  originalSize,
  compressedSize,
  savingsPercent,
  progress,
  statusText,
  isProcessing,
  isSuccess,
  error,
  previewUrl,
  className = '',
  onDismiss,
}) => {
  if (!isProcessing && !isSuccess && !error) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border p-3.5 sm:p-4 text-xs transition-all shadow-xs ${
        error
          ? 'bg-rose-50/90 border-rose-300 text-rose-900'
          : isSuccess
          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
          : 'bg-amber-50/70 border-amber-200 text-amber-950'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {error ? (
            <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
          ) : isSuccess ? (
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
          )}

          <div>
            <div className="font-bold text-xs flex items-center gap-1.5">
              <span>
                {error
                  ? 'অপটিমাইজেশন ত্রুটি'
                  : isSuccess
                  ? 'ছবি অপটিমাইজ ও আপলোড সফল'
                  : 'গ্লোবাল ইমেজ অপটিমাইজেশন চলছে...'}
              </span>
              {isProcessing && <Loader2 className="w-3 h-3 animate-spin text-amber-600" />}
            </div>
            <p className="text-[11px] opacity-80 mt-0.5">{statusText}</p>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-600 font-bold text-sm px-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Progress Bar & Stage Badges */}
      {isProcessing && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-semibold text-amber-800">
            <span>অগ্রগতি (Progress)</span>
            <span className="font-mono-num">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-amber-200/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-600 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(5, progress)}%` }}
            />
          </div>

          {/* Workflow Steps Indicator */}
          <div className="grid grid-cols-4 gap-1 pt-1 text-[9px] text-center">
            <div
              className={`py-0.5 px-1 rounded transition-colors ${
                progress >= 10
                  ? 'bg-amber-200/70 text-amber-900 font-semibold'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              ১. যাচাই
            </div>
            <div
              className={`py-0.5 px-1 rounded transition-colors ${
                progress >= 40
                  ? 'bg-amber-200/70 text-amber-900 font-semibold'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              ২. কম্প্রেশন
            </div>
            <div
              className={`py-0.5 px-1 rounded transition-colors ${
                progress >= 60
                  ? 'bg-amber-200/70 text-amber-900 font-semibold'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              ৩. ক্লাউড আপলোড
            </div>
            <div
              className={`py-0.5 px-1 rounded transition-colors ${
                progress >= 90
                  ? 'bg-emerald-200/80 text-emerald-950 font-bold'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              ৪. সম্পন্ন
            </div>
          </div>
        </div>
      )}

      {/* Optimization Comparison Metrics */}
      {originalSize > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Optimized thumbnail"
                className="w-9 h-9 rounded-md object-cover border border-slate-300 shadow-2xs shrink-0"
              />
            )}

            <div className="space-y-0.5">
              <div className="text-[11px] font-mono-num flex items-center gap-1 text-slate-700">
                <HardDrive className="w-3 h-3 text-slate-400" />
                <span>Original:</span>
                <strong className="text-slate-900">{formatImageSize(originalSize)}</strong>
              </div>

              {typeof compressedSize === 'number' && compressedSize > 0 && (
                <div className="text-[11px] font-mono-num flex items-center gap-1 text-emerald-800">
                  <FileImage className="w-3 h-3 text-emerald-600" />
                  <span>Optimized:</span>
                  <strong className="text-emerald-700">{formatImageSize(compressedSize)}</strong>
                </div>
              )}
            </div>
          </div>

          {typeof savingsPercent === 'number' && savingsPercent > 0 && (
            <div className="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-2xs animate-fade-in">
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>Saved: {savingsPercent}%</span>
              <span className="hidden sm:inline font-normal text-[10px] opacity-90">
                (সাইজ সাশ্রয়)
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 text-rose-700 text-[11px] leading-relaxed">
          {error}
        </div>
      )}
    </div>
  );
};
