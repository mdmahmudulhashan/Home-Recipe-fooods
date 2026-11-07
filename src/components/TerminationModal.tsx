import React, { useState } from 'react';
import { X, AlertTriangle, Calendar, UserX, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { employeeService } from '../services/firebaseServices.ts';
import { formatTaka } from '../utils/formatters.ts';

interface TerminationModalProps {
  employee: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const TERMINATION_TYPES = [
  'চাকরি থেকে বরখাস্ত',
  'স্বেচ্ছায় পদত্যাগ',
  'চাকরি থেকে অব্যাহতি',
  'চুক্তির মেয়াদ শেষ',
  'অন্যান্য',
];

export const TerminationModal: React.FC<TerminationModalProps> = ({
  employee,
  open,
  onClose,
  onSuccess,
  showToast,
}) => {
  const { apiFetch, user } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];

  const [terminationDate, setTerminationDate] = useState(todayStr);
  const [terminationType, setTerminationType] = useState('চাকরি থেকে অব্যাহতি');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  if (!open || !employee) return null;

  const basicSalary = Number(employee.basicSalary) || 0;
  const dailySalary = Math.round((basicSalary / 30) * 100) / 100;
  const joiningDate = employee.joiningDate || '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDbError(null);

    if (!reason.trim()) {
      showToast('অব্যাহতির সুনির্দিষ্ট কারণ উল্লেখ করা বাধ্যতামূলক।', 'error');
      return;
    }

    if (joiningDate && terminationDate < joiningDate) {
      showToast(`শেষ কর্মদিবস যোগদানের তারিখের (${joiningDate}) পূর্বে হতে পারে না।`, 'error');
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmTerminate = async () => {
    // 1. Strict double-click protection
    if (submitting) return;

    setSubmitting(true);
    setDbError(null);

    try {
      const res = await employeeService.terminate(apiFetch, employee.id, {
        terminationDate,
        terminationType,
        reason: reason.trim(),
        notes: notes.trim(),
      });

      // 2. Only show success after database operation confirms success
      showToast(
        res?.message || `${employee.fullName}-কে সফলভাবে চাকরি থেকে অব্যাহতি দেওয়া হয়েছে এবং ডাটাবেজে সংরক্ষিত হয়েছে।`,
        'success'
      );
      setDbError(null);
      setShowConfirm(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      // 3. Keep confirmation open and show actual database error in dialog
      const errMsg = err?.message || 'ডাটাবেজে অব্যাহতি তথ্য সংরক্ষণে সমস্যা হয়েছে।';
      setDbError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-rose-50 border-b border-rose-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-950">
                কর্মচারী অব্যাহতি / চাকরি থেকে বরখাস্ত ফরম
              </h3>
              <p className="text-xs text-rose-700">
                শেষ কর্মদিবস পর্যন্ত বেতন স্বয়ংক্রিয়ভাবে সমন্বয় ও স্থায়ী রেকর্ড সংরক্ষণ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-rose-400 hover:text-rose-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Employee Auto Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[11px] text-slate-500">কর্মচারীর নাম</span>
              <div className="font-bold text-slate-900 text-sm mt-0.5">{employee.fullName}</div>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">Employee ID</span>
              <div className="font-mono-num font-semibold text-slate-800 mt-0.5">
                {employee.employeeCode}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">বিভাগ ও পদবি</span>
              <div className="text-slate-800 font-medium mt-0.5">
                {employee.departmentName} · {employee.designationName}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">যোগদানের তারিখ</span>
              <div className="font-mono-num font-medium text-slate-800 mt-0.5">
                {employee.joiningDate || '-'}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-slate-600">
              <span>
                মূল বেতন: <strong className="font-mono-num text-slate-900">{formatTaka(basicSalary)}</strong>
              </span>
              <span>
                দৈনিক বেতন (Basic/30): <strong className="font-mono-num text-slate-900">{formatTaka(dailySalary)}</strong>
              </span>
              <span>
                অনুমোদনকারী: <strong className="text-slate-900">{user?.name || user?.email || 'Admin'}</strong>
              </span>
            </div>
          </div>

          {/* Critical Policy Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-2.5 text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="font-semibold">শেষ কর্মদিবস বেতন নীতি:</strong> শেষ কর্মদিবসও বেতনযোগ্য দিন হিসেবে গণ্য হবে। শেষ কর্মদিবসের পরের দিনসমূহ স্বয়ংক্রিয়ভাবে শূন্য দিন হিসেবে বিবেচিত হবে এবং পূর্ববর্তী মাসের সংরক্ষিত বেতন রেকর্ডে কোনো পরিবর্তন ঘটবে না।
            </div>
          </div>

          {/* Form Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Termination Date / শেষ কর্মদিবস *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  required
                  value={terminationDate}
                  min={joiningDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg font-mono-num bg-white"
                />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                এই দিনটি সহ শেষ কর্মদিবস পর্যন্ত বেতন হিসাব করা হবে
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                অব্যাহতির ধরন (Termination Type) *
              </label>
              <select
                value={terminationType}
                onChange={(e) => setTerminationType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium text-slate-800"
              >
                {TERMINATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                অব্যাহতির কারণ (Reason) *
              </label>
              <textarea
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="চাকরি থেকে অব্যাহতি বা বরখাস্তের কারণ বিস্তারিতভাবে উল্লেখ করুন..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                অতিরিক্ত মন্তব্য / নোট (ঐচ্ছিক)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="প্রযোজ্য ক্ষেত্রে কোনো বিশেষ শর্ত, হস্তান্তরিত দায়িত্ব বা নোট..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <UserX className="w-4 h-4" />
              <span>অব্যাহতি প্রক্রিয়া সম্পন্ন করুন</span>
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal Layer */}
      {showConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-rose-300 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-slate-900">অব্যাহতি চূড়ান্ত নিশ্চিতকরণ</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              আপনি কি নিশ্চিতভাবে <strong className="text-slate-900">{employee.fullName}</strong> ({employee.employeeCode})-কে{' '}
              <strong className="text-rose-700">{terminationDate}</strong> তারিখ থেকে চাকরি থেকে অব্যাহতি দিতে চান?
            </p>
            <div className="p-3 bg-slate-50 rounded-lg text-[11px] text-slate-700 space-y-1">
              <div>ধরন: <span className="font-semibold">{terminationType}</span></div>
              <div>কারণ: <span className="font-semibold">{reason}</span></div>
              <div>কর্মচারীর স্ট্যাটাস <strong>Terminated</strong> হিসেবে রূপান্তরিত হবে।</div>
            </div>

            {/* In-Dialog Error Box */}
            {dbError && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-900">ডাটাবেজে সংরক্ষণ ব্যর্থ:</div>
                  <div className="mt-0.5 leading-relaxed">{dbError}</div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setDbError(null);
                }}
                disabled={submitting}
                className="px-3.5 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                ফিরে যান
              </button>
              <button
                type="button"
                onClick={handleConfirmTerminate}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>ডাটাবেজে সংরক্ষণ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <UserX className="w-3.5 h-3.5" />
                    <span>হ্যাঁ, অব্যাহতি নিশ্চিত করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
