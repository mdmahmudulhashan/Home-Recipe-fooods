import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { getLeaveTypeLabel } from '../utils/formatters.ts';
import { calculateLeaveDaysCount, isFridayDate } from '../shared/salaryEngine.ts';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import {
  leaveService,
  absenceService,
  employeeService,
  departmentService,
} from '../services/firebaseServices.ts';

interface AttendanceProps {
  onSelectEmployee: (id: number) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const LeavesView: React.FC<AttendanceProps> = ({ onSelectEmployee, showToast }) => {
  const { apiFetch, user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [leavesList, setLeavesList] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [empFilter, setEmpFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'ALL' | 'CURRENT'>('ALL');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [leaveType, setLeaveType] = useState('Casual');
  const [isPaid, setIsPaid] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('Approved');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lvs, emps, depts] = await Promise.all([
        leaveService.list(apiFetch),
        employeeService.list(apiFetch),
        departmentService.list(apiFetch),
      ]);
      setLeavesList(lvs);
      setEmployeesList(emps);
      setDepartmentsList(depts);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredLeaves = useMemo(() => {
    return leavesList.filter((l) => {
      if (empFilter !== 'ALL' && String(l.employeeId) !== empFilter) return false;
      if (deptFilter !== 'ALL' && String(l.departmentId) !== deptFilter) return false;
      if (viewMode === 'CURRENT') {
        return l.status === 'Approved' && todayStr >= l.startDate && todayStr <= l.endDate;
      }
      return true;
    });
  }, [leavesList, empFilter, deptFilter, viewMode, todayStr]);

  const computedDays = calculateLeaveDaysCount(startDate, endDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await leaveService.update(apiFetch, editingId, {
          leaveType,
          isPaid,
          startDate,
          endDate,
          reason,
          status,
        });
        showToast('ছুটির তথ্য আপডেট করা হয়েছে।');
      } else {
        await leaveService.create(apiFetch, {
          employeeId: Number(employeeId),
          leaveType,
          isPaid,
          startDate,
          endDate,
          reason,
          status,
        });
        showToast('নতুন ছুটির রেকর্ড সংরক্ষণ করা হয়েছে।');
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await leaveService.remove(apiFetch, deleteTarget.id);
      showToast('ছুটির রেকর্ড মুছে ফেলা হয়েছে।');
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">ছুটি ব্যবস্থাপনা (Leave Management)</h2>
            <p className="text-xs text-slate-500">
              অনুমোদিত ছুটি কখনোই অনুপস্থিতি হিসেবে গণ্য হবে না। তবে শুক্রবারে ছুটি থাকলে সেদিনের ওভারটাইম যুক্ত হবে না।
            </p>
          </div>
          {!isManager && (
            <button
              onClick={() => {
                setEditingId(null);
                setEmployeeId(employeesList[0]?.id ? String(employeesList[0].id) : '');
                setLeaveType('Casual');
                setIsPaid(true);
                setStartDate(todayStr);
                setEndDate(todayStr);
                setReason('');
                setStatus('Approved');
                setModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>ছুটি যোগ করুন</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setViewMode('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              সকল ছুটির ইতিহাস
            </button>
            <button
              onClick={() => setViewMode('CURRENT')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'CURRENT'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              বর্তমানে ছুটিতে থাকা কর্মচারী
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">সকল বিভাগ</option>
              {departmentsList.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={empFilter}
              onChange={(e) => setEmpFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">সকল কর্মচারী</option>
              {employeesList.map((e) => (
                <option key={e.id} value={String(e.id)}>
                  {e.fullName} ({e.employeeCode})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">লোড হচ্ছে...</div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">কোনো ছুটির রেকর্ড পাওয়া যায়নি।</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4">কর্মচারীর নাম</th>
                  <th className="py-3 px-4">বিভাগ</th>
                  <th className="py-3 px-4">ছুটির ধরন</th>
                  <th className="py-3 px-4">শুরুর তারিখ</th>
                  <th className="py-3 px-4">শেষ তারিখ</th>
                  <th className="py-3 px-4 text-right">মোট দিন</th>
                  <th className="py-3 px-4">কারণ</th>
                  <th className="py-3 px-4">স্ট্যাটাস</th>
                  <th className="py-3 px-4">যুক্ত করেছেন</th>
                  {!isManager && <th className="py-3 px-4 text-right">অ্যাকশন</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLeaves.map((lv) => (
                  <tr key={lv.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onSelectEmployee(lv.employeeId)}
                        className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left"
                      >
                        {lv.employeeName}
                      </button>
                      <div className="text-[11px] font-mono-num text-slate-400">
                        {lv.employeeCode}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{lv.departmentName}</td>
                    <td className="py-3 px-4 text-xs">
                      <div>{getLeaveTypeLabel(lv.leaveType)}</div>
                      <div className="text-[11px] text-slate-400">
                        {lv.isPaid ? 'সবেতন ছুটি (Paid)' : 'বিনা বেতনে (Unpaid)'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono-num text-xs">{lv.startDate}</td>
                    <td className="py-3 px-4 font-mono-num text-xs">{lv.endDate}</td>
                    <td className="py-3 px-4 text-right font-mono-num font-semibold">
                      {lv.totalDays} দিন
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{lv.reason}</td>
                    <td className="py-3 px-4 text-xs">
                      <span
                        className={
                          lv.status === 'Approved'
                            ? 'text-emerald-700 font-semibold'
                            : lv.status === 'Rejected'
                            ? 'text-red-600 font-semibold'
                            : 'text-amber-600 font-semibold'
                        }
                      >
                        {lv.status === 'Approved'
                          ? 'অনুমোদিত'
                          : lv.status === 'Rejected'
                          ? 'বাতিল'
                          : 'অপেক্ষমাণ'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{lv.addedByName}</td>
                    {!isManager && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingId(lv.id);
                              setEmployeeId(String(lv.employeeId));
                              setLeaveType(lv.leaveType);
                              setIsPaid(lv.isPaid);
                              setStartDate(lv.startDate);
                              setEndDate(lv.endDate);
                              setReason(lv.reason);
                              setStatus(lv.status);
                              setModalOpen(true);
                            }}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(lv)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'ছুটির রেকর্ড সম্পাদনা করুন' : 'নতুন ছুটি যোগ করুন'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
              {!editingId && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">কর্মচারী *</label>
                  <select
                    required
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">নির্বাচন করুন</option>
                    {employeesList.map((emp) => (
                      <option key={emp.id} value={String(emp.id)}>
                        {emp.fullName} ({emp.employeeCode}) - {emp.departmentName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ছুটির ধরন *</label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Casual">Casual (নৈমিত্তিক)</option>
                    <option value="Sick">Sick (অসুস্থতাজনিত)</option>
                    <option value="Annual">Annual (বার্ষিক)</option>
                    <option value="Emergency">Emergency (জরুরি)</option>
                    <option value="Other">Other (অন্যান্য)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">বেতন সমন্বয়</label>
                  <select
                    value={isPaid ? 'PAID' : 'UNPAID'}
                    onChange={(e) => setIsPaid(e.target.value === 'PAID')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="PAID">সবেতন ছুটি (Paid Leave)</option>
                    <option value="UNPAID">বিনা বেতনে ছুটি (Unpaid Leave)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">শুরুর তারিখ *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">শেষ তারিখ *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                <span className="text-slate-600">স্বয়ংক্রিয় হিসাবকৃত মোট ছুটির দিন:</span>
                <span className="font-mono-num font-bold text-slate-900 text-sm">
                  {computedDays} দিন
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ছুটির কারণ *</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">স্ট্যাটাস</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Approved">Approved (অনুমোদিত)</option>
                  <option value="Pending">Pending (অপেক্ষমাণ)</option>
                  <option value="Rejected">Rejected (বাতিল)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        message="আপনি কি নিশ্চিতভাবে এই ছুটির রেকর্ডটি মুছে ফেলতে চান?"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export const AbsencesView: React.FC<AttendanceProps> = ({ onSelectEmployee, showToast }) => {
  const { apiFetch, user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [absencesList, setAbsencesList] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [deptFilter, setDeptFilter] = useState('ALL');
  const [empFilter, setEmpFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [abs, emps, depts] = await Promise.all([
        absenceService.list(apiFetch),
        employeeService.list(apiFetch),
        departmentService.list(apiFetch),
      ]);
      setAbsencesList(abs);
      setEmployeesList(emps);
      setDepartmentsList(depts);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAbsences = useMemo(() => {
    return absencesList.filter((a) => {
      if (deptFilter !== 'ALL' && String(a.departmentId) !== deptFilter) return false;
      if (empFilter !== 'ALL' && String(a.employeeId) !== empFilter) return false;
      if (dateFilter && a.date !== dateFilter) return false;
      return true;
    });
  }, [absencesList, deptFilter, empFilter, dateFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await absenceService.update(apiFetch, editingId, { date, reason });
        showToast('অনুপস্থিতির রেকর্ড আপডেট করা হয়েছে।');
      } else {
        await absenceService.create(apiFetch, {
          employeeId: Number(employeeId),
          date,
          reason: reason || 'অনুপস্থিত',
        });
        showToast('অনুপস্থিতি সফলভাবে লিপিবদ্ধ করা হয়েছে।');
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await absenceService.remove(apiFetch, deleteTarget.id);
      showToast('অনুপস্থিতির রেকর্ড মুছে ফেলা হয়েছে।');
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              অনুপস্থিত ব্যবস্থাপনা (Absence Management)
            </h2>
            <p className="text-xs text-slate-500">
              সক্রিয় কর্মচারীগণ ডিফল্টভাবে উপস্থিত থাকেন। শুধুমাত্র অনুপস্থিত হলে এখানে রেকর্ড যোগ করুন (শুক্রবার অনুপস্থিত থাকলে ওভারটাইম কাটা যাবে)।
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setEmployeeId(employeesList[0]?.id ? String(employeesList[0].id) : '');
              setDate(new Date().toISOString().split('T')[0]);
              setReason('ব্যক্তিগত কারণে অনুপস্থিত');
              setModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>অনুপস্থিতি যুক্ত করুন</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">সকল বিভাগ</option>
            {departmentsList.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={empFilter}
            onChange={(e) => setEmpFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">সকল কর্মচারী</option>
            {employeesList.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.fullName} ({e.employeeCode})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="px-2.5 py-2 text-xs text-slate-600 bg-slate-100 rounded-lg"
              >
                সব
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">লোড হচ্ছে...</div>
        ) : filteredAbsences.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            কোনো অনুপস্থিতির রেকর্ড পাওয়া যায়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4">কর্মচারী</th>
                  <th className="py-3 px-4">বিভাগ</th>
                  <th className="py-3 px-4">তারিখ</th>
                  <th className="py-3 px-4">বার / ওভারটাইম প্রভাব</th>
                  <th className="py-3 px-4">কারণ</th>
                  <th className="py-3 px-4">যুক্ত করেছেন</th>
                  <th className="py-3 px-4">সময়</th>
                  {!isManager && <th className="py-3 px-4 text-right">অ্যাকশন</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAbsences.map((ab) => {
                  const isFri = isFridayDate(ab.date);
                  return (
                    <tr key={ab.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onSelectEmployee(ab.employeeId)}
                          className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left"
                        >
                          {ab.employeeName}
                        </button>
                        <div className="text-[11px] font-mono-num text-slate-400">
                          {ab.employeeCode}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{ab.departmentName}</td>
                      <td className="py-3 px-4 font-mono-num text-xs font-semibold text-red-600">
                        {ab.date}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {isFri ? (
                          <span className="text-amber-700 font-medium">
                            শুক্রবার (১টি ওভারটাইম কর্তন)
                          </span>
                        ) : (
                          <span className="text-slate-600">
                            সাধারণ কর্মদিবস (১ দিন উপস্থিতি কর্তন)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">{ab.reason}</td>
                      <td className="py-3 px-4 text-xs text-slate-500">{ab.addedByName}</td>
                      <td className="py-3 px-4 text-xs font-mono-num text-slate-400">
                        {new Date(ab.createdAt).toLocaleString('bn-BD')}
                      </td>
                      {!isManager && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingId(ab.id);
                                setEmployeeId(String(ab.employeeId));
                                setDate(ab.date);
                                setReason(ab.reason);
                                setModalOpen(true);
                              }}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(ab)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'অনুপস্থিতি সম্পাদনা করুন' : 'অনুপস্থিতি রেকর্ড যুক্ত করুন'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
              {!editingId && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">কর্মচারী *</label>
                  <select
                    required
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">নির্বাচন করুন</option>
                    {employeesList.map((emp) => (
                      <option key={emp.id} value={String(emp.id)}>
                        {emp.fullName} ({emp.employeeCode}) - {emp.departmentName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">তারিখ *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                />
                {isFridayDate(date) && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    নির্বাচিত তারিখটি শুক্রবার। এই তারিখে অনুপস্থিত থাকলে উক্ত কর্মচারীর ১টি শুক্রবারের ওভারটাইম কমে যাবে।
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">কারণ *</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="যেমন: অসুস্থতা বা না জানিয়ে অনুপস্থিত"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        message="আপনি কি নিশ্চিতভাবে এই অনুপস্থিতির রেকর্ডটি মুছে ফেলতে চান?"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
