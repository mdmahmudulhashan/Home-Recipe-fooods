import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Edit2, X, Shield, KeyRound, Save, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { getRoleLabel } from '../utils/formatters.ts';
import {
  userManagementService,
  departmentService,
  activityLogService,
  settingsService,
  authService,
} from '../services/firebaseServices.ts';

interface AdminViewProps {
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

// ============================================================================
// 1. USER PERMISSIONS VIEW (Strictly Super Admin Only)
// ============================================================================
export const UsersPermissionView: React.FC<AdminViewProps> = ({ showToast }) => {
  const { apiFetch } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'MANAGER'>('MANAGER');
  const [assignedDepartmentIds, setAssignedDepartmentIds] = useState<number[]>([]);
  const [status, setStatus] = useState('ACTIVE');

  const loadData = async () => {
    setLoading(true);
    try {
      const [usrs, depts] = await Promise.all([
        userManagementService.list(apiFetch),
        departmentService.list(apiFetch),
      ]);
      setUsersList(usrs);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await userManagementService.update(apiFetch, editingId, {
          name,
          email,
          role,
          assignedDepartmentIds: role === 'MANAGER' ? assignedDepartmentIds : [],
          status,
          newPassword: password || undefined,
        });
        showToast('ব্যবহারকারীর অনুমতি ও তথ্য সফলভাবে আপডেট করা হয়েছে।');
      } else {
        await userManagementService.create(apiFetch, {
          name,
          email,
          password,
          role,
          assignedDepartmentIds: role === 'MANAGER' ? assignedDepartmentIds : [],
          status,
        });
        showToast('নতুন ব্যবহারকারী সফলভাবে তৈরি করা হয়েছে।');
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            ইউজার পারমিশন ও রোল ব্যবস্থাপনা (User Permissions)
          </h2>
          <p className="text-xs text-slate-500">
            শুধুমাত্র সুপার অ্যাডমিন নতুন অ্যাডমিন/ম্যানেজার তৈরি এবং বিভাগভিত্তিক পারমিশন নির্ধারণ করতে পারেন।
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setName('');
            setEmail('');
            setPassword('123456');
            setRole('MANAGER');
            setAssignedDepartmentIds([]);
            setStatus('ACTIVE');
            setModalOpen(true);
          }}
          className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন ইউজার তৈরি করুন</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">লোড হচ্ছে...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-6">নাম (Name)</th>
                  <th className="py-3 px-6">Email</th>
                  <th className="py-3 px-6">রোল (Role)</th>
                  <th className="py-3 px-6">নির্ধারিত বিভাগ (Assigned Department)</th>
                  <th className="py-3 px-6">স্ট্যাটাস</th>
                  <th className="py-3 px-6 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-6 font-semibold text-slate-900">{u.name}</td>
                    <td className="py-3.5 px-6 font-mono-num text-xs text-slate-600">
                      {u.email}
                    </td>
                    <td className="py-3.5 px-6 text-xs font-semibold text-slate-800">
                      {getRoleLabel(u.role)}
                    </td>
                    <td className="py-3.5 px-6 text-xs text-slate-600">
                      {u.role === 'MANAGER'
                        ? u.assignedDepartmentNames?.length > 0
                          ? u.assignedDepartmentNames.join(' · ')
                          : 'কোনো বিভাগ নির্ধারিত নেই'
                        : 'সকল বিভাগ (Full Access)'}
                    </td>
                    <td className="py-3.5 px-6 text-xs">
                      <span
                        className={
                          u.status === 'ACTIVE'
                            ? 'text-emerald-700 font-semibold'
                            : 'text-red-600 font-semibold'
                        }
                      >
                        {u.status === 'ACTIVE' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => {
                          setEditingId(u.id);
                          setName(u.name);
                          setEmail(u.email);
                          setPassword('');
                          setRole(u.role);
                          setAssignedDepartmentIds(u.assignedDepartmentIds || []);
                          setStatus(u.status);
                          setModalOpen(true);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>পারমিশন ও পাসওয়ার্ড</span>
                      </button>
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
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'ইউজার পারমিশন ও পাসওয়ার্ড রিসেট' : 'নতুন ইউজার তৈরি করুন'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">নাম *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    রোল (Role) *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="MANAGER">Manager (বিভাগীয় ম্যানেজার)</option>
                    <option value="ADMIN">Admin (এইচআর অ্যাডমিন)</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
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
              </div>

              {role === 'MANAGER' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    ম্যানেজারের জন্য অনুমোদিত বিভাগসমূহ নির্বাচন করুন:
                  </label>
                  <div className="border border-slate-200 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto bg-slate-50">
                    {departmentsList.map((dept) => (
                      <label key={dept.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignedDepartmentIds.includes(dept.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignedDepartmentIds([...assignedDepartmentIds, dept.id]);
                            } else {
                              setAssignedDepartmentIds(
                                assignedDepartmentIds.filter((id) => id !== dept.id)
                              );
                            }
                          }}
                          className="rounded border-slate-300 text-emerald-600"
                        />
                        <span className="font-medium text-slate-800">{dept.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {editingId
                    ? 'নতুন পাসওয়ার্ড রিসেট করুন (পরিবর্তন না করতে চাইলে ফাঁকা রাখুন)'
                    : 'প্রাথমিক পাসওয়ার্ড *'}
                </label>
                <input
                  type="password"
                  required={!editingId}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষর"
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
    </div>
  );
};

// ============================================================================
// 2. ACTIVITY LOGS VIEW (Strictly Super Admin Only)
// ============================================================================
export const ActivityLogsView: React.FC<AdminViewProps> = ({ showToast }) => {
  const { apiFetch } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [userSearch, setUserSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    activityLogService
      .list(apiFetch)
      .then((res) => setLogs(res))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [apiFetch]);

  const modules = useMemo(() => {
    const s = new Set<string>();
    logs.forEach((l) => s.add(l.module));
    return Array.from(s);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (moduleFilter !== 'ALL' && l.module !== moduleFilter) return false;
      if (userSearch) {
        const q = userSearch.toLowerCase();
        const match =
          l.userName.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.recordInfo.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (dateFilter) {
        const logDate = new Date(l.createdAt).toISOString().split('T')[0];
        if (logDate !== dateFilter) return false;
      }
      return true;
    });
  }, [logs, moduleFilter, userSearch, dateFilter]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            সিস্টেম অ্যাক্টিভিটি ও অডিট লগ (Activity Log)
          </h2>
          <p className="text-xs text-slate-500">
            সিস্টেমের সকল গুরুত্বপূর্ণ পরিবর্তন স্বয়ংক্রিয়ভাবে এখানে লিপিবদ্ধ হয়। অডিট লগ কেউ মুছে ফেলতে বা পরিবর্তন করতে পারে না।
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="ইউজার, অ্যাকশন বা রেকর্ড দিয়ে খুঁজুন..."
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
          />

          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">সকল মডিউল (All Modules)</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">লোড হচ্ছে...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            কোনো অ্যাক্টিভিটি লগ পাওয়া যায়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4">তারিখ ও সময়</th>
                  <th className="py-3 px-4">ব্যবহারকারী ও রোল</th>
                  <th className="py-3 px-4">মডিউল</th>
                  <th className="py-3 px-4">অ্যাকশন</th>
                  <th className="py-3 px-4">রেকর্ড / কর্মচারী</th>
                  <th className="py-3 px-4">পূর্বের মান → নতুন মান</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono-num text-slate-500 whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString('bn-BD')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{l.userName}</div>
                      <div className="text-[11px] text-slate-400">{l.userRole}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">{l.module}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-700">{l.action}</td>
                    <td className="py-3 px-4 text-slate-800">{l.recordInfo}</td>
                    <td className="py-3 px-4 font-mono-num text-[11px] text-slate-500 max-w-xs truncate">
                      {l.previousValue ? `পূর্ব: ${l.previousValue} | ` : ''}
                      {l.newValue ? `নতুন: ${l.newValue}` : '-'}
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

// ============================================================================
// 3. SETTINGS VIEW (Password Change for all + Company Config for Super Admin)
// ============================================================================
export const SettingsView: React.FC<AdminViewProps> = ({ showToast }) => {
  const { apiFetch, user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const [companyName, setCompanyName] = useState('হোম রেসিপি ফুডস্');
  const [companyAddress, setCompanyAddress] = useState('চট্টগ্রাম, বাংলাদেশ');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [standardMonthDays, setStandardMonthDays] = useState(30);
  const [fridayOvertimeEnabled, setFridayOvertimeEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    settingsService
      .get(apiFetch)
      .then((res) => {
        setCompanyName(res.companyName || 'হোম রেসিপি ফুডস্');
        setCompanyAddress(res.companyAddress || 'চট্টগ্রাম, বাংলাদেশ');
        setCompanyPhone(res.companyPhone || '');
        setCompanyEmail(res.companyEmail || '');
        setStandardMonthDays(res.standardMonthDays || 30);
        setFridayOvertimeEnabled(res.fridayOvertimeEnabled !== false);
      })
      .catch(() => {});
  }, [apiFetch]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('নতুন পাসওয়ার্ড এবং নিশ্চিতকরণ পাসওয়ার্ড মিলছে না।', 'error');
      return;
    }
    setChangingPass(true);
    try {
      const res = await authService.changePassword(
        apiFetch,
        currentPassword,
        newPassword
      );
      showToast(res.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setChangingPass(false);
    }
  };

  const handleSaveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await settingsService.update(apiFetch, {
        companyName,
        companyAddress,
        companyPhone,
        companyEmail,
        standardMonthDays,
        fridayOvertimeEnabled,
      });
      showToast('কোম্পানি ও বেতন সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে।');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Password Change Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
          <KeyRound className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">পাসওয়ার্ড পরিবর্তন করুন</h3>
            <p className="text-xs text-slate-500">আপনার অ্যাকাউন্টের নিরাপত্তা নিশ্চিত করুন</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4 mt-5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              বর্তমান পাসওয়ার্ড (Current Password) *
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              নতুন পাসওয়ার্ড (New Password) *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              নতুন পাসওয়ার্ড নিশ্চিত করুন (Confirm New Password) *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={changingPass}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
          >
            {changingPass ? 'পরিবর্তন হচ্ছে...' : 'পাসওয়ার্ড আপডেট করুন'}
          </button>
        </form>
      </div>

      {/* Super Admin Company & Calculation Settings */}
      {isSuperAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
            <Shield className="w-5 h-5 text-slate-800" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                প্রতিষ্ঠান ও বেতন ক্যালকুলেশন সেটিংস (Super Admin)
              </h3>
              <p className="text-xs text-slate-500">
                সেলারি শিট এবং প্রিন্ট হেডারের জন্য প্রতিষ্ঠানের তথ্য
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveCompanySettings} className="space-y-4 mt-5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                প্রতিষ্ঠানের নাম (Company Name)
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                প্রতিষ্ঠানের ঠিকানা (Company Address)
              </label>
              <input
                type="text"
                required
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ফোন নম্বর</label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  মাসিক বেতন গণনার আদর্শ দিন (Default 30)
                </label>
                <input
                  type="number"
                  min={28}
                  max={31}
                  value={standardMonthDays}
                  onChange={(e) => setStandardMonthDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fridayOvertimeEnabled}
                    onChange={(e) => setFridayOvertimeEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span className="font-semibold text-slate-800">
                    শুক্রবার স্বয়ংক্রিয় ওভারটাইম সক্রিয়
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
