import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BENGALI_MONTHS, formatTaka } from '../utils/formatters.ts';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import {
  snackPurchaseService,
  advanceService,
  employeeService,
  departmentService,
} from '../services/firebaseServices.ts';

interface DeductionProps {
  onSelectEmployee: (id: number) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SnacksView: React.FC<DeductionProps> = ({ onSelectEmployee, showToast }) => {
  const { apiFetch } = useAuth();
  const [snacksList, setSnacksList] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [empFilter, setEmpFilter] = useState('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(now.toISOString().split('T')[0]);
  const [itemDescription, setItemDescription] = useState('বিকালের নাস্তা');
  const [quantity, setQuantity] = useState('1');
  const [amount, setAmount] = useState('50');
  const [remarks, setRemarks] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [snks, emps, depts] = await Promise.all([
        snackPurchaseService.list(apiFetch),
        employeeService.list(apiFetch),
        departmentService.list(apiFetch),
      ]);
      setSnacksList(snks);
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

  const ymPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const filteredSnacks = useMemo(() => {
    return snacksList.filter((s) => {
      if (!s.date.startsWith(ymPrefix)) return false;
      if (deptFilter !== 'ALL' && String(s.departmentId) !== deptFilter) return false;
      if (empFilter !== 'ALL' && String(s.employeeId) !== empFilter) return false;
      return true;
    });
  }, [snacksList, ymPrefix, deptFilter, empFilter]);

  const totalSnackAmount = filteredSnacks.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await snackPurchaseService.update(apiFetch, editingId, {
          date,
          itemDescription,
          quantity: Number(quantity),
          amount: Number(amount),
          remarks,
        });
        showToast('নাস্তা ক্রয়ের তথ্য আপডেট করা হয়েছে।');
      } else {
        await snackPurchaseService.create(apiFetch, {
          employeeId: Number(employeeId),
          date,
          itemDescription,
          quantity: Number(quantity),
          amount: Number(amount),
          remarks,
        });
        showToast('নাস্তা ক্রয়ের রেকর্ড সফলভাবে সংরক্ষণ করা হয়েছে।');
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
      await snackPurchaseService.remove(apiFetch, deleteTarget.id);
      showToast('নাস্তা ক্রয়ের রেকর্ড মুছে ফেলা হয়েছে।');
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
              নাস্তা ক্রয় ব্যবস্থাপনা (Snack Purchase)
            </h2>
            <p className="text-xs text-slate-500">
              কর্মচারীদের মাসিক নাস্তা ক্রয়ের মোট টাকা স্বয়ংক্রিয়ভাবে পাওনা বেতন থেকে কর্তন করা হয়।
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-1.5 text-right">
              <div className="text-[11px] text-slate-500">নির্বাচিত মাসের মোট নাস্তা</div>
              <div className="text-sm font-bold font-mono-num text-red-600">
                {formatTaka(totalSnackAmount)}
              </div>
            </div>
            <button
              onClick={() => {
                setEditingId(null);
                setEmployeeId(employeesList[0]?.id ? String(employeesList[0].id) : '');
                setDate(new Date().toISOString().split('T')[0]);
                setItemDescription('নাস্তা ক্রয়');
                setQuantity('1');
                setAmount('50');
                setRemarks('');
                setModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>নাস্তা ক্রয় যোগ করুন</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            {BENGALI_MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
          >
            {[2024, 2025, 2026, 2027].map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">লোড হচ্ছে...</div>
        ) : filteredSnacks.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            এই মাসে কোনো নাস্তা ক্রয়ের রেকর্ড পাওয়া যায়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4">কর্মচারী</th>
                  <th className="py-3 px-4">বিভাগ</th>
                  <th className="py-3 px-4">তারিখ</th>
                  <th className="py-3 px-4">আইটেম / বিবরণ</th>
                  <th className="py-3 px-4 text-right">পরিমাণ</th>
                  <th className="py-3 px-4 text-right">টাকার পরিমাণ</th>
                  <th className="py-3 px-4">মন্তব্য</th>
                  <th className="py-3 px-4">যুক্ত করেছেন</th>
                  <th className="py-3 px-4 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSnacks.map((sn) => (
                  <tr key={sn.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onSelectEmployee(sn.employeeId)}
                        className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left"
                      >
                        {sn.employeeName}
                      </button>
                      <div className="text-[11px] font-mono-num text-slate-400">
                        {sn.employeeCode}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{sn.departmentName}</td>
                    <td className="py-3 px-4 font-mono-num text-xs">{sn.date}</td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-800">
                      {sn.itemDescription}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-xs">
                      {sn.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-semibold text-slate-900">
                      {formatTaka(sn.amount)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{sn.remarks || '-'}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{sn.addedByName}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingId(sn.id);
                            setEmployeeId(String(sn.employeeId));
                            setDate(sn.date);
                            setItemDescription(sn.itemDescription);
                            setQuantity(String(sn.quantity));
                            setAmount(String(sn.amount));
                            setRemarks(sn.remarks || '');
                            setModalOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(sn)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
                {editingId ? 'নাস্তা ক্রয় সম্পাদনা করুন' : 'নতুন নাস্তা ক্রয় যুক্ত করুন'}
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
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  আইটেম / বিবরণ (Item/Description) *
                </label>
                <input
                  type="text"
                  required
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">পরিমাণ (Quantity)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">টাকা (Amount ৳) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">মন্তব্য (Remarks)</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
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
        message="আপনি কি নিশ্চিতভাবে এই নাস্তা ক্রয়ের রেকর্ডটি মুছে ফেলতে চান?"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export const AdvancesView: React.FC<DeductionProps> = ({ onSelectEmployee, showToast }) => {
  const { apiFetch } = useAuth();
  const [advancesList, setAdvancesList] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [empFilter, setEmpFilter] = useState('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(now.toISOString().split('T')[0]);
  const [amount, setAmount] = useState('1000');
  const [reason, setReason] = useState('জরুরি পারিবারিক প্রয়োজন');
  const [remarks, setRemarks] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [advs, emps, depts] = await Promise.all([
        advanceService.list(apiFetch),
        employeeService.list(apiFetch),
        departmentService.list(apiFetch),
      ]);
      setAdvancesList(advs);
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

  const ymPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const filteredAdvances = useMemo(() => {
    return advancesList.filter((a) => {
      if (!a.date.startsWith(ymPrefix)) return false;
      if (deptFilter !== 'ALL' && String(a.departmentId) !== deptFilter) return false;
      if (empFilter !== 'ALL' && String(a.employeeId) !== empFilter) return false;
      return true;
    });
  }, [advancesList, ymPrefix, deptFilter, empFilter]);

  const totalAdvanceAmount = filteredAdvances.reduce(
    (sum, a) => sum + Number(a.amount || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await advanceService.update(apiFetch, editingId, {
          date,
          amount: Number(amount),
          reason,
          remarks,
        });
        showToast('অগ্রিম টাকার তথ্য আপডেট করা হয়েছে।');
      } else {
        await advanceService.create(apiFetch, {
          employeeId: Number(employeeId),
          date,
          amount: Number(amount),
          reason,
          remarks,
        });
        showToast('অগ্রিম টাকার রেকর্ড সফলভাবে সংরক্ষণ করা হয়েছে।');
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
      await advanceService.remove(apiFetch, deleteTarget.id);
      showToast('অগ্রিম টাকার রেকর্ড মুছে ফেলা হয়েছে।');
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
              অগ্রিম টাকা ব্যবস্থাপনা (Advance Money)
            </h2>
            <p className="text-xs text-slate-500">
              একজন কর্মচারী মাসে একাধিকবার অগ্রিম নিতে পারেন। মাসের মোট অগ্রিম টাকা স্বয়ংক্রিয়ভাবে বেতন থেকে কর্তন হবে।
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-1.5 text-right">
              <div className="text-[11px] text-slate-500">নির্বাচিত মাসের মোট অগ্রিম</div>
              <div className="text-sm font-bold font-mono-num text-red-600">
                {formatTaka(totalAdvanceAmount)}
              </div>
            </div>
            <button
              onClick={() => {
                setEditingId(null);
                setEmployeeId(employeesList[0]?.id ? String(employeesList[0].id) : '');
                setDate(new Date().toISOString().split('T')[0]);
                setAmount('1000');
                setReason('জরুরি প্রয়োজন');
                setRemarks('');
                setModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>অগ্রিম টাকা যোগ করুন</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            {BENGALI_MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
          >
            {[2024, 2025, 2026, 2027].map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">লোড হচ্ছে...</div>
        ) : filteredAdvances.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            এই মাসে কোনো অগ্রিম টাকার রেকর্ড পাওয়া যায়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4">কর্মচারী</th>
                  <th className="py-3 px-4">বিভাগ</th>
                  <th className="py-3 px-4">তারিখ</th>
                  <th className="py-3 px-4">কারণ</th>
                  <th className="py-3 px-4">মন্তব্য</th>
                  <th className="py-3 px-4 text-right">অগ্রিম টাকা</th>
                  <th className="py-3 px-4">যুক্ত করেছেন</th>
                  <th className="py-3 px-4 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAdvances.map((ad) => (
                  <tr key={ad.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onSelectEmployee(ad.employeeId)}
                        className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left"
                      >
                        {ad.employeeName}
                      </button>
                      <div className="text-[11px] font-mono-num text-slate-400">
                        {ad.employeeCode}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{ad.departmentName}</td>
                    <td className="py-3 px-4 font-mono-num text-xs">{ad.date}</td>
                    <td className="py-3 px-4 text-xs text-slate-800">{ad.reason}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{ad.remarks || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold text-slate-900">
                      {formatTaka(ad.amount)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{ad.addedByName}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingId(ad.id);
                            setEmployeeId(String(ad.employeeId));
                            setDate(ad.date);
                            setAmount(String(ad.amount));
                            setReason(ad.reason);
                            setRemarks(ad.remarks || '');
                            setModalOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(ad)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
                {editingId ? 'অগ্রিম টাকা সম্পাদনা করুন' : 'অগ্রিম টাকা প্রদান রেকর্ড করুন'}
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
                  <label className="block font-semibold text-slate-700 mb-1">তারিখ *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    অগ্রিম টাকা (Amount ৳) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">কারণ (Reason) *</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">মন্তব্য (Remarks)</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
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
        message="আপনি কি নিশ্চিতভাবে এই অগ্রিম টাকার রেকর্ডটি মুছে ফেলতে চান?"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
