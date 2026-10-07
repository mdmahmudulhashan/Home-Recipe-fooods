import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  X,
  ArrowUpDown,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { formatTaka, getEmploymentStatusLabel } from '../utils/formatters.ts';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import {
  employeeService,
  departmentService,
  designationService,
} from '../services/firebaseServices.ts';

interface EmployeesViewProps {
  onSelectEmployee: (id: number) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const initialForm = {
  employeeCode: '',
  fullName: '',
  photoUrl: '',
  mobile: '',
  email: '',
  nid: '',
  dateOfBirth: '',
  joiningDate: new Date().toISOString().split('T')[0],
  departmentId: '',
  designationId: '',
  employmentType: 'Full Time',
  employmentStatus: 'Active',
  basicSalary: '12000',
  salaryType: 'Monthly',
  monthlyBonus: '500',
  currentAddress: '',
  permanentAddress: '',
};

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  onSelectEmployee,
  showToast,
}) => {
  const { apiFetch, user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [designationsList, setDesignationsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [desigFilter, setDesigFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'joiningDate'>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Add/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [emps, depts, desigs] = await Promise.all([
        employeeService.list(apiFetch),
        departmentService.list(apiFetch),
        designationService.list(apiFetch),
      ]);
      setEmployeesList(emps);
      setDepartmentsList(depts);
      setDesignationsList(desigs);
    } catch (err: any) {
      showToast(err.message || 'তথ্য লোড করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredEmployees = useMemo(() => {
    return employeesList
      .filter((emp) => {
        const q = search.trim().toLowerCase();
        if (q) {
          const match =
            emp.fullName.toLowerCase().includes(q) ||
            emp.employeeCode.toLowerCase().includes(q) ||
            emp.mobile.toLowerCase().includes(q) ||
            (emp.nid && emp.nid.toLowerCase().includes(q));
          if (!match) return false;
        }
        if (deptFilter !== 'ALL' && String(emp.departmentId) !== deptFilter) return false;
        if (desigFilter !== 'ALL' && String(emp.designationId) !== desigFilter) return false;
        if (statusFilter !== 'ALL' && emp.employmentStatus !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        let valA = a.employeeCode;
        let valB = b.employeeCode;
        if (sortBy === 'name') {
          valA = a.fullName;
          valB = b.fullName;
        } else if (sortBy === 'joiningDate') {
          valA = a.joiningDate;
          valB = b.joiningDate;
        }
        return sortOrder === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
  }, [employeesList, search, deptFilter, desigFilter, statusFilter, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const paginatedEmployees = filteredEmployees.slice((page - 1) * pageSize, page * pageSize);

  const handleOpenAdd = () => {
    const nextCode = `HRF-${1001 + employeesList.length}`;
    setEditingId(null);
    setFormData({
      ...initialForm,
      employeeCode: nextCode,
      departmentId: departmentsList[0]?.id ? String(departmentsList[0].id) : '',
      designationId: designationsList[0]?.id ? String(designationsList[0].id) : '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (emp: any) => {
    setEditingId(emp.id);
    setFormData({
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      photoUrl: emp.photoUrl || '',
      mobile: emp.mobile,
      email: emp.email || '',
      nid: emp.nid || '',
      dateOfBirth: emp.dateOfBirth || '',
      joiningDate: emp.joiningDate,
      departmentId: String(emp.departmentId),
      designationId: String(emp.designationId),
      employmentType: emp.employmentType,
      employmentStatus: emp.employmentStatus,
      basicSalary: String(emp.basicSalary ?? 0),
      salaryType: emp.salaryType || 'Monthly',
      monthlyBonus: String(emp.monthlyBonus ?? 0),
      currentAddress: emp.currentAddress || '',
      permanentAddress: emp.permanentAddress || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await employeeService.update(apiFetch, editingId, formData);
        showToast('কর্মচারীর তথ্য সফলভাবে আপডেট করা হয়েছে।');
      } else {
        await employeeService.create(apiFetch, formData);
        showToast('নতুন কর্মচারী সফলভাবে যুক্ত করা হয়েছে।');
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'সংরক্ষণ ব্যর্থ হয়েছে।', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const targetToDelete = deleteTarget;
    setDeleting(true);
    try {
      await employeeService.remove(apiFetch, targetToDelete);
      setEmployeesList((prev) => prev.filter((e) => e.id !== targetToDelete.id));
      setDeleteTarget(null);
      showToast('কর্মচারীর তথ্য ফায়ারবেস থেকে সফলভাবে মুছে ফেলা হয়েছে।');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'মুছে ফেলতে সমস্যা হয়েছে।', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">কর্মচারী ব্যবস্থাপনা</h2>
            <p className="text-xs text-slate-500">
              যেকোনো কর্মচারীর নামের উপর ক্লিক করে বিস্তারিত প্রোফাইল ও রেকর্ড দেখুন
            </p>
          </div>
          {!isManager && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>কর্মচারী যোগ করুন</span>
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="নাম, Employee ID, মোবাইল বা NID দিয়ে খুঁজুন..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">সকল বিভাগ (Department)</option>
            {departmentsList.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={desigFilter}
            onChange={(e) => {
              setDesigFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">সকল পদবি (Designation)</option>
            {designationsList.map((ds) => (
              <option key={ds.id} value={String(ds.id)}>
                {ds.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">সকল স্ট্যাটাস (Status)</option>
            <option value="Active">সক্রিয় (Active)</option>
            <option value="Inactive">নিষ্ক্রিয় (Inactive)</option>
            <option value="Resigned">পদত্যাগ (Resigned)</option>
            <option value="Terminated">চাকরিচ্যুত (Terminated)</option>
          </select>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            কর্মচারীদের তালিকা লোড হচ্ছে...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-600">কোনো কর্মচারী পাওয়া যায়নি</p>
            {!isManager && (
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>কর্মচারী যোগ করুন</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                  <tr>
                    <th className="py-3 px-4">
                      <button
                        onClick={() => {
                          setSortBy('code');
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        }}
                        className="flex items-center gap-1 font-semibold hover:text-slate-900 whitespace-nowrap"
                      >
                        <span>Employee ID</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        onClick={() => {
                          setSortBy('name');
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        }}
                        className="flex items-center gap-1 font-semibold hover:text-slate-900 whitespace-nowrap"
                      >
                        <span>নাম ও ছবি</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">বিভাগ</th>
                    <th className="py-3 px-4 whitespace-nowrap">পদবি</th>
                    <th className="py-3 px-4 whitespace-nowrap">মোবাইল</th>
                    <th className="py-3 px-4 whitespace-nowrap">NID / Email</th>
                    <th className="py-3 px-4 whitespace-nowrap">যোগদানের তারিখ</th>
                    <th className="py-3 px-4 whitespace-nowrap">স্ট্যাটাস</th>
                    {!isManager && (
                      <th className="py-3 px-4 text-right whitespace-nowrap">Basic Salary</th>
                    )}
                    <th className="py-3 px-4 text-right whitespace-nowrap">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono-num text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {emp.employeeCode}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {emp.photoUrl ? (
                            <img
                              src={emp.photoUrl}
                              alt={emp.fullName}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
                              {emp.fullName.charAt(0)}
                            </div>
                          )}
                          <button
                            onClick={() => onSelectEmployee(emp.id)}
                            className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left"
                          >
                            {emp.fullName}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {emp.departmentName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {emp.designationName}
                      </td>
                      <td className="py-3 px-4 font-mono-num text-xs text-slate-700 whitespace-nowrap">
                        {emp.mobile}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        <div className="font-mono-num">{emp.nid || '-'}</div>
                        <div className="text-[11px] text-slate-400">{emp.email || ''}</div>
                      </td>
                      <td className="py-3 px-4 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                        {emp.joiningDate}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <span
                          className={
                            emp.employmentStatus === 'Active'
                              ? 'text-emerald-700 font-semibold'
                              : 'text-slate-500'
                          }
                        >
                          {getEmploymentStatusLabel(emp.employmentStatus)}
                        </span>
                      </td>
                      {!isManager && (
                        <td className="py-3 px-4 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                          {formatTaka(emp.basicSalary)}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onSelectEmployee(emp.id)}
                            title="প্রোফাইল দেখুন"
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-md"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!isManager && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(emp)}
                                title="সম্পাদনা করুন"
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(emp)}
                                title="মুছে ফেলুন"
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>
                মোট <span className="font-mono-num font-semibold">{filteredEmployees.length}</span> জন
                কর্মচারীর মধ্যে পৃষ্ঠা <span className="font-mono-num">{page}</span> /{' '}
                <span className="font-mono-num">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50"
                >
                  পূর্ববর্তী
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50"
                >
                  পরবর্তী
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Employee Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'কর্মচারীর তথ্য সম্পাদনা করুন' : 'নতুন কর্মচারী যোগ করুন'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Employee ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employeeCode}
                    onChange={(e) =>
                      setFormData({ ...formData, employeeCode: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    পূর্ণ নাম (Full Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    মোবাইল নম্বর *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    NID নম্বর
                  </label>
                  <input
                    type="text"
                    value={formData.nid}
                    onChange={(e) => setFormData({ ...formData, nid: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    জন্ম তারিখ (Date of Birth)
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) =>
                      setFormData({ ...formData, dateOfBirth: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    যোগদানের তারিখ (Joining Date) *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.joiningDate}
                    onChange={(e) =>
                      setFormData({ ...formData, joiningDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    প্রোফাইল ছবি আপলোড (ঐচ্ছিক)
                  </label>
                  <div className="flex items-center gap-3">
                    {formData.photoUrl ? (
                      <div className="relative w-10 h-10 shrink-0">
                        <img
                          src={formData.photoUrl}
                          alt="Preview"
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-lg object-cover border border-slate-300"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, photoUrl: '' })}
                          title="ছবি মুছে ফেলুন"
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px]"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                        <Upload className="w-4 h-4" />
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer">
                      <span className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium flex items-center justify-center gap-1.5 transition-colors">
                        <Upload className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{formData.photoUrl ? 'ছবি পরিবর্তন করুন' : 'ছবি নির্বাচন করুন'}</span>
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            showToast('ছবির সাইজ সর্বোচ্চ ২ মেগাবাইট (2MB) হতে পারবে।', 'error');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              setFormData((prev) => ({
                                ...prev,
                                photoUrl: reader.result as string,
                              }));
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    বিভাগ (Department) *
                  </label>
                  <select
                    required
                    value={formData.departmentId}
                    onChange={(e) =>
                      setFormData({ ...formData, departmentId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">নির্বাচন করুন</option>
                    {departmentsList.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    পদবি (Designation) *
                  </label>
                  <select
                    required
                    value={formData.designationId}
                    onChange={(e) =>
                      setFormData({ ...formData, designationId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">নির্বাচন করুন</option>
                    {designationsList.map((ds) => (
                      <option key={ds.id} value={String(ds.id)}>
                        {ds.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    চাকরির ধরন (Employment Type)
                  </label>
                  <select
                    value={formData.employmentType}
                    onChange={(e) =>
                      setFormData({ ...formData, employmentType: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Full Time">Full Time</option>
                    <option value="Part Time">Part Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Temporary">Temporary</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    চাকরির অবস্থা (Employment Status)
                  </label>
                  <select
                    value={formData.employmentStatus}
                    onChange={(e) =>
                      setFormData({ ...formData, employmentStatus: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Resigned">Resigned</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    বেতনের ধরন (Salary Type)
                  </label>
                  <select
                    value={formData.salaryType}
                    onChange={(e) =>
                      setFormData({ ...formData, salaryType: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Monthly">Monthly (মাসিক)</option>
                    <option value="Daily">Daily (দৈনিক)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    মূল বেতন (Basic Salary ৳) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.basicSalary}
                    onChange={(e) =>
                      setFormData({ ...formData, basicSalary: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    মাসিক বোনাস (Monthly Bonus ৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.monthlyBonus}
                    onChange={(e) =>
                      setFormData({ ...formData, monthlyBonus: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>

                <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      বর্তমান ঠিকানা (Current Address)
                    </label>
                    <input
                      type="text"
                      value={formData.currentAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, currentAddress: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      স্থায়ী ঠিকানা (Permanent Address)
                    </label>
                    <input
                      type="text"
                      value={formData.permanentAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, permanentAddress: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        message={`আপনি কি নিশ্চিতভাবে "${deleteTarget?.fullName}"-এর তথ্য মুছে ফেলতে চান?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
