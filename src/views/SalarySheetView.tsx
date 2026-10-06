import React, { useEffect, useState } from 'react';
import { Printer, FileDown, Eye, Save, X, Calculator } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BENGALI_MONTHS, formatTaka, getMonthLabel } from '../utils/formatters.ts';
import { salaryService, departmentService } from '../services/firebaseServices.ts';

interface SalarySheetViewProps {
  onSelectEmployee: (id: number) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SalarySheetView: React.FC<SalarySheetViewProps> = ({
  onSelectEmployee,
  showToast,
}) => {
  const { apiFetch } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [departmentId, setDepartmentId] = useState('ALL');

  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [sheetData, setSheetData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadDepartments = async () => {
    try {
      const depts = await departmentService.list(apiFetch);
      setDepartmentsList(depts);
    } catch {
      // ignore
    }
  };

  const loadSalarySheet = async () => {
    setLoading(true);
    try {
      const res = await salaryService.getSheet(apiFetch, year, month, departmentId);
      setSheetData(res);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    loadSalarySheet();
  }, [month, year, departmentId]);

  const handleSaveSheet = async () => {
    setSaving(true);
    try {
      const res = await salaryService.saveSheet(
        apiFetch,
        year,
        month,
        departmentId,
        sheetData
      );
      showToast(res.message);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const rows = sheetData?.rows || [];
  const totals = sheetData?.totals || {};

  const renderSalaryTable = (isPrintMode = false) => (
    <div className="overflow-x-auto">
      <table
        className={`w-full text-left border-collapse ${
          isPrintMode ? 'print-table text-xs' : 'text-xs'
        }`}
      >
        <thead className="bg-slate-100 border-y border-slate-300 text-slate-800 font-bold">
          <tr>
            <th className="py-2.5 px-2 border border-slate-300 text-center">Number</th>
            <th className="py-2.5 px-3 border border-slate-300">নাম</th>
            <th className="py-2.5 px-2.5 border border-slate-300 text-right">Basic Salary</th>
            <th className="py-2.5 px-2.5 border border-slate-300 text-right">Daily Salary</th>
            <th className="py-2.5 px-2 border border-slate-300 text-center">মোট দিন</th>
            <th className="py-2.5 px-2 border border-slate-300 text-center">Overtime</th>
            <th className="py-2.5 px-2.5 border border-slate-300 text-right">মাসিক বোনাস</th>
            <th className="py-2.5 px-2.5 border border-slate-300 text-right">মোট Salary</th>
            <th className="py-2.5 px-2.5 border border-slate-300 text-right">অগ্রিম টাকা</th>
            <th className="py-2.5 px-2.5 border border-slate-300 text-right">নাস্তা ক্রয়</th>
            <th className="py-2.5 px-3 border border-slate-300 text-right">পাওনা বেতন</th>
            <th className="py-2.5 px-4 border border-slate-300 text-center w-36">
              গ্রহণকারীর স্বাক্ষর
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, idx: number) => (
            <tr key={r.employeeId} className="hover:bg-slate-50">
              <td className="py-2.5 px-2 border border-slate-300 text-center font-mono-num">
                {idx + 1}
              </td>
              <td className="py-2.5 px-3 border border-slate-300">
                {isPrintMode ? (
                  <div className="font-bold text-slate-900">{r.fullName}</div>
                ) : (
                  <button
                    onClick={() => onSelectEmployee(r.employeeId)}
                    className="font-bold text-slate-900 hover:text-emerald-700 hover:underline text-left"
                  >
                    {r.fullName}
                  </button>
                )}
                <div className="text-[10px] text-slate-500">
                  {r.employeeCode} · {r.designationName} ({r.departmentName})
                </div>
              </td>
              <td className="py-2.5 px-2.5 border border-slate-300 text-right font-mono-num">
                {r.basicSalary.toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2.5 border border-slate-300 text-right font-mono-num">
                {r.dailySalary.toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2 border border-slate-300 text-center font-mono-num font-semibold">
                {r.totalDays}
                <div className="text-[10px] font-normal text-slate-400">
                  ({r.regularPaidDays}+{r.fridayOvertimeDays})
                </div>
              </td>
              <td className="py-2.5 px-2 border border-slate-300 text-center font-mono-num font-semibold text-emerald-700">
                {r.fridayOvertimeDays}
              </td>
              <td className="py-2.5 px-2.5 border border-slate-300 text-right font-mono-num">
                {r.monthlyBonus.toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2.5 border border-slate-300 text-right font-mono-num font-semibold">
                {r.grossSalary.toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2.5 border border-slate-300 text-right font-mono-num text-red-600">
                {r.totalAdvance.toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-2.5 border border-slate-300 text-right font-mono-num text-red-600">
                {r.totalSnack.toLocaleString('en-IN')}
              </td>
              <td className="py-2.5 px-3 border border-slate-300 text-right font-mono-num font-bold text-slate-900 text-sm">
                {r.payableSalary.toLocaleString('en-IN')} ৳
              </td>
              <td className="py-4 px-4 border border-slate-300"></td>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="bg-slate-100 font-bold text-slate-900">
            <tr>
              <td colSpan={2} className="py-3 px-3 border border-slate-300 text-right">
                সর্বমোট (Grand Total):
              </td>
              <td className="py-3 px-2.5 border border-slate-300 text-right font-mono-num">
                {totals.basicSalary?.toLocaleString('en-IN')}
              </td>
              <td className="py-3 px-2.5 border border-slate-300 text-right font-mono-num">-</td>
              <td className="py-3 px-2 border border-slate-300 text-center font-mono-num">-</td>
              <td className="py-3 px-2 border border-slate-300 text-center font-mono-num">
                {totals.totalOvertimeDays}
              </td>
              <td className="py-3 px-2.5 border border-slate-300 text-right font-mono-num">
                {totals.monthlyBonus?.toLocaleString('en-IN')}
              </td>
              <td className="py-3 px-2.5 border border-slate-300 text-right font-mono-num">
                {totals.grossSalary?.toLocaleString('en-IN')}
              </td>
              <td className="py-3 px-2.5 border border-slate-300 text-right font-mono-num text-red-600">
                {totals.totalAdvance?.toLocaleString('en-IN')}
              </td>
              <td className="py-3 px-2.5 border border-slate-300 text-right font-mono-num text-red-600">
                {totals.totalSnack?.toLocaleString('en-IN')}
              </td>
              <td className="py-3 px-3 border border-slate-300 text-right font-mono-num text-emerald-800 text-sm">
                {totals.payableSalary?.toLocaleString('en-IN')} ৳
              </td>
              <td className="py-3 px-4 border border-slate-300"></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Control Header (Hidden in Print) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              মাসিক সেলারি শিট ও ওভারটাইম ক্যালকুলেশন
            </h2>
            <p className="text-xs text-slate-500">
              সকল হিসাব (Daily Salary = Basic/30, Friday Overtime, Gross Salary ও কর্তন) স্বয়ংক্রিয়ভাবে গণনা করা হয়েছে
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleSaveSheet}
              disabled={saving || loading}
              className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'সেলারি শিট সংরক্ষণ'}</span>
            </button>

            <button
              onClick={() => setPreviewOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <Eye className="w-4 h-4" />
              <span>Print Preview</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Print (Legal Landscape)</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileDown className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              বেতনের মাস (Month)
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {BENGALI_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              বছর (Year)
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
            >
              {[2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              বিভাগ (Department)
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">সকল বিভাগ (All Departments)</option>
              {departmentsList.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Formula Reference Banner (No Print) */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950 no-print">
        <div className="flex items-center gap-2 font-semibold">
          <Calculator className="w-4 h-4 text-emerald-700" />
          <span>কেন্দ্রীয় বেতন সূত্র:</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700 font-mono-num">
          <span>Daily = Basic / 30</span>
          <span>·</span>
          <span>মোট দিন = নিয়মিত উপস্থিত দিন + শুক্রবার ওভারটাইম</span>
          <span>·</span>
          <span>মোট Salary = (Daily × মোট দিন) + মাসিক বোনাস</span>
          <span>·</span>
          <span>পাওনা বেতন = মোট Salary - অগ্রিম - নাস্তা ক্রয়</span>
        </div>
      </div>

      {/* Printable Legal Landscape Salary Sheet Container */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 print-container">
        {/* Official Company Print Header */}
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-5">
          <h1 className="text-2xl font-bold text-slate-900">
            {sheetData?.companyName || 'হোম রেসিপি ফুডস্'}
          </h1>
          <p className="text-sm text-slate-700 mt-0.5">
            {sheetData?.companyAddress || 'চট্টগ্রাম, বাংলাদেশ'}
          </p>
          <div className="mt-2 inline-block px-4 py-1 border border-slate-800 rounded-md text-xs font-bold text-slate-900">
            মাসিক বেতন শিট (Salary Sheet) — {getMonthLabel(month)} {year} · বিভাগ:{' '}
            {sheetData?.departmentName || 'সকল বিভাগ'}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            সেলারি শিট প্রস্তুত করা হচ্ছে...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            নির্বাচিত বিভাগে কোনো সক্রিয় কর্মচারী পাওয়া যায়নি।
          </div>
        ) : (
          renderSalaryTable(false)
        )}

        {/* Official Signature Footer */}
        <div className="grid grid-cols-3 gap-8 mt-16 pt-6 text-center text-xs text-slate-700">
          <div>
            <div className="border-t border-slate-800 pt-2 font-semibold">
              প্রস্তুতকারীর স্বাক্ষর (HR / Accounts)
            </div>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-2 font-semibold">
              যাচাইকারীর স্বাক্ষর (Manager / Admin)
            </div>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-2 font-semibold">
              অনুমোদনকারীর স্বাক্ষর (ব্যবস্থাপনা পরিচালক)
            </div>
          </div>
        </div>
      </div>

      {/* Print Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 no-print overflow-y-auto">
          <div className="bg-white border border-slate-300 rounded-xl max-w-7xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div>
                <h3 className="text-sm font-bold">
                  প্রিন্ট প্রিভিউ (Legal Size — Landscape Format)
                </h3>
                <p className="text-xs text-slate-400">
                  প্রিন্ট বা PDF এক্সপোর্টে শুধুমাত্র নিচের শিটটি প্রদর্শিত হবে
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>এখনই প্রিন্ট / PDF সংরক্ষণ করুন</span>
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="p-1.5 text-slate-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto bg-slate-100 flex-1">
              <div className="bg-white p-8 shadow-md border border-slate-300 mx-auto">
                <div className="text-center border-b-2 border-slate-900 pb-4 mb-5">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {sheetData?.companyName || 'হোম রেসিপি ফুডস্'}
                  </h1>
                  <p className="text-sm text-slate-700">
                    {sheetData?.companyAddress || 'চট্টগ্রাম, বাংলাদেশ'}
                  </p>
                  <p className="text-xs font-bold text-slate-900 mt-1">
                    মাসিক সেলারি শিট — {getMonthLabel(month)} {year} · বিভাগ:{' '}
                    {sheetData?.departmentName || 'সকল বিভাগ'}
                  </p>
                </div>

                {renderSalaryTable(true)}

                <div className="grid grid-cols-3 gap-8 mt-16 pt-6 text-center text-xs text-slate-800">
                  <div className="border-t border-slate-800 pt-2 font-semibold">
                    প্রস্তুতকারীর স্বাক্ষর
                  </div>
                  <div className="border-t border-slate-800 pt-2 font-semibold">
                    যাচাইকারীর স্বাক্ষর
                  </div>
                  <div className="border-t border-slate-800 pt-2 font-semibold">
                    অনুমোদনকারীর স্বাক্ষর
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
