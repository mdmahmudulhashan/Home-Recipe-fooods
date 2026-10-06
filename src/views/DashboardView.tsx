import React, { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  CalendarOff,
  Building2,
  Clock,
  Activity,
  Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { getLeaveTypeLabel } from '../utils/formatters.ts';
import { reportService } from '../services/firebaseServices.ts';

interface DashboardViewProps {
  onSelectEmployee: (id: number) => void;
  onNavigate: (module: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectEmployee,
  onNavigate,
}) => {
  const { apiFetch, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    reportService
      .getDashboard(apiFetch)
      .then((res) => setData(res))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiFetch]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        ড্যাশবোর্ডের তথ্য লোড হচ্ছে...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Top Action Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            আজকের সার্বিক উপস্থিতির সারসংক্ষেপ ({data.todayDate})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            সকল সক্রিয় কর্মচারী ডিফল্টভাবে উপস্থিত হিসেবে গণ্য হন; শুধুমাত্র অনুপস্থিতি বা অনুমোদিত ছুটি থাকলে স্ট্যাটাস পরিবর্তিত হয়।
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('absences')}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>অনুপস্থিতি যুক্ত করুন</span>
          </button>
          {user?.role !== 'MANAGER' && (
            <button
              onClick={() => onNavigate('salary')}
              className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              সেলারি শিট দেখুন
            </button>
          )}
        </div>
      </div>

      {/* 6 Primary Stat Cards (Required by Section 6) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>মোট কর্মচারী</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-slate-900 mt-2">
            {data.totalEmployees}
          </div>
          <div className="text-xs text-slate-500 mt-1">সকল নিবন্ধিত কর্মী</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>আজ উপস্থিত</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-emerald-700 mt-2">
            {data.presentToday}
          </div>
          <div className="text-xs text-emerald-700 mt-1">স্বয়ংক্রিয় উপস্থিত</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>আজ অনুপস্থিত</span>
            <UserX className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-red-600 mt-2">
            {data.absentToday}
          </div>
          <div className="text-xs text-red-600 mt-1">আজকের অনুপস্থিতি</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>বর্তমানে ছুটিতে</span>
            <CalendarOff className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-amber-600 mt-2">
            {data.onLeaveToday}
          </div>
          <div className="text-xs text-amber-700 mt-1">অনুমোদিত ছুটি</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Active Employees</span>
            <Users className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-slate-900 mt-2">
            {data.activeEmployees}
          </div>
          <div className="text-xs text-slate-500 mt-1">সক্রিয় কর্মচারী</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Inactive Employees</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-slate-500 mt-2">
            {data.inactiveEmployees}
          </div>
          <div className="text-xs text-slate-500 mt-1">নিষ্ক্রিয়/পদত্যাগ</div>
        </div>
      </div>

      {/* Department-wise Employee & Attendance Summary */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">
              বিভাগভিত্তিক কর্মচারী ও আজকের উপস্থিতির বিবরণ
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono-num">
            মোট বিভাগ: {data.departmentSummary?.length || 0}টি
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
              <tr>
                <th className="py-3 px-6">বিভাগের নাম</th>
                <th className="py-3 px-6 text-right">মোট কর্মচারী</th>
                <th className="py-3 px-6 text-right">সক্রিয় (Active)</th>
                <th className="py-3 px-6 text-right">আজ উপস্থিত</th>
                <th className="py-3 px-6 text-right">আজ অনুপস্থিত</th>
                <th className="py-3 px-6 text-right">আজ ছুটিতে</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.departmentSummary?.map((dept: any) => (
                <tr key={dept.departmentId} className="hover:bg-slate-50">
                  <td className="py-3 px-6 font-medium text-slate-900">
                    {dept.departmentName}
                  </td>
                  <td className="py-3 px-6 text-right font-mono-num">
                    {dept.totalEmployees} জন
                  </td>
                  <td className="py-3 px-6 text-right font-mono-num">
                    {dept.activeEmployees} জন
                  </td>
                  <td className="py-3 px-6 text-right font-mono-num text-emerald-700 font-semibold">
                    {dept.presentToday} জন
                  </td>
                  <td className="py-3 px-6 text-right font-mono-num text-red-600 font-semibold">
                    {dept.absentToday} জন
                  </td>
                  <td className="py-3 px-6 text-right font-mono-num text-amber-600 font-semibold">
                    {dept.onLeaveToday} জন
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom 3 Columns: Recent Leaves, Recent Absences, Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Absences */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">সাম্প্রতিক অনুপস্থিতির রেকর্ড</h3>
            <button
              onClick={() => onNavigate('absences')}
              className="text-xs text-emerald-700 hover:underline font-medium"
            >
              সব দেখুন
            </button>
          </div>
          <div className="p-5 flex-1">
            {data.recentAbsences?.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                কোনো অনুপস্থিতির রেকর্ড নেই।
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentAbsences.map((ab: any) => (
                  <div
                    key={ab.id}
                    className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 last:border-none last:pb-0"
                  >
                    <div>
                      <button
                        onClick={() => onSelectEmployee(ab.employeeId)}
                        className="text-sm font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left"
                      >
                        {ab.employeeName}
                      </button>
                      <p className="text-xs text-slate-500">
                        {ab.departmentName} · {ab.reason}
                      </p>
                    </div>
                    <span className="text-xs font-mono-num text-red-600 font-medium shrink-0">
                      {ab.date}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Leaves */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">সাম্প্রতিক ছুটির রেকর্ড</h3>
            <button
              onClick={() => onNavigate('leaves')}
              className="text-xs text-emerald-700 hover:underline font-medium"
            >
              সব দেখুন
            </button>
          </div>
          <div className="p-5 flex-1">
            {data.recentLeaves?.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                কোনো ছুটির রেকর্ড নেই।
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentLeaves.map((lv: any) => (
                  <div
                    key={lv.id}
                    className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 last:border-none last:pb-0"
                  >
                    <div>
                      <button
                        onClick={() => onSelectEmployee(lv.employeeId)}
                        className="text-sm font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left"
                      >
                        {lv.employeeName}
                      </button>
                      <p className="text-xs text-slate-500">
                        {lv.departmentName} · {getLeaveTypeLabel(lv.leaveType)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono-num text-slate-800">
                        {lv.totalDays} দিন
                      </div>
                      <div className="text-[11px] font-mono-num text-slate-400">
                        {lv.startDate}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">সাম্প্রতিক কার্যক্রম</h3>
            </div>
            {user?.role === 'SUPER_ADMIN' && (
              <button
                onClick={() => onNavigate('activity-logs')}
                className="text-xs text-emerald-700 hover:underline font-medium"
              >
                অডিট লগ
              </button>
            )}
          </div>
          <div className="p-5 flex-1">
            {data.recentActivities?.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                কোনো সাম্প্রতিক কার্যক্রম নেই।
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentActivities.map((act: any) => (
                  <div
                    key={act.id}
                    className="pb-3 border-b border-slate-100 last:border-none last:pb-0"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{act.action}</span>
                      <span className="text-slate-400 font-mono-num">
                        {new Date(act.createdAt).toLocaleDateString('bn-BD')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {act.recordInfo} · <span className="text-slate-400">{act.userName}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
