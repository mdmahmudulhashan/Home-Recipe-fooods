import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import {
  departmentService,
  designationService,
  userManagementService,
} from '../services/firebaseServices.ts';

interface OrgProps {
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const DepartmentsView: React.FC<OrgProps> = ({ showToast }) => {
  const { apiFetch, user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [departments, setDepartments] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [selectedManagerIds, setSelectedManagerIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const depts = await departmentService.list(apiFetch);
      setDepartments(depts);
      if (!isManager) {
        const allUsers = await userManagementService.list(apiFetch);
        setManagers(allUsers.filter((u: any) => u.role === 'MANAGER'));
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setStatus('ACTIVE');
    setSelectedManagerIds([]);
    setModalOpen(true);
  };

  const handleOpenEdit = (dept: any) => {
    setEditingId(dept.id);
    setName(dept.name);
    setDescription(dept.description || '');
    setStatus(dept.status);
    setSelectedManagerIds((dept.assignedManagers || []).map((m: any) => m.id));
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await departmentService.update(apiFetch, editingId, {
          name,
          description,
          status,
          managerIds: selectedManagerIds,
        });
        showToast('বিভাগের তথ্য আপডেট করা হয়েছে।');
      } else {
        await departmentService.create(apiFetch, {
          name,
          description,
          status,
          managerIds: selectedManagerIds,
        });
        showToast('নতুন বিভাগ তৈরি করা হয়েছে।');
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await departmentService.remove(apiFetch, deleteTarget.id);
      showToast('বিভাগ মুছে ফেলা হয়েছে।');
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">বিভাগ ব্যবস্থাপনা (Departments)</h2>
          <p className="text-xs text-slate-500">
            হোম রেসিপি ফুডস্-এর সকল বিভাগ এবং নিযুক্ত ম্যানেজারদের তালিকা
          </p>
        </div>
        {!isManager && (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন বিভাগ যোগ করুন</span>
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">লোড হচ্ছে...</div>
        ) : departments.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">কোনো বিভাগ পাওয়া যায়নি।</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-6">বিভাগের নাম</th>
                  <th className="py-3 px-6">বিবরণ</th>
                  <th className="py-3 px-6">নিযুক্ত ম্যানেজার</th>
                  <th className="py-3 px-6 text-right">কর্মচারী সংখ্যা</th>
                  <th className="py-3 px-6">স্ট্যাটাস</th>
                  {!isManager && <th className="py-3 px-6 text-right">অ্যাকশন</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-6 font-semibold text-slate-900">{dept.name}</td>
                    <td className="py-3.5 px-6 text-slate-600 text-xs">{dept.description || '-'}</td>
                    <td className="py-3.5 px-6 text-xs text-slate-700">
                      {dept.assignedManagers?.length > 0
                        ? dept.assignedManagers.map((m: any) => m.name).join(' · ')
                        : 'কোনো ম্যানেজার নিযুক্ত নেই'}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono-num font-semibold">
                      {dept.employeeCount} জন
                    </td>
                    <td className="py-3.5 px-6 text-xs">
                      <span
                        className={
                          dept.status === 'ACTIVE'
                            ? 'text-emerald-700 font-semibold'
                            : 'text-slate-400'
                        }
                      >
                        {dept.status === 'ACTIVE' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </span>
                    </td>
                    {!isManager && (
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(dept)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(dept)}
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
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'বিভাগ সম্পাদনা করুন' : 'নতুন বিভাগ যোগ করুন'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  বিভাগের নাম *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: Production, Bakery, Sales"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">বিবরণ</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                  <option value="ACTIVE">সক্রিয় (Active)</option>
                  <option value="INACTIVE">নিষ্ক্রিয় (Inactive)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  বিভাগীয় ম্যানেজার নির্ধারণ করুন (একাধিক নির্বাচন করা যাবে)
                </label>
                <div className="border border-slate-200 rounded-lg p-3 space-y-2 max-h-36 overflow-y-auto bg-slate-50">
                  {managers.length === 0 ? (
                    <p className="text-slate-400">কোনো ম্যানেজার অ্যাকাউন্ট নেই।</p>
                  ) : (
                    managers.map((mgr) => (
                      <label key={mgr.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedManagerIds.includes(mgr.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedManagerIds([...selectedManagerIds, mgr.id]);
                            } else {
                              setSelectedManagerIds(
                                selectedManagerIds.filter((id) => id !== mgr.id)
                              );
                            }
                          }}
                          className="rounded border-slate-300 text-emerald-600"
                        />
                        <span className="text-slate-800 font-medium">{mgr.name}</span>
                        <span className="text-slate-400">({mgr.email})</span>
                      </label>
                    ))
                  )}
                </div>
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
                  disabled={submitting}
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
        message={`আপনি কি নিশ্চিতভাবে "${deleteTarget?.name}" বিভাগটি মুছে ফেলতে চান?`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export const DesignationsView: React.FC<OrgProps> = ({ showToast }) => {
  const { apiFetch, user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await designationService.list(apiFetch);
      setDesignations(res);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await designationService.update(apiFetch, editingId, {
          name,
          description,
          status,
        });
        showToast('পদবি আপডেট করা হয়েছে।');
      } else {
        await designationService.create(apiFetch, {
          name,
          description,
          status,
        });
        showToast('নতুন পদবি যুক্ত করা হয়েছে।');
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
      await designationService.remove(apiFetch, deleteTarget.id);
      showToast('পদবি মুছে ফেলা হয়েছে।');
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">পদবি ব্যবস্থাপনা (Designations)</h2>
          <p className="text-xs text-slate-500">প্রতিষ্ঠানের সকল পদবির তালিকা ও কর্মচারী সংখ্যা</p>
        </div>
        {!isManager && (
          <button
            onClick={() => {
              setEditingId(null);
              setName('');
              setDescription('');
              setStatus('ACTIVE');
              setModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন পদবি যোগ করুন</span>
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">লোড হচ্ছে...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-6">পদবির নাম</th>
                  <th className="py-3 px-6">বিবরণ</th>
                  <th className="py-3 px-6 text-right">কর্মচারী সংখ্যা</th>
                  <th className="py-3 px-6">স্ট্যাটাস</th>
                  {!isManager && <th className="py-3 px-6 text-right">অ্যাকশন</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {designations.map((ds) => (
                  <tr key={ds.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-6 font-semibold text-slate-900">{ds.name}</td>
                    <td className="py-3.5 px-6 text-xs text-slate-600">{ds.description || '-'}</td>
                    <td className="py-3.5 px-6 text-right font-mono-num font-semibold">
                      {ds.employeeCount} জন
                    </td>
                    <td className="py-3.5 px-6 text-xs">
                      <span
                        className={
                          ds.status === 'ACTIVE'
                            ? 'text-emerald-700 font-semibold'
                            : 'text-slate-400'
                        }
                      >
                        {ds.status === 'ACTIVE' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </span>
                    </td>
                    {!isManager && (
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingId(ds.id);
                              setName(ds.name);
                              setDescription(ds.description || '');
                              setStatus(ds.status);
                              setModalOpen(true);
                            }}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(ds)}
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
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'পদবি সম্পাদনা করুন' : 'নতুন পদবি যোগ করুন'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">পদবির নাম *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: Supervisor, Salesman, Worker"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">বিবরণ</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                  <option value="ACTIVE">সক্রিয় (Active)</option>
                  <option value="INACTIVE">নিষ্ক্রিয় (Inactive)</option>
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
        message={`আপনি কি নিশ্চিতভাবে "${deleteTarget?.name}" পদবিটি মুছে ফেলতে চান?`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
