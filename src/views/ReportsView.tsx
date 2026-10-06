import React, { useEffect, useState } from 'react';
import { Printer, FileBarChart, Building2, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BENGALI_MONTHS, formatTaka, getMonthLabel } from '../utils/formatters.ts';
import { reportService } from '../services/firebaseServices.ts';

interface ReportsViewProps {
  onSelectEmployee: (id: number) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  onSelectEmployee,
  showToast,
}) => {
  const { apiFetch } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [reportTab, setReportTab] = useState<'department' | 'monthly' | 'employee'>(
    'department'
  );
  const [selectedDeptId, setSelectedDeptId] = useState('ALL');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportService
      .getReports(apiFetch, year, month)
      .then((res) => setData(res))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [year, month, apiFetch]);

  const summary = data?.overallSummary || {};
  const deptReports = data?.departmentReports || [];
  const empCalcs = (data?.employeeCalculations || []).filter((e: any) =>
    selectedDeptId === 'ALL' ? true : String(e.departmentId) === selectedDeptId
  );

  return (
    <div className="space-y-6">
      {/* Filter & Tab Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              আর্থিক ও উপস্থিতি রিপোর্ট (HR & Financial Reports)
            </h2>
            <p className="text-xs text-slate-500">
              বিভাগভিত্তিক, মাসিক এবং কর্মচারীভিত্তিক পূর্ণাঙ্গ বেতন ও কর্তন বিবরণী
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
          >
            <Printer className="w-4 h-4" />
            <span>রিপোর্ট প্রিন্ট / PDF</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setReportTab('department')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                reportTab === 'department'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              বিভাগভিত্তিক রিপোর্ট
            </button>
            <button
              onClick={() => setReportTab('monthly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                reportTab === 'monthly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              মাসিক সার্বিক রিপোর্ট
            </button>
            <button
              onClick={() => setReportTab('employee')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                reportTab === 'employee'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              কর্মচারীভিত্তিক রিপোর্ট
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {BENGALI_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
            >
              {[2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            {reportTab !== 'department' && (
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="ALL">সকল বিভাগ</option>
                {deptReports.map((d: any) => (
                  <option key={d.departmentId} value={String(d.departmentId)}>
                    {d.departmentName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">মোট বেতন (Gross)</div>
          <div className="text-lg font-bold font-mono-num text-slate-900 mt-1">
            {formatTaka(summary.totalGrossSalary)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">মোট ওভারটাইম</div>
          <div className="text-lg font-bold font-mono-num text-emerald-700 mt-1">
            {formatTaka(summary.totalOvertimePay)}
          </div>
          <div className="text-[11px] font-mono-num text-slate-400">
            {summary.totalOvertimeDays || 0} দিন
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">মোট বোনাস</div>
          <div className="text-lg font-bold font-mono-num text-slate-900 mt-1">
            {formatTaka(summary.totalBonus)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">মোট অগ্রিম কর্তন</div>
          <div className="text-lg font-bold font-mono-num text-red-600 mt-1">
            {formatTaka(summary.totalAdvance)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">মোট নাস্তা কর্তন</div>
          <div className="text-lg font-bold font-mono-num text-red-600 mt-1">
            {formatTaka(summary.totalSnack)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">সর্বমোট পাওনা বেতন</div>
          <div className="text-lg font-bold font-mono-num text-emerald-700 mt-1">
            {formatTaka(summary.totalPayableSalary)}
          </div>
        </div>
      </div>

      {/* Report Content Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 print-container">
        <div className="border-b border-slate-200 pb-4 mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              হোম রেসিপি ফুডস্ —{' '}
              {reportTab === 'department'
                ? 'বিভাগভিত্তিক আর্থিক প্রতিবেদন'
                : reportTab === 'monthly'
                ? 'মাসিক বেতন ও ওভারটাইম প্রতিবেদন'
                : 'কর্মচারীভিত্তিক বিস্তারিত প্রতিবেদন'}
            </h3>
            <p className="text-xs text-slate-500">
              মাস: {getMonthLabel(month)} {year} · চট্টগ্রাম, বাংলাদেশ
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">রিপোর্ট লোড হচ্ছে...</div>
        ) : reportTab === 'department' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm print-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4">বিভাগের নাম</th>
                  <th className="py-3 px-4 text-right">মোট কর্মচারী</th>
                  <th className="py-3 px-4 text-right">মোট ওভারটাইম</th>
                  <th className="py-3 px-4 text-right">মোট বোনাস</th>
                  <th className="py-3 px-4 text-right">মোট বেতন (Gross)</th>
                  <th className="py-3 px-4 text-right">মোট অগ্রিম</th>
                  <th className="py-3 px-4 text-right">মোট নাস্তা ক্রয়</th>
                  <th className="py-3 px-4 text-right">মোট পাওনা বেতন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono-num text-xs">
                {deptReports.map((d: any) => (
                  <tr key={d.departmentId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900">
                      {d.departmentName}
                    </td>
                    <td className="py-3 px-4 text-right">{d.totalEmployees} জন</td>
                    <td className="py-3 px-4 text-right text-emerald-700">
                      {formatTaka(d.totalOvertimePay)} ({d.totalOvertimeDays} দিন)
                    </td>
                    <td className="py-3 px-4 text-right">{formatTaka(d.totalBonus)}</td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {formatTaka(d.totalGrossSalary)}
                    </td>
                    <td className="py-3 px-4 text-right text-red-600">
                      {formatTaka(d.totalAdvance)}
                    </td>
                    <td className="py-3 px-4 text-right text-red-600">
                      {formatTaka(d.totalSnack)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatTaka(d.totalPayableSalary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm print-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-3">কর্মচারী</th>
                  <th className="py-3 px-3">বিভাগ</th>
                  <th className="py-3 px-3 text-right">উপস্থিত দিন</th>
                  <th className="py-3 px-3 text-right">অনুপস্থিত</th>
                  <th className="py-3 px-3 text-right">ছুটি</th>
                  <th className="py-3 px-3 text-right">শুক্রবার OT</th>
                  <th className="py-3 px-3 text-right">মোট বেতন</th>
                  <th className="py-3 px-3 text-right">অগ্রিম</th>
                  <th className="py-3 px-3 text-right">নাস্তা</th>
                  <th className="py-3 px-3 text-right">পাওনা বেতন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono-num text-xs">
                {empCalcs.map((c: any) => (
                  <tr key={c.employeeId} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-sans">
                      <button
                        onClick={() => onSelectEmployee(c.employeeId)}
                        className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left"
                      >
                        {c.fullName}
                      </button>
                      <div className="text-[11px] font-mono-num text-slate-400">
                        {c.employeeCode}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-600">{c.departmentName}</td>
                    <td className="py-3 px-3 text-right">{c.regularPaidDays}</td>
                    <td className="py-3 px-3 text-right text-red-600">{c.totalAbsenceDays}</td>
                    <td className="py-3 px-3 text-right text-amber-600">
                      {c.approvedPaidLeaveDays + c.approvedUnpaidLeaveDays}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700">
                      {c.fridayOvertimeDays} ({formatTaka(c.overtimePay)})
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">
                      {formatTaka(c.grossSalary)}
                    </td>
                    <td className="py-3 px-3 text-right text-red-600">
                      {formatTaka(c.totalAdvance)}
                    </td>
                    <td className="py-3 px-3 text-right text-red-600">
                      {formatTaka(c.totalSnack)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {formatTaka(c.payableSalary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
