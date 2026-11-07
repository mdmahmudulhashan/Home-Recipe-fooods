import React, { useEffect, useState } from 'react';
import { X, Printer, CheckCircle, Clock, AlertCircle, FileText, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { employeeService } from '../services/firebaseServices.ts';
import { formatTaka, getMonthLabel } from '../utils/formatters.ts';

interface FinalSettlementSlipModalProps {
  employee: any;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const FinalSettlementSlipModal: React.FC<FinalSettlementSlipModalProps> = ({
  employee,
  open,
  onClose,
  onSuccess,
  showToast,
}) => {
  const { apiFetch, user } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  const loadProfile = async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const res = await employeeService.getProfile(apiFetch, employee.id);
      setProfileData(res);
    } catch (err: any) {
      showToast(err.message || 'কর্মচারীর নিষ্পত্তির তথ্য লোড করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && employee?.id) {
      loadProfile();
    }
  }, [open, employee?.id]);

  if (!open || !employee) return null;

  const emp = profileData?.employee || employee;
  const calc = profileData?.currentMonthCalculation;
  const isSettled = Boolean(emp.finalSalarySettled);

  const handleSettle = async () => {
    if (!window.confirm(`আপনি কি নিশ্চিতভাবে ${emp.fullName}-এর চূড়ান্ত বেতন পরিশোধ সম্পন্ন চিহ্নিত করতে চান?`)) {
      return;
    }
    setSettling(true);
    try {
      await employeeService.settleFinalSalary(apiFetch, emp.id);
      showToast(`${emp.fullName}-এর চূড়ান্ত বেতন সফলভাবে পরিশোধিত হিসেবে চিহ্নিত করা হয়েছে।`, 'success');
      await loadProfile();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast(err.message || 'পরিশোধ চিহ্নিত করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setSettling(false);
    }
  };

  const handlePrint = () => {
    const existing = document.getElementById('settlement-print-style');
    if (existing) existing.remove();
    const styleEl = document.createElement('style');
    styleEl.id = 'settlement-print-style';
    styleEl.innerHTML = `@page { size: A4 portrait; margin: 12mm 15mm; }`;
    document.head.appendChild(styleEl);

    const onAfterPrint = () => {
      styleEl.remove();
      window.removeEventListener('afterprint', onAfterPrint);
    };
    window.addEventListener('afterprint', onAfterPrint);

    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
      <div className="bg-white border border-slate-300 rounded-xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              <span>কর্মচারী অব্যাহতিপত্র ও চূড়ান্ত বেতন নিষ্পত্তি রসিদ</span>
            </h3>
            <p className="text-xs text-slate-400">
              Final Salary Settlement Voucher & Official Release Record
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {!isSettled && (
              <button
                onClick={handleSettle}
                disabled={settling || loading}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{settling ? 'সংরক্ষণ...' : 'পরিশোধ সম্পন্ন চিহ্নিত করুন'}</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট / PDF ডাউনলোড</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Settlement Voucher Body */}
        <div className="p-8 overflow-y-auto bg-slate-100 flex-1">
          {loading ? (
            <div className="p-16 text-center text-sm text-slate-500 bg-white rounded-xl shadow-xs">
              চূড়ান্ত বেতন নিষ্পত্তির বিবরণ লোড হচ্ছে...
            </div>
          ) : (
            <div
              id="settlement-voucher-print-area"
              className="bg-white p-8 sm:p-10 rounded-xl shadow-md border border-slate-300 max-w-3xl mx-auto space-y-6 text-slate-900 text-xs"
            >
              {/* Company Header */}
              <div className="text-center border-b-2 border-slate-900 pb-5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">হোম রেসিপি ফুডস্</h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  মাইজদী রোড, চট্টগ্রাম, বাংলাদেশ · ফোন: +880 1800-000000
                </p>
                <div className="mt-3 inline-block px-4 py-1.5 bg-slate-100 border border-slate-800 rounded-md text-xs font-bold text-slate-900 tracking-wide uppercase">
                  চূড়ান্ত বেতন নিষ্পত্তি ও অব্যাহতিপত্র (Final Settlement Voucher)
                </div>
              </div>

              {/* Status Banner */}
              <div className="flex flex-wrap items-center justify-between p-3 rounded-lg border text-xs gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">পরিশোধের অবস্থা:</span>
                  {isSettled ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>চূড়ান্ত বেতন পরিশোধিত (PAID)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                      <Clock className="w-3.5 h-3.5" />
                      <span>চূড়ান্ত বেতন বকেয়া (PENDING SETTLEMENT)</span>
                    </span>
                  )}
                </div>
                <div className="text-slate-500 font-mono-num text-[11px]">
                  তারিখ: {new Date().toISOString().split('T')[0]}
                </div>
              </div>

              {/* Employee Bio Details Table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 border-b border-slate-300">
                  কর্মচারীর পরিচিতি ও অব্যাহতি বিবরণ
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
                  <div>
                    <span className="text-slate-500 block text-[10px]">কর্মচারীর নাম:</span>
                    <strong className="text-slate-900 text-sm">{emp.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Employee ID:</span>
                    <strong className="font-mono-num text-slate-900">{emp.employeeCode}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">বিভাগ ও পদবি:</span>
                    <span className="text-slate-800 font-medium">
                      {emp.departmentName} · {emp.designationName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">যোগদানের তারিখ:</span>
                    <span className="font-mono-num text-slate-800">{emp.joiningDate || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">শেষ কর্মদিবস (Termination Date):</span>
                    <strong className="font-mono-num text-rose-700">
                      {emp.terminationDate || emp.lastWorkingDay || '-'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">অব্যাহতির ধরন:</span>
                    <span className="font-semibold text-slate-800">
                      {emp.terminationType || 'চাকরি থেকে অব্যাহতি'}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-3 pt-2 border-t border-slate-200">
                    <span className="text-slate-500 block text-[10px]">অব্যাহতির কারণ:</span>
                    <p className="text-slate-800 italic mt-0.5">
                      {emp.terminationReason || 'নিয়মিত অব্যাহতি প্রক্রিয়া'}
                    </p>
                  </div>
                  {emp.terminationNotes && (
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-slate-500 block text-[10px]">অতিরিক্ত মন্তব্য:</span>
                      <p className="text-slate-700 mt-0.5">{emp.terminationNotes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Settlement Breakdown */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 border-b border-slate-300 flex justify-between items-center">
                  <span>চূড়ান্ত বেতন হিসাব বিবরণী (Final Salary Breakdown)</span>
                  {calc && (
                    <span className="text-[11px] font-normal text-slate-600 font-mono-num">
                      মাস: {getMonthLabel(calc.month)} {calc.year}
                    </span>
                  )}
                </div>
                <table className="w-full text-left border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="py-2.5 px-4 text-slate-700">মূল বেতন (Monthly Basic Salary)</td>
                      <td className="py-2.5 px-4 text-right font-mono-num font-medium">
                        {formatTaka(calc?.basicSalary || emp.basicSalary)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <td className="py-2.5 px-4 text-slate-700">দৈনিক বেতন হার (Daily Salary = Basic/30)</td>
                      <td className="py-2.5 px-4 text-right font-mono-num">
                        {formatTaka(calc?.dailySalary || Math.round((emp.basicSalary / 30) * 100) / 100)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-2.5 px-4 text-slate-700">
                        শেষ কর্মদিবস পর্যন্ত মোট কর্মদিবস (Payable Days)
                        <span className="block text-[10px] text-slate-400">
                          (নিয়মিত দিন: {calc?.regularPaidDays ?? '-'} দিন + শুক্রবার ওভারটাইম: {calc?.fridayOvertimeDays ?? 0} দিন)
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num font-bold text-slate-900">
                        {calc?.totalDays ?? '-'} দিন
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <td className="py-2.5 px-4 text-slate-700">মাসিক বোনাস (প্রযোজ্য ক্ষেত্রে)</td>
                      <td className="py-2.5 px-4 text-right font-mono-num">
                        {formatTaka(calc?.monthlyBonus || 0)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 font-semibold bg-emerald-50/40">
                      <td className="py-2.5 px-4 text-emerald-950">
                        মোট প্রদেয় বেতন (Gross Payable Salary)
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num text-emerald-950">
                        {formatTaka(calc?.grossSalary || 0)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 text-rose-700">
                      <td className="py-2.5 px-4">কর্তন: অগ্রিম টাকা (Advance Deductions)</td>
                      <td className="py-2.5 px-4 text-right font-mono-num font-semibold">
                        - {formatTaka(calc?.totalAdvance || 0)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300 text-rose-700">
                      <td className="py-2.5 px-4">কর্তন: নাস্তা ক্রয় (Snack Deductions)</td>
                      <td className="py-2.5 px-4 text-right font-mono-num font-semibold">
                        - {formatTaka(calc?.totalSnack || 0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-900 text-white font-bold text-sm">
                      <td className="py-3 px-4">সর্বমোট চূড়ান্ত পাওনা বেতন (Net Settlement Amount)</td>
                      <td className="py-3 px-4 text-right font-mono-num text-amber-300 text-base">
                        {formatTaka(calc?.payableSalary || 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Settlement Agreement Note */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 leading-relaxed">
                আমি নিশ্চিত করছি যে, হোম রেসিপি ফুডস্ থেকে আমার শেষ কর্মদিবস পর্যন্ত সমস্ত অর্জিত বেতন, ওভারটাইম এবং যাবতীয় পাওনাদি যথাযথ হিসাবপূর্বক চূড়ান্তভাবে নিষ্পত্তি করা হয়েছে।
              </div>

              {/* Official Signature Lines */}
              <div className="grid grid-cols-3 gap-6 pt-16 text-center text-xs">
                <div>
                  <div className="border-t border-slate-800 pt-2 font-semibold text-slate-800">
                    কর্মচারীর স্বাক্ষর
                  </div>
                  <span className="text-[10px] text-slate-500">তারিখ: ____________</span>
                </div>
                <div>
                  <div className="border-t border-slate-800 pt-2 font-semibold text-slate-800">
                    হিসাব ও বেতন প্রস্তুতকারী
                  </div>
                  <span className="text-[10px] text-slate-500">HR & Accounts Dept</span>
                </div>
                <div>
                  <div className="border-t border-slate-800 pt-2 font-semibold text-slate-800">
                    ব্যবস্থাপনা পরিচালক / Admin
                  </div>
                  <span className="text-[10px] text-slate-500">হোম রেসিপি ফুডস্</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
