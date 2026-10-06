import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  MapPin,
  Briefcase,
  FileText,
  Clock,
  Wallet,
  Coffee,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { employeeService } from '../services/firebaseServices.ts';
import {
  formatTaka,
  getEmploymentStatusLabel,
  getLeaveTypeLabel,
  getMonthLabel,
} from '../utils/formatters.ts';

interface EmployeeProfileModalProps {
  employeeId: number | null;
  onClose: () => void;
}

export const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({
  employeeId,
  onClose,
}) => {
  const { apiFetch, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'leaves' | 'absences' | 'advances' | 'snacks' | 'salary'
  >('overview');

  const isManager = user?.role === 'MANAGER';

  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    setError('');
    setActiveTab('overview');

    employeeService
      .getProfile(apiFetch, employeeId)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err.message || 'প্রোফাইল লোড করতে সমস্যা হয়েছে।');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [employeeId, apiFetch]);

  if (!employeeId) return null;

  const emp = data?.employee;
  const calc = data?.currentMonthCalculation;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">কর্মচারীর বিস্তারিত প্রোফাইল</h2>
            <p className="text-xs text-slate-500">
              হোম রেসিপি ফুডস্ · চট্টগ্রাম, বাংলাদেশ
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="py-12 text-center text-slate-500">
              কর্মচারীর তথ্য লোড হচ্ছে...
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && emp && (
            <div className="space-y-6">
              {/* Top Identity Summary */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                <div className="flex items-center gap-4">
                  {emp.photoUrl ? (
                    <img
                      src={emp.photoUrl}
                      alt={emp.fullName}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xl">
                      {emp.fullName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">{emp.fullName}</h3>
                      <span className="text-xs font-mono-num text-slate-500">
                        · {emp.employeeCode}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {emp.designationName} · {emp.departmentName} বিভাগ
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span>{getEmploymentStatusLabel(emp.employmentStatus)}</span>
                      <span>·</span>
                      <span>{emp.employmentType}</span>
                      <span>·</span>
                      <span>
                        আজকের অবস্থা:{' '}
                        <strong
                          className={
                            emp.todayStatus === 'PRESENT'
                              ? 'text-emerald-700'
                              : emp.todayStatus === 'ABSENT'
                              ? 'text-red-600'
                              : 'text-amber-600'
                          }
                        >
                          {emp.todayStatus === 'PRESENT'
                            ? 'উপস্থিত'
                            : emp.todayStatus === 'ABSENT'
                            ? 'অনুপস্থিত'
                            : emp.todayStatus === 'LEAVE'
                            ? 'ছুটিতে'
                            : 'নিষ্ক্রিয়'}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {!isManager && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-right">
                    <div className="text-xs text-slate-500">মূল বেতন ({emp.salaryType})</div>
                    <div className="text-lg font-bold font-mono-num text-slate-900">
                      {formatTaka(emp.basicSalary)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      মাসিক বোনাস: <span className="font-mono-num">{formatTaka(emp.monthlyBonus)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Tabs */}
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    activeTab === 'overview'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  সাধারণ তথ্য
                </button>
                <button
                  onClick={() => setActiveTab('leaves')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    activeTab === 'leaves'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ছুটির ইতিহাস ({data.leaves?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('absences')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    activeTab === 'absences'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  অনুপস্থিতির ইতিহাস ({data.absences?.length || 0})
                </button>

                {!isManager && (
                  <>
                    <button
                      onClick={() => setActiveTab('advances')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        activeTab === 'advances'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      অগ্রিম টাকা ({data.advances?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('snacks')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        activeTab === 'snacks'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      নাস্তা ক্রয় ({data.snacks?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('salary')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        activeTab === 'salary'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      বেতন ও ওভারটাইম হিসাব
                    </button>
                  </>
                )}
              </div>

              {/* Tab Content: Overview */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
                      ব্যক্তিগত ও যোগাযোগের তথ্য
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-2">
                          <User className="w-4 h-4" /> Employee ID
                        </span>
                        <span className="font-mono-num font-medium text-slate-900">
                          {emp.employeeCode}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-2">
                          <Phone className="w-4 h-4" /> মোবাইল নম্বর
                        </span>
                        <span className="font-mono-num font-medium text-slate-900">
                          {emp.mobile}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-2">
                          <Mail className="w-4 h-4" /> Email
                        </span>
                        <span className="text-slate-900">{emp.email || 'প্রদান করা হয়নি'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-2">
                          <CreditCard className="w-4 h-4" /> NID নম্বর
                        </span>
                        <span className="font-mono-num text-slate-900">
                          {emp.nid || 'প্রদান করা হয়নি'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-2">
                          <Calendar className="w-4 h-4" /> জন্ম তারিখ
                        </span>
                        <span className="font-mono-num text-slate-900">
                          {emp.dateOfBirth || 'প্রদান করা হয়নি'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
                      চাকরি ও ঠিকানা সংক্রান্ত তথ্য
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-2">
                          <Briefcase className="w-4 h-4" /> বিভাগ ও পদবি
                        </span>
                        <span className="font-medium text-slate-900">
                          {emp.departmentName} · {emp.designationName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-2">
                          <Clock className="w-4 h-4" /> যোগদানের তারিখ
                        </span>
                        <span className="font-mono-num text-slate-900">{emp.joiningDate}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500 flex items-center gap-2 shrink-0">
                          <MapPin className="w-4 h-4" /> বর্তমান ঠিকানা
                        </span>
                        <span className="text-slate-900 text-right">
                          {emp.currentAddress || 'প্রদান করা হয়নি'}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500 flex items-center gap-2 shrink-0">
                          <MapPin className="w-4 h-4" /> স্থায়ী ঠিকানা
                        </span>
                        <span className="text-slate-900 text-right">
                          {emp.permanentAddress || 'প্রদান করা হয়নি'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Leaves */}
              {activeTab === 'leaves' && (
                <div>
                  {data.leaves?.length === 0 ? (
                    <p className="text-sm text-slate-500 py-8 text-center">
                      কোনো ছুটির রেকর্ড পাওয়া যায়নি।
                    </p>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <tr>
                            <th className="py-2.5 px-4">ছুটির ধরন</th>
                            <th className="py-2.5 px-4">শুরুর তারিখ</th>
                            <th className="py-2.5 px-4">শেষ তারিখ</th>
                            <th className="py-2.5 px-4 text-right">মোট দিন</th>
                            <th className="py-2.5 px-4">কারণ</th>
                            <th className="py-2.5 px-4">অবস্থা</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {data.leaves.map((lv: any) => (
                            <tr key={lv.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-medium">
                                {getLeaveTypeLabel(lv.leaveType)}
                              </td>
                              <td className="py-2.5 px-4 font-mono-num">{lv.startDate}</td>
                              <td className="py-2.5 px-4 font-mono-num">{lv.endDate}</td>
                              <td className="py-2.5 px-4 text-right font-mono-num">
                                {lv.totalDays} দিন
                              </td>
                              <td className="py-2.5 px-4 text-slate-600">{lv.reason}</td>
                              <td className="py-2.5 px-4">{lv.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Absences */}
              {activeTab === 'absences' && (
                <div>
                  {data.absences?.length === 0 ? (
                    <p className="text-sm text-slate-500 py-8 text-center">
                      কোনো অনুপস্থিতির রেকর্ড পাওয়া যায়নি।
                    </p>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <tr>
                            <th className="py-2.5 px-4">তারিখ</th>
                            <th className="py-2.5 px-4">কারণ</th>
                            <th className="py-2.5 px-4">যুক্ত করেছেন</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {data.absences.map((ab: any) => (
                            <tr key={ab.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-mono-num font-medium">
                                {ab.date}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600">{ab.reason}</td>
                              <td className="py-2.5 px-4 text-slate-500">{ab.addedByName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Advances (Admin / Super Admin Only) */}
              {!isManager && activeTab === 'advances' && (
                <div>
                  {data.advances?.length === 0 ? (
                    <p className="text-sm text-slate-500 py-8 text-center">
                      কোনো অগ্রিম টাকার রেকর্ড পাওয়া যায়নি।
                    </p>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <tr>
                            <th className="py-2.5 px-4">তারিখ</th>
                            <th className="py-2.5 px-4">কারণ</th>
                            <th className="py-2.5 px-4">মন্তব্য</th>
                            <th className="py-2.5 px-4 text-right">পরিমাণ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {data.advances.map((ad: any) => (
                            <tr key={ad.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-mono-num">{ad.date}</td>
                              <td className="py-2.5 px-4">{ad.reason}</td>
                              <td className="py-2.5 px-4 text-slate-500">{ad.remarks}</td>
                              <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-slate-900">
                                {formatTaka(ad.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Snacks (Admin / Super Admin Only) */}
              {!isManager && activeTab === 'snacks' && (
                <div>
                  {data.snacks?.length === 0 ? (
                    <p className="text-sm text-slate-500 py-8 text-center">
                      কোনো নাস্তা ক্রয়ের রেকর্ড পাওয়া যায়নি।
                    </p>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <tr>
                            <th className="py-2.5 px-4">তারিখ</th>
                            <th className="py-2.5 px-4">বিবরণ</th>
                            <th className="py-2.5 px-4 text-right">পরিমাণ (সংখ্যা)</th>
                            <th className="py-2.5 px-4 text-right">টাকা</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {data.snacks.map((sn: any) => (
                            <tr key={sn.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-mono-num">{sn.date}</td>
                              <td className="py-2.5 px-4">{sn.itemDescription}</td>
                              <td className="py-2.5 px-4 text-right font-mono-num">
                                {sn.quantity}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-num font-semibold">
                                {formatTaka(sn.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Live Salary & Overtime Calculation */}
              {!isManager && activeTab === 'salary' && calc && (
                <div className="space-y-6">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-slate-900 mb-3">
                      চলতি মাসের স্বয়ংক্রিয় বেতন ও শুক্রবার ওভারটাইম হিসাব ({getMonthLabel(calc.month)}{' '}
                      {calc.year})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-slate-500">দৈনিক বেতন (Basic/30)</div>
                        <div className="font-mono-num font-semibold text-slate-900">
                          {formatTaka(calc.dailySalary)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">নিয়মিত উপস্থিত দিন</div>
                        <div className="font-mono-num font-semibold text-slate-900">
                          {calc.regularPaidDays} দিন
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">শুক্রবার ওভারটাইম</div>
                        <div className="font-mono-num font-semibold text-emerald-700">
                          {calc.fridayOvertimeDays} দিন ({formatTaka(calc.overtimePay)})
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">মোট কর্মদিবস (Total Days)</div>
                        <div className="font-mono-num font-bold text-slate-900">
                          {calc.totalDays} দিন
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">মোট বেতন (Gross Salary)</div>
                        <div className="font-mono-num font-semibold text-slate-900">
                          {formatTaka(calc.grossSalary)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">অগ্রিম কর্তন</div>
                        <div className="font-mono-num font-semibold text-red-600">
                          - {formatTaka(calc.totalAdvance)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">নাস্তা ক্রয় কর্তন</div>
                        <div className="font-mono-num font-semibold text-red-600">
                          - {formatTaka(calc.totalSnack)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">পাওনা বেতন (Payable)</div>
                        <div className="font-mono-num font-bold text-emerald-700 text-base">
                          {formatTaka(calc.payableSalary)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Saved Salary History */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">
                      সংরক্ষিত বেতন ইতিহাস
                    </h4>
                    {data.salaryHistory?.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        পূর্বে সংরক্ষিত কোনো সেলারি শিট রেকর্ড নেই।
                      </p>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <tr>
                              <th className="py-2 px-3">মাস/বছর</th>
                              <th className="py-2 px-3 text-right">মোট দিন</th>
                              <th className="py-2 px-3 text-right">ওভারটাইম</th>
                              <th className="py-2 px-3 text-right">মোট বেতন</th>
                              <th className="py-2 px-3 text-right">অগ্রিম</th>
                              <th className="py-2 px-3 text-right">নাস্তা</th>
                              <th className="py-2 px-3 text-right">পাওনা বেতন</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-mono-num">
                            {data.salaryHistory.map((sr: any) => (
                              <tr key={sr.id}>
                                <td className="py-2 px-3">
                                  {getMonthLabel(sr.month)} {sr.year}
                                </td>
                                <td className="py-2 px-3 text-right">{sr.totalDays}</td>
                                <td className="py-2 px-3 text-right">{sr.fridayOvertimeDays}</td>
                                <td className="py-2 px-3 text-right">
                                  {formatTaka(sr.grossSalary)}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {formatTaka(sr.totalAdvance)}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {formatTaka(sr.totalSnack)}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                  {formatTaka(sr.payableSalary)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
