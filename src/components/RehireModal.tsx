import React, { useState } from 'react';
import { X, UserPlus, Calendar, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { employeeService } from '../services/firebaseServices.ts';

interface RehireModalProps {
  employee: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const RehireModal: React.FC<RehireModalProps> = ({
  employee,
  open,
  onClose,
  onSuccess,
  showToast,
}) => {
  const { apiFetch } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];

  const [newJoiningDate, setNewJoiningDate] = useState(todayStr);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open || !employee) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJoiningDate) {
      showToast('নতুন যোগদানের তারিখ প্রদান করা আবশ্যক।', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await employeeService.rehire(apiFetch, employee.id, {
        newJoiningDate,
        notes: notes.trim(),
      });
      showToast(`${employee.fullName}-কে সফলভাবে সংস্থায় পুনর্বহাল (Rehired) করা হয়েছে।`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'পুনর্বহাল করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-50 border-b border-emerald-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-950">
                কর্মচারী পুনর্বহাল (Rehire Employee)
              </h3>
              <p className="text-xs text-emerald-700">
                পূর্ববর্তী রেকর্ড অক্ষুণ্ণ রেখে নতুন কর্মমেয়াদে পুনর্বহাল
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-400 hover:text-emerald-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
            <div className="font-bold text-slate-900 text-sm">{employee.fullName}</div>
            <div className="text-slate-600">
              {employee.employeeCode} · {employee.designationName} ({employee.departmentName})
            </div>
            <div className="text-[11px] text-slate-500 pt-1">
              পূর্বে অব্যাহতি: <span className="font-mono-num text-rose-700 font-semibold">{employee.terminationDate || '-'}</span>
              {' · '}ধরন: <span className="font-medium text-slate-700">{employee.terminationType || 'অব্যাহতি'}</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 text-blue-900 text-[11px] leading-relaxed">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              পুনর্বহালের মাধ্যমে কর্মচারীর স্ট্যাটাস পুনরায় <strong>Active</strong> হবে। পূর্ববর্তী কর্মমেয়াদের তথ্য <code>rehireHistory</code>-তে স্থায়ীভাবে সংরক্ষিত থাকবে।
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              নতুন যোগদানের তারিখ (New Joining Date) *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="date"
                required
                value={newJoiningDate}
                onChange={(e) => setNewJoiningDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg font-mono-num bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              পুনর্বহালের মন্তব্য / অনুমোদন নোট (ঐচ্ছিক)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="পুনর্বহাল সংক্রান্ত কোনো বিশেষ সিদ্ধান্ত বা মন্তব্য..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
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
              className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>{submitting ? 'পুনর্বহাল হচ্ছে...' : 'পুনর্বহাল নিশ্চিত করুন'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
