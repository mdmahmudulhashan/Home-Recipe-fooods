import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  IdCard,
  CreditCard,
  Settings as SettingsIcon,
  LayoutDashboard,
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Building2,
  Briefcase,
  Upload,
  Trash2,
  X,
  ExternalLink,
  ChevronRight,
  Layers,
  FileText,
  UserCheck,
  Users,
  SlidersHorizontal,
  Image as ImageIcon,
  Check,
  Lock,
  Sparkles,
  LayoutGrid,
  List,
  QrCode,
  Copy,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  employeeService,
  departmentService,
  designationService,
  idCardService,
} from '../services/firebaseServices.ts';
import {
  IdCardPreview,
  IdCardEmployeeData,
} from '../components/IdCardPreview.tsx';
import { HomeRecipeLogo } from '../components/HomeRecipeLogo.tsx';
import { OptimizedImageUploader } from '../components/OptimizedImageUploader.tsx';
import {
  CloudIdCardSettings,
  DEFAULT_ID_CARD_SETTINGS,
  DEFAULT_ID_CARD_TERMS,
} from '../services/standaloneFirestoreEngine.ts';
import {
  downloadIdCardPdf,
  downloadBulkIdCardPdf,
  downloadA4SheetIdCardPdf,
  injectIdCardPrintStyles,
  removeIdCardPrintStyles,
  BulkExportItem,
} from '../utils/idCardExport.ts';
import {
  buildOfflineIdCardData,
  formatOfflineQrPayloadJson,
  generateOfflineQrDataUrl,
} from '../utils/offlineQrCode.ts';

interface IdCardViewsProps {
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onSelectEmployee?: (id: number) => void;
  initialTab?: 'dashboard' | 'all' | 'settings';
}

export const IdCardViews: React.FC<IdCardViewsProps> = ({
  showToast,
  onSelectEmployee,
  initialTab = 'dashboard',
}) => {
  const { apiFetch, user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isManager = user?.role === 'MANAGER';

  const [activeTab, setActiveTab] = useState<'dashboard' | 'all' | 'settings'>(initialTab);

  // Data States
  const [employeesList, setEmployeesList] = useState<IdCardEmployeeData[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [designationsList, setDesignationsList] = useState<any[]>([]);
  const [idSettings, setIdSettings] = useState<CloudIdCardSettings>(DEFAULT_ID_CARD_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Search & Filter for All Cards Table
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [desigFilter, setDesigFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // View mode for All Cards (Table or Grid of Cards)
  const [cardsViewMode, setCardsViewMode] = useState<'table' | 'cards'>('table');

  // Dashboard Live Prototype Preview State
  const [dashboardPreviewSide, setDashboardPreviewSide] = useState<'both' | 'front' | 'back'>('front');
  const [dashboardEmployeeIndex, setDashboardEmployeeIndex] = useState(0);

  // Selected for Bulk Export
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Card Preview Modal State
  const [previewEmployee, setPreviewEmployee] = useState<IdCardEmployeeData | null>(null);
  const [previewSide, setPreviewSide] = useState<'both' | 'front' | 'back'>('both');
  // Print & PDF Studio Modal State
  const [showPrintStudioModal, setShowPrintStudioModal] = useState(false);
  const [printEmployees, setPrintEmployees] = useState<IdCardEmployeeData[]>([]);
  const [printSide, setPrintSide] = useState<'both' | 'front' | 'back'>('both');
  const [printLayoutFormat, setPrintLayoutFormat] = useState<'cr80' | 'a4'>('cr80');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showDuplexHelp, setShowDuplexHelp] = useState(false);

  // 100% Offline QR Code Inspector & Testing Modal State
  const [inspectQrEmployee, setInspectQrEmployee] = useState<IdCardEmployeeData | null>(null);
  const [inspectQrDataUrl, setInspectQrDataUrl] = useState<string>('');
  const [copiedJson, setCopiedJson] = useState(false);
  const [simulatorActive, setSimulatorActive] = useState(false);

  const openOfflineQrModal = (emp: IdCardEmployeeData) => {
    setInspectQrEmployee(emp);
    setCopiedJson(false);
    setSimulatorActive(false);
    const payload = buildOfflineIdCardData(emp, idSettings);
    generateOfflineQrDataUrl(payload, { width: 320, margin: 2 }).then(setInspectQrDataUrl);
  };


  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<CloudIdCardSettings>(DEFAULT_ID_CARD_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);

  // Hidden print & export refs
  const exportCardRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [emps, depts, desigs, settingsData] = await Promise.all([
        employeeService.list(apiFetch),
        departmentService.list(apiFetch),
        designationService.list(apiFetch),
        idCardService.getSettings(apiFetch),
      ]);

      const formattedEmployees: IdCardEmployeeData[] = emps.map((e: any) => ({
        id: e.id,
        employeeCode: e.employeeCode || e.employeeId || `HRF-${e.id}`,
        fullName: e.fullName || e.name || 'কর্মচারী',
        photoUrl: e.photoUrl || e.profilePhotoUrl || '',
        mobile: e.mobile || '',
        emergencyContact: e.emergencyContact || '',
        bloodGroup: e.bloodGroup || 'A+',
        email: e.email || '',
        departmentName: e.departmentName || '',
        designationName: e.designationName || '',
        joiningDate: e.joiningDate || '',
        currentAddress: e.currentAddress || '',
        permanentAddress: e.permanentAddress || '',
        employmentStatus: e.employmentStatus || 'Active',
      }));

      setEmployeesList(formattedEmployees);
      setDepartmentsList(depts);
      setDesignationsList(desigs);

      if (settingsData && settingsData.companyName) {
        setIdSettings(settingsData);
        setSettingsForm(settingsData);
      }
    } catch (err: any) {
      showToast(err.message || 'আইডি কার্ড ডেটা লোড করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    return employeesList.filter((emp) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const match =
          emp.fullName.toLowerCase().includes(q) ||
          emp.employeeCode.toLowerCase().includes(q) ||
          emp.mobile.toLowerCase().includes(q) ||
          (emp.bloodGroup && emp.bloodGroup.toLowerCase().includes(q));
        if (!match) return false;
      }

      if (deptFilter !== 'ALL' && emp.departmentName !== deptFilter) return false;
      if (desigFilter !== 'ALL' && emp.designationName !== desigFilter) return false;

      if (statusFilter !== 'ALL') {
        const isAct = emp.employmentStatus === 'Active';
        if (statusFilter === 'ACTIVE' && !isAct) return false;
        if (statusFilter === 'INACTIVE' && isAct) return false;
      }

      return true;
    });
  }, [employeesList, search, deptFilter, desigFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const paginatedEmployees = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, page]);

  // Dashboard Metrics
  const metrics = useMemo(() => {
    const total = employeesList.length;
    const active = employeesList.filter((e) => e.employmentStatus === 'Active').length;
    const inactive = employeesList.filter((e) => e.employmentStatus !== 'Active').length;
    const withPhoto = employeesList.filter((e) => Boolean(e.photoUrl)).length;
    const generated = total; // All employees have auto-generated cards from DB

    return {
      total,
      generated,
      active,
      inactive,
      withPhoto,
      needsPhoto: total - withPhoto,
    };
  }, [employeesList]);


  // Handle Save Settings
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isSuperAdmin) {
      showToast('শুধুমাত্র সুপার অ্যাডমিন আইডি কার্ড সেটিংস পরিবর্তন করতে পারবেন।', 'error');
      return;
    }

    setSavingSettings(true);
    try {
      const saved = await idCardService.updateSettings(apiFetch, settingsForm);
      setIdSettings(saved);
      setSettingsForm(saved);
      showToast('আইডি কার্ডের সেটিংস সফলভাবে ক্লাউড ফায়ারবেসে সংরক্ষিত হয়েছে।', 'success');
    } catch (err: any) {
      showToast(err.message || 'সেটিংস সংরক্ষণ ব্যর্থ হয়েছে।', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Dedicated Save Logo Handler for Super Admin (Quick Save)
  const handleSaveLogo = async (newLogoUrl?: string) => {
    if (!isSuperAdmin) {
      showToast('শুধুমাত্র সুপার অ্যাডমিন কোম্পানির লোগো পরিবর্তন ও সংরক্ষণ করতে পারবেন।', 'error');
      return;
    }

    setSavingLogo(true);
    try {
      const updatedConfig = {
        ...settingsForm,
        companyLogo: typeof newLogoUrl !== 'undefined' ? newLogoUrl : settingsForm.companyLogo,
      };
      const saved = await idCardService.updateSettings(apiFetch, updatedConfig);
      setIdSettings(saved);
      setSettingsForm(saved);
      showToast('কোম্পানি লোগো সফলভাবে সংরক্ষিত হয়েছে এবং সব আইডি কার্ডে গ্লোবালি আপডেট করা হয়েছে।', 'success');
    } catch (err: any) {
      showToast(err.message || 'লোগো সংরক্ষণ ব্যর্থ হয়েছে।', 'error');
    } finally {
      setSavingLogo(false);
    }
  };

  // Open Print & PDF Studio Modal
  const openPrintStudio = (
    employees: IdCardEmployeeData[],
    preferredSide: 'both' | 'front' | 'back' = 'both'
  ) => {
    if (employees.length === 0) {
      showToast('অনুগ্রহ করে অন্তত একজন কর্মচারী নির্বাচন করুন।', 'error');
      return;
    }
    setPrintEmployees(employees);
    setPrintSide(preferredSide);
    setShowPrintStudioModal(true);
  };

  // Direct In-Browser Print Execution (with dynamic CSS @page injection)
  const handleExecuteDirectPrint = () => {
    setIsPrinting(true);
    injectIdCardPrintStyles(printLayoutFormat);

    setTimeout(() => {
      const handleAfterPrint = () => {
        removeIdCardPrintStyles();
        setIsPrinting(false);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
      window.addEventListener('afterprint', handleAfterPrint);

      window.print();

      // Fallback cleanup in case afterprint does not fire
      setTimeout(() => {
        removeIdCardPrintStyles();
        setIsPrinting(false);
      }, 1500);
    }, 250);
  };

  // High-Resolution Lossless PDF Export (CR80 or A4 Sheet)
  const handleExecutePdfDownload = async (format: 'cr80' | 'a4') => {
    if (printEmployees.length === 0) return;
    setGeneratingPdf(true);
    setPdfProgress({ current: 0, total: printEmployees.length });

    try {
      // Allow off-screen DOM to ensure QR codes are fully generated and rendered
      await new Promise((r) => setTimeout(r, 400));

      const items: BulkExportItem[] = printEmployees.map((emp) => ({
        employee: emp,
        frontElement: document.getElementById(`export-card-${emp.id}-front`),
        backElement: document.getElementById(`export-card-${emp.id}-back`),
      }));

      if (format === 'cr80') {
        if (items.length === 1) {
          await downloadIdCardPdf(items[0].frontElement, items[0].backElement, items[0].employee, printSide);
          showToast(`আইডি কার্ডের CR80 PDF ডাউনলোড সম্পন্ন হয়েছে (${items[0].employee.employeeCode})`, 'success');
        } else {
          await downloadBulkIdCardPdf(items, printSide, (current, total) => {
            setPdfProgress({ current, total });
          });
          showToast(`${items.length} জন কর্মচারীর বাল্ক CR80 PDF ডাউনলোড সম্পন্ন হয়েছে।`, 'success');
        }
      } else {
        // A4 Sheet Grid Layout
        await downloadA4SheetIdCardPdf(items, printSide, (current, total) => {
          setPdfProgress({ current, total });
        });
        showToast(`${items.length} জন কর্মচারীর A4 Sheet PDF ডাউনলোড সম্পন্ন হয়েছে।`, 'success');
      }
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      showToast('পিডিএফ তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।', 'error');
    } finally {
      setGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  // Toggle Bulk Selection
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedEmployees.map((e) => e.id));
    }
  };

  const toggleSelectEmployee = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
            <IdCard className="w-6 h-6 text-[#ea580c]" />
            <h1>এমপ্লয়ি আইডি কার্ড ম্যানেজমেন্ট সিস্টেম</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            হোম রেসিপি ফুডস্ এর অফিসিয়াল স্ট্যান্ডার্ড CR80 ফরম্যাট (54mm × 85.6mm) স্বয়ংক্রিয় কার্ড জেনারেটর
          </p>
        </div>

        {/* Navigation Actions */}
        <div className="flex flex-wrap items-center gap-2.5">

          {/* Tab Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-[#ea580c]" />
              <span>আইডি কার্ড ড্যাশবোর্ড</span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4 text-[#ea580c]" />
              <span>সকল কর্মচারীর আইডি কার্ড</span>
            </button>

            {!isManager && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
                  activeTab === 'settings'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <SettingsIcon className="w-4 h-4 text-[#ea580c]" />
                <span>আইডি কার্ড সেটিংস</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: ID CARD DASHBOARD */}
      {/* ===================================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Key Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Employees */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  মোট কর্মচারী
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono-num mt-1">
                  {metrics.total}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">ডাটাবেজে নিবন্ধিত</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* Total Generated */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-[#ea580c] uppercase tracking-wider">
                  স্বয়ংক্রিয় তৈরি হয়েছে
                </div>
                <div className="text-2xl font-black text-[#ea580c] font-mono-num mt-1">
                  {metrics.generated}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">১০০% সম্পূর্ণ কার্ড প্রোফাইল</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-[#ea580c]">
                <IdCard className="w-6 h-6" />
              </div>
            </div>

            {/* Active ID Cards */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                  সক্রিয় আইডি কার্ড
                </div>
                <div className="text-2xl font-black text-emerald-600 font-mono-num mt-1">
                  {metrics.active}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">ভেরিফিকেশনে বৈধ দেখাবে</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            {/* Inactive / Need Attention */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                  নিষ্ক্রিয় / ছবিবিহীন
                </div>
                <div className="text-2xl font-black text-amber-600 font-mono-num mt-1">
                  {metrics.needsPhoto}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">ছবি আপলোড প্রয়োজন</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Quick Action Banners & Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-xl p-6 shadow-md flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#ea580c] flex items-center justify-center text-white mb-4">
                  <Printer className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-white">প্রিন্ট-ফ্রেন্ডলি CR80 কার্ড</h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  স্ট্যান্ডার্ড ৫৪ মিমি × ৮৫.৬ মিমি সাইজে এক ক্লিকে যেকোনো পিভিসি কার্ড প্রিন্টারে সরাসরি প্রিন্ট বা উচ্চ রেজোলিউশনের পিডিএফ ডাউনলোড করুন।
                </p>
              </div>
              <button
                onClick={() => setActiveTab('all')}
                className="mt-6 w-full py-2.5 px-4 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <span>সকল কার্ড তালিকা দেখুন</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-gradient-to-br from-[#244B38] via-[#397653] to-[#244B38] text-white rounded-xl p-6 shadow-md flex flex-col justify-between border border-[#C9B77B]/40">
              <div>
                <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-xs flex items-center justify-center text-[#C9B77B] mb-4 border border-[#C9B77B]/40">
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-white">১০০% অফলাইন কিউআর কোড</h3>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#C9B77B]/20 text-[#C9B77B] border border-[#C9B77B]/50">
                    No Internet Required
                  </span>
                </div>
                <p className="text-xs text-[#EAF5E9]/90 mt-1.5 leading-relaxed">
                  কোনো ওয়েবসাইট লিংক বা অনলাইন রিকোয়েস্ট ছাড়াই প্রতিটি কার্ডের কিউআর কোডে কর্মচারীর পরিচয় সরাসরি এনকোড করা। যেকোনো সাধারণ মোবাইল ক্যামেরা দিয়ে তাৎক্ষণিক স্ক্যান হবে।
                </p>
              </div>
              <button
                onClick={() => {
                  if (employeesList[0]) {
                    openOfflineQrModal(employeesList[0]);
                  } else {
                    showToast('কোনো কর্মচারী ডাটা নেই', 'error');
                  }
                }}
                className="mt-6 w-full py-2.5 px-4 bg-gradient-to-r from-[#C9B77B] to-[#A89454] hover:from-[#d5c58f] hover:to-[#968244] text-[#244B38] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <QrCode className="w-4 h-4" />
                <span>অফলাইন কিউআর ডেটা টেস্টার</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                  <SettingsIcon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900">স্বাক্ষর ও ব্র্যান্ডিং কাস্টমাইজ</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  কর্তৃপক্ষের ডিজিটাল স্বাক্ষর, কোম্পানির যোগাযোগের তথ্য, ৫টি অফিসিয়াল শর্তাবলী এবং লোগো সুপার অ্যাডমিন প্যানেল থেকে কনফিগার করুন।
                </p>
              </div>
              {!isManager ? (
                <button
                  onClick={() => setActiveTab('settings')}
                  className="mt-6 w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <span>আইডি কার্ড সেটিংস পরিবর্তন করুন</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="mt-6 text-xs text-slate-400 italic">শুধুমাত্র সুপার অ্যাডমিনের জন্য</div>
              )}
            </div>
          </div>

          {/* Live Sample Card Preview Box with Premium Light Green Showcase */}
          {employeesList.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 border-b border-slate-100 pb-3 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#F3841D]" />
                    <h3 className="text-sm font-bold text-slate-900">
                      মডার্ন অ্যান্ড প্রফেশনাল আইডি কার্ড ডিজাইন (Modern & Professional Business Vector Edition)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ডার্ক চারকোল গ্রে (#464646), ভাইব্র্যান্ট অরেঞ্জ অ্যাকসেন্ট (#F3841D), ক্রিস্প হোয়াইট (#FFFFFF)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Employee Selector for Preview */}
                  {employeesList.length > 1 && (
                    <select
                      value={dashboardEmployeeIndex}
                      onChange={(e) => setDashboardEmployeeIndex(Number(e.target.value))}
                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 font-medium text-slate-800"
                    >
                      {employeesList.slice(0, 15).map((emp, idx) => (
                        <option key={emp.id} value={idx}>
                          {emp.fullName} ({emp.employeeCode})
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Side Switcher */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setDashboardPreviewSide('front')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        dashboardPreviewSide === 'front'
                          ? 'bg-white shadow-xs text-[#F3841D] font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      সামনের অংশ (Front)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardPreviewSide('back')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        dashboardPreviewSide === 'back'
                          ? 'bg-white shadow-xs text-[#F3841D] font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      পিছনের অংশ (Back)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardPreviewSide('both')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        dashboardPreviewSide === 'both'
                          ? 'bg-white shadow-xs text-[#F3841D] font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      উভয় অংশ (Both)
                    </button>
                  </div>

                  <button
                    onClick={() => setPreviewEmployee(employeesList[dashboardEmployeeIndex] || employeesList[0])}
                    className="px-3.5 py-1.5 bg-[#464646] hover:bg-[#333333] text-white border border-[#F3841D]/50 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#F3841D]" />
                    <span>ফুল স্ক্রিন প্রিভিউ</span>
                  </button>
                </div>
              </div>

              {/* Design Spec Highlights */}
              <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-[#464646] text-white px-3 py-2 rounded-lg flex items-center gap-2 border border-slate-600">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F3841D]" />
                  <span className="font-semibold text-white">ডার্ক চারকোল (#464646)</span>
                </div>
                <div className="bg-[#F3841D] text-white px-3 py-2 rounded-lg flex items-center gap-2 border border-orange-400">
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  <span className="font-bold text-white">ভাইব্র্যান্ট অরেঞ্জ (#F3841D)</span>
                </div>
                <div className="bg-white text-slate-800 px-3 py-2 rounded-lg flex items-center gap-2 border border-slate-300">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#464646]" />
                  <span className="font-bold text-slate-800">পিওর হোয়াইট (#FFFFFF)</span>
                </div>
                <div className="bg-orange-50 text-[#EA7611] px-3 py-2 rounded-lg flex items-center gap-2 border border-[#F3841D]/30">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F3841D]" />
                  <span className="font-bold text-[#EA7611]">অরেঞ্জ ওয়েভ রিবন</span>
                </div>
              </div>

              <div className="py-4 overflow-x-auto flex justify-center bg-slate-50/60 rounded-xl border border-slate-100">
                <IdCardPreview
                  employee={employeesList[dashboardEmployeeIndex] || employeesList[0]}
                  settings={idSettings}
                  side={dashboardPreviewSide}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ALL EMPLOYEE ID CARDS TABLE */}
      {/* ===================================================================== */}
      {activeTab === 'all' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="নাম, আইডি নম্বর, মোবাইল দিয়ে খুঁজুন..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-[#ea580c]/20 focus:border-[#ea580c]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* View Mode Toggle: Table or Card Grid */}
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCardsViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                    cardsViewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="টেবিল ভিউ"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">টেবিল</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCardsViewMode('cards')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                    cardsViewMode === 'cards'
                      ? 'bg-white text-[#ea580c] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="কার্ড গ্যালারি ভিউ"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">কার্ড গ্যালারি</span>
                </button>
              </div>

              {/* Department Filter */}
              <select
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700"
              >
                <option value="ALL">সকল বিভাগ</option>
                {departmentsList.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-700"
              >
                <option value="ALL">সকল স্ট্যাটাস</option>
                <option value="ACTIVE">সক্রিয় (Active)</option>
                <option value="INACTIVE">নিষ্ক্রিয় (Inactive)</option>
              </select>

              {/* Refresh */}
              <button
                onClick={loadData}
                title="রিফ্রেশ করুন"
                className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Bulk Action Strip */}
          {selectedIds.length > 0 && (
            <div className="bg-orange-50 border-b border-orange-200 px-6 py-2.5 flex items-center justify-between text-xs text-[#ea580c] font-semibold">
              <div className="flex items-center gap-2">
                <span>{selectedIds.length} জন কর্মচারী নির্বাচিত হয়েছে</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const selectedEmps = employeesList.filter((e) => selectedIds.includes(e.id));
                    openPrintStudio(selectedEmps, 'both');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-[#244B38] to-[#397653] hover:from-[#1b382a] hover:to-[#244B38] text-white rounded-md text-[11px] font-bold shadow-xs border border-[#C9B77B]/50 transition-all"
                >
                  <Printer className="w-3.5 h-3.5 text-[#C9B77B]" />
                  <span>নির্বাচিত {selectedIds.length} জনের বাল্ক প্রিন্ট ও PDF</span>
                </button>
                <button
                  onClick={() => {
                    const first = employeesList.find((e) => e.id === selectedIds[0]);
                    if (first) setPreviewEmployee(first);
                  }}
                  className="px-3 py-1 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300 text-[11px] font-bold"
                >
                  কার্ড প্রিভিউ
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1 text-slate-600 hover:text-slate-900 text-[11px]"
                >
                  বাতিল করুন
                </button>
              </div>
            </div>
          )}

          {/* Main Content: Table View or Cards Gallery View */}
          {cardsViewMode === 'table' ? (
            /* Table */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          paginatedEmployees.length > 0 &&
                          selectedIds.length === paginatedEmployees.length
                        }
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-[#ea580c] focus:ring-[#ea580c]"
                      />
                    </th>
                    <th className="py-3 px-4">আইডি নং (ID)</th>
                    <th className="py-3 px-4">ছবি</th>
                    <th className="py-3 px-4">কর্মচারীর নাম</th>
                    <th className="py-3 px-4">রক্তের গ্রুপ</th>
                    <th className="py-3 px-4">বিভাগ</th>
                    <th className="py-3 px-4">পদবি</th>
                    <th className="py-3 px-4">কার্ড স্ট্যাটাস</th>
                    <th className="py-3 px-4 text-right">অ্যাকশন (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        কোনো কর্মচারী খুঁজে পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    paginatedEmployees.map((emp) => {
                      const isSelected = selectedIds.includes(emp.id);
                      const isActive = emp.employmentStatus === 'Active';

                      return (
                        <tr
                          key={emp.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? 'bg-orange-50/40' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectEmployee(emp.id)}
                              className="rounded border-slate-300 text-[#ea580c] focus:ring-[#ea580c]"
                            />
                          </td>
                          <td className="py-3 px-4 font-mono-num font-bold text-slate-900 whitespace-nowrap">
                            {emp.employeeCode}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="w-9 h-9 rounded-full p-[1.5px] bg-gradient-to-tr from-[#ea580c] to-[#f59e0b]">
                              {emp.photoUrl ? (
                                <img
                                  src={emp.photoUrl}
                                  alt={emp.fullName}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
                                  {emp.fullName.charAt(0)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                            <div>{emp.fullName}</div>
                            <div className="text-[11px] text-slate-400 font-mono-num font-normal">
                              {emp.mobile}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-extrabold text-[#ea580c] bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200/50">
                              {emp.bloodGroup || 'A+'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                            {emp.departmentName || 'সাধারণ'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {emp.designationName || 'কর্মকর্তা'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isActive ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                              />
                              {isActive ? 'সক্রিয় (Active)' : 'নিষ্ক্রিয়'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Card */}
                              <button
                                onClick={() => setPreviewEmployee(emp)}
                                title="আইডি কার্ড দেখুন"
                                className="p-1.5 bg-slate-100 hover:bg-[#ea580c] hover:text-white rounded-lg text-slate-700 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Download PDF & Print via Studio */}
                              <button
                                onClick={() => openPrintStudio([emp], 'both')}
                                title="প্রিন্ট ও পিডিএফ স্টুডিও"
                                className="p-1.5 bg-slate-100 hover:bg-[#244B38] hover:text-[#C9B77B] rounded-lg text-slate-700 transition-colors"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* 100% Offline QR Code Inspector */}
                              <button
                                type="button"
                                onClick={() => openOfflineQrModal(emp)}
                                title="অফলাইন কিউআর ডেটা ও কোড দেখুন"
                                className="p-1.5 bg-slate-100 hover:bg-[#244B38] hover:text-[#C9B77B] rounded-lg text-slate-700 transition-colors"
                              >
                                <QrCode className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Cards Gallery View - Showcasing the Premium Corporate Front Design */
            <div className="p-6 bg-slate-100/60 min-h-[400px]">
              {paginatedEmployees.length === 0 ? (
                <div className="py-16 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
                  কোনো কর্মচারী খুঁজে পাওয়া যায়নি।
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 justify-items-center">
                  {paginatedEmployees.map((emp) => {
                    const isSelected = selectedIds.includes(emp.id);
                    return (
                      <div
                        key={emp.id}
                        className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-lg transition-all flex flex-col items-center max-w-[340px] w-full ${
                          isSelected
                            ? 'border-[#ea580c] ring-2 ring-[#ea580c]/20'
                            : 'border-slate-200'
                        }`}
                      >
                        {/* Header bar of card item */}
                        <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-100 text-xs">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectEmployee(emp.id)}
                              className="rounded border-slate-300 text-[#ea580c] focus:ring-[#ea580c]"
                            />
                            <span className="font-mono-num font-bold text-slate-900">
                              {emp.employeeCode}
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              emp.employmentStatus === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                emp.employmentStatus === 'Active'
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-400'
                              }`}
                            />
                            {emp.employmentStatus === 'Active' ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        {/* ID Card Front Preview */}
                        <div className="overflow-hidden rounded-[14px] shadow-md border border-slate-200/80">
                          <IdCardPreview
                            employee={emp}
                            settings={idSettings}
                            side="front"
                            showShadow={false}
                          />
                        </div>

                        {/* Action buttons */}
                        <div className="mt-4 pt-3 border-t border-slate-100 w-full flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewEmployee(emp)}
                            className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-[#ea580c] hover:text-white text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>প্রিভিউ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openPrintStudio([emp], 'both')}
                            className="flex-1 py-1.5 px-2 bg-gradient-to-r from-[#244B38] to-[#397653] hover:from-[#1b382a] hover:to-[#244B38] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-[#C9B77B]/40"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#C9B77B]" />
                            <span>প্রিন্ট ও PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openOfflineQrModal(emp)}
                            className="p-1.5 bg-slate-100 hover:bg-[#244B38] hover:text-[#C9B77B] text-slate-700 rounded-lg transition-colors"
                            title="অফলাইন কিউআর ডেটা ও কোড দেখুন"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <div>
              মোট <span className="font-bold text-slate-900">{filteredEmployees.length}</span> জন
              কর্মচারীর মধ্যে দেখানো হচ্ছে
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40"
              >
                পূর্ববর্তী
              </button>
              <span className="font-mono-num font-semibold text-slate-700">
                পৃষ্ঠা {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40"
              >
                পরবর্তী
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: ID CARD SETTINGS (SUPER ADMIN ONLY) */}
      {/* ===================================================================== */}
      {activeTab === 'settings' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5 text-[#ea580c]" />
                  <span>আইডি কার্ডের গ্লোবাল সেটিংস ও লোগো কনফিগারেশন</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  এখানে পরিবর্তন করা লোগো, স্বাক্ষর, শর্তাবলী ও যোগাযোগের তথ্য সকল কর্মচারীর আইডি কার্ডে তাৎক্ষণিকভাবে কার্যকর হবে।
                </p>
              </div>

              {isSuperAdmin ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[11px] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>সুপার অ্যাডমিন অ্যাক্সেস অনুমোদিত</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-[11px] font-semibold">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>ভিউ-অনলি মোড (শুধু সুপার অ্যাডমিন পরিবর্তন করতে পারবেন)</span>
                </div>
              )}
            </div>

            {/* Design Customization Policy Note */}
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5 text-slate-600 text-[11px]">
              <Sparkles className="w-4 h-4 text-[#ea580c] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800">ডিজাইন কাস্টমাইজেশন সীমাবদ্ধতা (Design Policy):</span> মূল আইডি কার্ডের স্ট্যান্ডার্ড লেআউট, কালার প্যালেট ও ডায়নামিক ওয়েভ শেপ প্রাতিষ্ঠানিক স্ট্যান্ডার্ড অনুযায়ী সংরক্ষিত। শুধুমাত্র সুপার অ্যাডমিন কোম্পানির লোগো, প্রাতিষ্ঠানিক যোগাযোগের তথ্য, ৫টি শর্তাবলী, ডিজিটাল স্বাক্ষর ও কার্ডের মেয়াদকাল পরিবর্তন করতে পারবেন।
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* ================================================================= */}
            {/* 1. DEDICATED OPTION: Company Logo for ID Card (Super Admin Only) */}
            {/* ================================================================= */}
            <div className="bg-gradient-to-br from-slate-50 to-orange-50/20 border-2 border-orange-200/80 rounded-2xl p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-orange-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-wide flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#ea580c]" />
                    <span>Company Logo for ID Card</span>
                    <span className="text-[11px] font-bold text-[#ea580c] bg-orange-100/80 px-2 py-0.5 rounded-md">
                      সুপার অ্যাডমিন অপশন
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    হোম রেসিপি ফুডস্ এর আসল লোগো আপলোড করুন। লোগোটি কার্ডের সামনের ও পেছনের অংশে সরাসরি ব্যবহৃত হবে।
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {settingsForm.companyLogo ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>কাস্টম লোগো সক্রিয়</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold">
                      <span>অফিসিয়াল ভেক্টর লোগো সক্রিয়</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Logo Preview Section (Front Side Dark & Back Side Light) */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Logo Preview (ডুয়াল প্রিভিউ: ডার্ক ও লাইট ব্যাকগ্রাউন্ডে প্রদর্শন)</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    ✓ মূল আকৃতি, রঙ ও স্বচ্ছতা সম্পূর্ণ অক্ষুণ্ণ (Object-Contain, No Stretch/Crop)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Front Side Dark Charcoal Background Preview */}
                  <div className="bg-[#3C3C3C] rounded-xl p-4 flex flex-col items-center justify-center border border-[#F3841D]/40 shadow-inner min-h-[110px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FB923C] mb-2">
                      কার্ডের সামনের অংশ (Dark Charcoal & Orange Header)
                    </span>
                    <div className="py-2 flex justify-center w-full">
                      <HomeRecipeLogo
                        customLogoUrl={settingsForm.companyLogo}
                        size="2xl"
                        variant="light"
                        className="mx-auto"
                      />
                    </div>
                  </div>

                  {/* Back Side Dark Charcoal Background Preview */}
                  <div className="bg-[#3C3C3C] rounded-xl p-4 flex flex-col items-center justify-center border border-[#F3841D]/40 shadow-xs min-h-[110px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FB923C] mb-2">
                      কার্ডের পিছনের অংশ (Dark Charcoal Header)
                    </span>
                    <div className="py-2 flex justify-center w-full">
                      <HomeRecipeLogo
                        customLogoUrl={settingsForm.companyLogo}
                        size="xl"
                        variant="light"
                        className="mx-auto"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Global Optimized Logo Uploader */}
              <div className="pt-3 border-t border-orange-100 space-y-3">
                <OptimizedImageUploader
                  label="কোম্পানি লোগো ফাইল আপলোড (সর্বোচ্চ ২০ MB — স্বচ্ছতা অক্ষুণ্ণ)"
                  category="COMPANY_LOGO"
                  storageFolder="company-assets"
                  customFileName="company_logo"
                  currentImageUrl={settingsForm.companyLogo}
                  disabled={!isSuperAdmin}
                  aspectRatioHint="স্বচ্ছ ব্যাকগ্রাউন্ড PNG / WebP সুপারিশকৃত"
                  onUploadSuccess={(res) => {
                    setSettingsForm((prev) => ({
                      ...prev,
                      companyLogo: res.downloadUrl,
                    }));
                    handleSaveLogo(res.downloadUrl);
                  }}
                  onImageRemove={() => {
                    setSettingsForm((prev) => ({ ...prev, companyLogo: '' }));
                    showToast('কাস্টম লোগো মুছে ডিফল্ট ভেক্টর লোগো সক্রিয় করা হয়েছে।', 'success');
                  }}
                  onError={(err) => showToast(err, 'error')}
                />

                <div className="flex justify-end">
                  {/* Direct Save Changes Button for Logo */}
                  <button
                    type="button"
                    disabled={!isSuperAdmin || savingLogo}
                    onClick={() => handleSaveLogo()}
                    className="px-4 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {savingLogo ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>লোগো সেভ হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Changes (লোগো পরিবর্তন সংরক্ষণ)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Company Name Field */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#ea580c] flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>কোম্পানির নাম (Company Name)</span>
              </h3>

              <div className="max-w-md text-xs">
                <label className="block font-semibold text-slate-700 mb-1">
                  কোম্পানির নাম (Company Name) *
                </label>
                <input
                  type="text"
                  required
                  disabled={!isSuperAdmin}
                  value={settingsForm.companyName}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, companyName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* 2. Official Contact Information */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#ea580c] flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>কার্ডের পিছনের অফিসিয়াল যোগাযোগের তথ্য</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    অফিসিয়াল ইমেইল (Email)
                  </label>
                  <input
                    type="email"
                    disabled={!isSuperAdmin}
                    value={settingsForm.companyEmail}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, companyEmail: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    কোম্পানি ফোন (Phone)
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={settingsForm.companyPhone}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, companyPhone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono-num disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ফেসবুক পেজ (Facebook Page)
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={settingsForm.facebookPage}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, facebookPage: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">
                    অফিস ঠিকানা (Office Address)
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={settingsForm.officeAddress}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, officeAddress: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* 3. Authorized Signature & Signer Config */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#ea580c] flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                <span>কর্তৃপক্ষের ডিজিটাল স্বাক্ষর ও অনুমোদিত ব্যক্তি</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    অনুমোদিত ব্যক্তির নাম
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={settingsForm.authorizedPersonName}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        authorizedPersonName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    অনুমোদিত ব্যক্তির পদবি
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={settingsForm.authorizedPersonDesignation}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        authorizedPersonDesignation: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    কার্ডের মেয়াদকাল (বছর)
                  </label>
                  <select
                    disabled={!isSuperAdmin}
                    value={settingsForm.validityYears}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        validityYears: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                  >
                    <option value={1}>১ বছর</option>
                    <option value={2}>২ বছর</option>
                    <option value={3}>৩ বছর</option>
                    <option value={5}>৫ বছর (স্ট্যান্ডার্ড)</option>
                    <option value={10}>১০ বছর</option>
                  </select>
                </div>

                {/* Signature Upload */}
                <div className="sm:col-span-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block font-semibold text-slate-700">
                      অনুমোদিত স্বাক্ষর (Authorized Signature — সর্বোচ্চ ২০ MB)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isSuperAdmin}
                        checked={settingsForm.signatureVisibility}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            signatureVisibility: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-[#ea580c] focus:ring-[#ea580c]"
                      />
                      <span className="text-xs font-semibold text-slate-700">
                        কার্ডে স্বাক্ষর প্রদর্শন করুন
                      </span>
                    </label>
                  </div>

                  <OptimizedImageUploader
                    category="SIGNATURE"
                    storageFolder="signatures"
                    customFileName="authorized_signature"
                    currentImageUrl={settingsForm.authorizedSignatureUrl}
                    disabled={!isSuperAdmin}
                    compact
                    aspectRatioHint="স্বচ্ছ ব্যাকগ্রাউন্ড (Transparent PNG/WebP)"
                    onUploadSuccess={(res) => {
                      setSettingsForm((prev) => ({
                        ...prev,
                        authorizedSignatureUrl: res.downloadUrl,
                      }));
                      showToast(
                        `স্বাক্ষর সফলভাবে অপটিমাইজ ও ক্লাউড স্টোরেজে আপলোড হয়েছে (${res.savingsPercent}% সাইজ কমেছে)!`,
                        'success'
                      );
                    }}
                    onImageRemove={() => {
                      setSettingsForm((prev) => ({
                        ...prev,
                        authorizedSignatureUrl: '',
                      }));
                      showToast('স্বাক্ষর সরানো হয়েছে।', 'success');
                    }}
                    onError={(err) => showToast(err, 'error')}
                  />

                  {/* Live Signature & Authority Preview */}
                  <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-600">
                      কার্ডে যেভাবে প্রদর্শিত হবে:
                    </span>
                    <div className="w-[140px] text-center p-2 bg-slate-50/80 rounded border border-slate-200 shadow-2xs">
                      <div className="min-h-[24px] flex items-center justify-center">
                        {settingsForm.authorizedSignatureUrl ? (
                          <img
                            src={settingsForm.authorizedSignatureUrl}
                            alt="Signature Preview"
                            referrerPolicy="no-referrer"
                            className="max-h-7 max-w-[110px] object-contain mx-auto"
                          />
                        ) : (
                          <div className="font-serif italic font-bold text-xs text-slate-800">
                            {settingsForm.authorizedPersonName || 'মোঃ মাহমুদুল হাসান'}
                          </div>
                        )}
                      </div>
                      <div className="w-full border-t border-slate-300 my-1" />
                      <div className="text-[10px] font-black text-[#111827] leading-tight truncate">
                        {settingsForm.authorizedPersonName || 'মোঃ মাহমুদুল হাসান'}
                      </div>
                      <div className="text-[9px] font-semibold text-slate-600 leading-tight truncate">
                        {settingsForm.authorizedPersonDesignation || 'Managing Director / Chairman'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Terms and Conditions */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#ea580c] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>আইডি কার্ডের ৫টি শর্তাবলী (Terms & Conditions)</span>
                </h3>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        termsAndConditions: DEFAULT_ID_CARD_TERMS,
                      }))
                    }
                    className="text-[11px] font-semibold text-slate-600 hover:text-[#ea580c]"
                  >
                    ডিফল্ট শর্তাবলী পুনরায় সেট করুন
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {(settingsForm.termsAndConditions || []).map((term, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-6 text-center text-xs font-mono font-bold text-slate-500">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      disabled={!isSuperAdmin}
                      value={term}
                      onChange={(e) => {
                        const updated = [...(settingsForm.termsAndConditions || [])];
                        updated[idx] = e.target.value;
                        setSettingsForm({ ...settingsForm, termsAndConditions: updated });
                      }}
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white disabled:bg-slate-100"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="submit"
                disabled={savingSettings || !isSuperAdmin}
                className="px-6 py-2.5 bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold text-xs rounded-lg disabled:opacity-50 flex items-center gap-2 transition-all shadow-md"
              >
                {savingSettings ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>সংরক্ষণ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>আইডি কার্ডের সকল সেটিংস সংরক্ষণ করুন</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CARD PREVIEW MODAL */}
      {/* ===================================================================== */}
      {previewEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs no-print">
          <div className="relative bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <IdCard className="w-6 h-6 text-[#ea580c]" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    আইডি কার্ড প্রিভিউ: {previewEmployee.fullName}
                  </h3>
                  <div className="text-xs text-slate-500">
                    আইডি: {previewEmployee.employeeCode} · {previewEmployee.designationName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Side Toggle */}
                <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => setPreviewSide('both')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      previewSide === 'both' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    উভয় অংশ
                  </button>
                  <button
                    onClick={() => setPreviewSide('front')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      previewSide === 'front' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    সামনের অংশ
                  </button>
                  <button
                    onClick={() => setPreviewSide('back')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      previewSide === 'back' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    পিছনের অংশ
                  </button>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setPreviewEmployee(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Card Display */}
            <div className="py-6 flex items-center justify-center bg-slate-100/60 rounded-xl overflow-x-auto">
              <IdCardPreview
                employee={previewEmployee}
                settings={idSettings}
                side={previewSide}
                containerId="modal-card-preview"
              />
            </div>

            {/* Modal Actions Footer */}
            <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>১০০% অফলাইন কিউআর কোড: কোনো ইন্টারনেট বা ওয়েবসাইট ছাড়াই স্ক্যানযোগ্য</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openOfflineQrModal(previewEmployee)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-[#244B38] hover:text-[#C9B77B] text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200"
                >
                  <QrCode className="w-4 h-4" />
                  <span>অফলাইন কিউআর ডেটা দেখুন</span>
                </button>

                <button
                  onClick={() => openPrintStudio([previewEmployee], previewSide)}
                  className="px-5 py-2 bg-gradient-to-r from-[#244B38] via-[#397653] to-[#244B38] hover:from-[#1b382a] hover:to-[#244B38] text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-md border border-[#C9B77B]/50"
                >
                  <Printer className="w-4 h-4 text-[#C9B77B]" />
                  <span>প্রিন্ট ও পিডিএফ স্টুডিও</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 100% OFFLINE QR CODE INSPECTOR & TESTING MODAL */}
      {/* ===================================================================== */}
      {inspectQrEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs no-print">
          <div className="relative bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto border border-[#C9B77B]/40">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#244B38] to-[#397653] flex items-center justify-center text-[#C9B77B] shadow-sm">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      ১০০% অফলাইন কিউআর কোড সিস্টেম
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Offline Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    কোনো ওয়েবসাইট বা ইন্টারনেট ছাড়াই যেকোনো মোবাইল ক্যামেরা দিয়ে সরাসরি স্ক্যানযোগ্য
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectQrEmployee(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* Left: The QR Code itself */}
              <div className="flex flex-col items-center bg-[#EAF5E9]/50 p-5 rounded-2xl border border-[#C9B77B]/50">
                <div className="text-xs font-bold text-[#244B38] mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>প্রিন্ট ও কার্ডে থাকা অফলাইন কিউআর</span>
                </div>

                {/* QR Code Container: Pure White with Deep Green Pattern */}
                <div className="p-3 bg-white rounded-xl shadow-md border-2 border-[#C9B77B] flex items-center justify-center">
                  {inspectQrDataUrl ? (
                    <img
                      src={inspectQrDataUrl}
                      alt="Offline QR"
                      className="w-48 h-48 block object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                      Generating QR...
                    </div>
                  )}
                </div>

                <div className="mt-3 text-center space-y-1">
                  <div className="text-xs font-bold text-[#244B38]">
                    {inspectQrEmployee.fullName}
                  </div>
                  <div className="text-[11px] text-[#397653] font-mono">
                    ID: {inspectQrEmployee.employeeCode} · {inspectQrEmployee.designationName || 'কর্মচারী'}
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1">
                    Pure White Background (#FFFFFF) · Deep Green Pattern (#244B38)
                  </div>
                </div>
              </div>

              {/* Right: Encoded JSON Payload & Offline Guarantee */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#244B38]" />
                      <span>কিউআর কোডে এনকোডকৃত JSON ডেটা:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const payload = buildOfflineIdCardData(inspectQrEmployee, idSettings);
                        navigator.clipboard.writeText(formatOfflineQrPayloadJson(payload));
                        setCopiedJson(true);
                        setTimeout(() => setCopiedJson(false), 2000);
                        showToast('অফলাইন JSON ডেটা ক্লিপবোর্ডে কপি করা হয়েছে', 'success');
                      }}
                      className="text-xs font-bold text-[#244B38] hover:text-[#397653] flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      {copiedJson ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">কপি সম্পন্ন!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>কপি JSON</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Code Block displaying exact JSON */}
                  <div className="relative bg-[#1f1917] text-[#F3E8D6] rounded-xl p-3 font-mono text-[11px] leading-relaxed max-h-56 overflow-y-auto border border-[#D6B477]/30 shadow-inner">
                    <pre className="whitespace-pre-wrap break-words">
                      {formatOfflineQrPayloadJson(buildOfflineIdCardData(inspectQrEmployee, idSettings))}
                    </pre>
                  </div>
                </div>

                {/* Privacy & Security Guarantee */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>নিরাপত্তা ও গোপনীয়তা গ্যারান্টি (Privacy Assured)</span>
                  </div>
                  <ul className="text-[11px] text-emerald-800 space-y-0.5 list-disc list-inside">
                    <li>কোনো URL বা বহিরাগত সার্ভার লিংক নেই</li>
                    <li>NID নম্বর, বেতন, ব্যাংক বা ব্যক্তিগত ঠিকানা নেই</li>
                    <li>ইন্টারনেট বন্ধ রেখেও যেকোনো স্ক্যানারে সরাসরি দৃশ্যমান</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Offline Scanner Simulation Tool */}
            <div className="mt-5 pt-4 border-t border-slate-200">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-[#244B38]" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      অফলাইন স্ক্যান টেস্ট সিমুলেশন
                    </div>
                    <div className="text-[11px] text-slate-500">
                      যেকোনো অ্যান্ড্রয়েড বা আইফোন ক্যামেরা যেভাবে ইন্টারনেট ছাড়াই এই কার্ড দেখবে
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSimulatorActive(!simulatorActive)}
                  className="px-3 py-1.5 bg-[#244B38] hover:bg-[#1a382a] text-[#C9B77B] text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{simulatorActive ? 'সিমুলেশন বন্ধ করুন' : 'স্ক্যানার ফলাফল দেখুন'}</span>
                </button>
              </div>

              {simulatorActive && (
                <div className="mt-3 p-4 bg-white border border-[#D6B477]/50 rounded-xl shadow-xs animate-in fade-in duration-200 space-y-3">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>অফলাইন ডিকোড সফল — ক্যামেরা ডিসপ্লে প্রিভিউ:</span>
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                      Zero Network Requests / ১০০% অফলাইন
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400">Company</div>
                      <div className="font-bold text-slate-800">
                        {idSettings.companyName || 'Home Recipe Foods'}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400">Employee Name</div>
                      <div className="font-bold text-slate-800">{inspectQrEmployee.fullName}</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400">Employee ID</div>
                      <div className="font-bold text-slate-800 font-mono">
                        {inspectQrEmployee.employeeCode}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400">Designation</div>
                      <div className="font-bold text-slate-800">
                        {inspectQrEmployee.designationName || '-'}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400">Department</div>
                      <div className="font-bold text-slate-800">
                        {inspectQrEmployee.departmentName || '-'}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400">Blood Group</div>
                      <div className="font-bold text-rose-600">
                        {inspectQrEmployee.bloodGroup || '-'}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400">Phone</div>
                      <div className="font-bold text-slate-800 font-mono">
                        {inspectQrEmployee.mobile || '-'}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400">Status</div>
                      <div className="font-bold text-emerald-700">
                        {inspectQrEmployee.employmentStatus || 'Active'}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400">Issue / Expiry</div>
                      <div className="font-bold text-slate-800 font-mono text-[11px]">
                        {buildOfflineIdCardData(inspectQrEmployee, idSettings).issue_date} →{' '}
                        {buildOfflineIdCardData(inspectQrEmployee, idSettings).expiry_date}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectQrEmployee(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. PRINT & PDF STUDIO MODAL (CR80 DIRECT & A4 SHEET GRID EXPORT) */}
      {/* ===================================================================== */}
      {showPrintStudioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md no-print">
          <div className="relative bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl max-h-[96vh] overflow-y-auto flex flex-col font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 mb-5 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#244B38] text-[#C9B77B] border border-[#C9B77B]/40 flex items-center justify-center font-bold shadow-xs">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      আইডি কার্ড প্রিন্ট ও পিডিএফ স্টুডিও
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF5E9] text-[#244B38] border border-[#C9B77B]/60">
                      Standard CR80 (54 × 85.6 mm)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {printEmployees.length === 1
                      ? `কর্মচারী: ${printEmployees[0].fullName} (${printEmployees[0].employeeCode})`
                      : `মোট ${printEmployees.length} জন কর্মচারীর আইডি কার্ড নির্বাচিত`}
                  </p>
                </div>
              </div>

              <button
                disabled={generatingPdf}
                onClick={() => setShowPrintStudioModal(false)}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Print & PDF Configuration Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              {/* Option 1: Page Side Selection */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>১. কার্ডের পাশ নির্বাচন (Page Sides):</span>
                  <span className="text-[10px] text-slate-500 font-normal">ক্রম: Front ➔ Back</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPrintSide('both')}
                    className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
                      printSide === 'both'
                        ? 'bg-[#244B38] text-white border-[#C9B77B] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Front + Back (উভয় পাশ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintSide('front')}
                    className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
                      printSide === 'front'
                        ? 'bg-[#244B38] text-white border-[#C9B77B] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Front Only (সামনের পাশ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintSide('back')}
                    className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
                      printSide === 'back'
                        ? 'bg-[#244B38] text-white border-[#C9B77B] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Back Only (পিছনের পাশ)
                  </button>
                </div>
              </div>

              {/* Option 2: Print Layout Format */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>২. প্রিন্ট পেপার ও লেআউট (Paper Layout):</span>
                  <span className="text-[10px] text-slate-500 font-normal">জিরো মার্জিন ও নো ব্ল্যাক লাইন</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPrintLayoutFormat('cr80')}
                    className={`py-2 px-2.5 rounded-lg border text-left transition-all ${
                      printLayoutFormat === 'cr80'
                        ? 'bg-[#244B38] text-white border-[#C9B77B] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#C9B77B]" />
                      <span>CR80 PVC Direct</span>
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">৫৪ × ৮৫.৬ মিমি (পিভিসি প্রিন্টার)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintLayoutFormat('a4')}
                    className={`py-2 px-2.5 rounded-lg border text-left transition-all ${
                      printLayoutFormat === 'a4'
                        ? 'bg-[#244B38] text-white border-[#C9B77B] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>A4 Sheet Grid</span>
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">৬টি কার্ড/পেজ (সাধারণ প্রিন্টার)</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Collapsible Duplex Printing & Quality Guidelines */}
            <div className="mb-5 bg-[#EAF5E9]/50 border border-[#C9B77B]/50 rounded-xl overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setShowDuplexHelp((prev) => !prev)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-left font-bold text-[#244B38] hover:bg-[#EAF5E9]/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#397653]" />
                  <span>ডুপ্লেক্স (উভয় পাশ) প্রিন্টিং ও ১০০% নিখুঁত আউটপুট নির্দেশিকা</span>
                </div>
                <span className="text-[11px] font-semibold text-[#397653]">
                  {showDuplexHelp ? 'লুকান ▲' : 'বিস্তারিত দেখুন ▼'}
                </span>
              </button>

              {showDuplexHelp && (
                <div className="px-4 pb-3.5 pt-1 space-y-2 text-[#244B38] text-[11px] leading-relaxed border-t border-[#C9B77B]/30">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-2.5 bg-white/70 rounded-lg border border-[#C9B77B]/30">
                      <span className="font-bold text-[#244B38] block mb-1">
                        • পিভিসি কার্ড প্রিন্টারে (Zebra, Evolis, Magicard, Fargo):
                      </span>
                      <span>
                        প্রিন্টার সেটিংসে Paper Size &quot;Custom 54x85.6mm&quot; এবং ডুপ্লেক্স অটো-ফ্লিপ চালু থাকলে পেজ ১ (Front) এবং পেজ ২ (Back) ক্রমানুসারে উভয় পাশে নিজে থেকেই প্রিন্ট হবে।
                      </span>
                    </div>
                    <div className="p-2.5 bg-white/70 rounded-lg border border-[#C9B77B]/30">
                      <span className="font-bold text-[#244B38] block mb-1">
                        • সাধারণ ডেস্কটপ প্রিন্টারে দুই পাশে প্রিন্ট করতে:
                      </span>
                      <span>
                        প্রথমে &quot;Front Only&quot; দিয়ে প্রিন্ট দিন। এরপর কাগজটি ট্রে-তে দৈর্ঘ্য বরাবর (Long Edge Flip) উল্টে রেখে &quot;Back Only&quot; দিয়ে প্রিন্ট করুন।
                      </span>
                    </div>
                  </div>
                  <div className="p-2 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 text-[10.5px]">
                    ✓ <strong>প্রিন্ট ডায়ালগ সেটিংস:</strong> Margins: &quot;None&quot; (কোনো মার্জিন নয়), Scale: &quot;100% / Actual Size&quot;, Headers & Footers: &quot;Off&quot;, Background Graphics: &quot;On (সক্রিয়)&quot;।
                  </div>
                </div>
              )}
            </div>

            {/* Cards Live Preview Box */}
            <div className="mb-5 bg-slate-100/70 p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-700 mb-3 flex items-center justify-between">
                <span>লাইভ প্রিন্ট প্রিভিউ (Live Card Preview):</span>
                <span className="text-[11px] text-slate-500">
                  {printEmployees.length > 1
                    ? `১ম কর্মচারী: ${printEmployees[0].fullName} (বাকি ${printEmployees.length - 1} জন সহ একই ক্রমে প্রিন্ট হবে)`
                    : 'প্রিন্ট ও পিডিএফের জন্য সঠিক আউটপুট'}
                </span>
              </div>

              <div className="flex justify-center overflow-x-auto py-2">
                <IdCardPreview
                  employee={printEmployees[0]}
                  settings={idSettings}
                  side={printSide}
                  showShadow={false}
                  forPrintOrPdf={true}
                  className="scale-95"
                />
              </div>
            </div>

            {/* Action Buttons & Progress Bar */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                {generatingPdf ? (
                  <div className="flex items-center gap-2 text-[#244B38] font-bold">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#397653]" />
                    <span>
                      পিডিএফ তৈরি হচ্ছে... {pdfProgress?.current || 1}/{pdfProgress?.total || printEmployees.length}
                    </span>
                  </div>
                ) : (
                  <span>যেকোনো ডিভাইসের প্রিন্টার ও স্ক্যানারে ১০০% সঠিক সাইজ নিশ্চিত</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* 1. Direct In-Browser Print Button */}
                <button
                  disabled={generatingPdf}
                  onClick={handleExecuteDirectPrint}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:opacity-50"
                >
                  <Printer className="w-4 h-4 text-emerald-600" />
                  <span>সরাসরি প্রিন্ট করুন (Print Dialog)</span>
                </button>

                {/* 2. CR80 PDF Download Button */}
                <button
                  disabled={generatingPdf}
                  onClick={() => handleExecutePdfDownload('cr80')}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#244B38] via-[#397653] to-[#244B38] hover:from-[#1b382a] hover:to-[#244B38] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md border border-[#C9B77B]/50 disabled:opacity-50"
                >
                  <Download className="w-4 h-4 text-[#C9B77B]" />
                  <span>CR80 PDF (৫৪ × ৮৫.৬ মিমি)</span>
                </button>

                {/* 3. A4 Sheet PDF Download Button */}
                <button
                  disabled={generatingPdf}
                  onClick={() => handleExecutePdfDownload('a4')}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#397653] to-[#244B38] hover:from-[#2e5e42] hover:to-[#1b382a] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md border border-[#C9B77B]/40 disabled:opacity-50"
                >
                  <Download className="w-4 h-4 text-[#F3E8D6]" />
                  <span>A4 Sheet PDF (৬টি কার্ড/পেজ)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. HIDDEN OFF-SCREEN CONTAINER FOR LOSSLESS HIGH-DPI PDF CAPTURE */}
      {/* (Rendered with forPrintOrPdf=true and showShadow=false: Zero Black Lines) */}
      {/* ===================================================================== */}
      <div
        id="id-card-export-hidden-container"
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '320px',
          height: 'auto',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -999,
        }}
      >
        {(showPrintStudioModal
          ? printEmployees
          : previewEmployee
          ? [previewEmployee]
          : employeesList.slice(0, 1)
        ).map((emp) => (
          <div key={emp.id} className="export-card-pair mb-4">
            <IdCardPreview
              employee={emp}
              settings={idSettings}
              side="front"
              showShadow={false}
              forPrintOrPdf={true}
              containerId={`export-card-${emp.id}`}
            />
            <IdCardPreview
              employee={emp}
              settings={idSettings}
              side="back"
              showShadow={false}
              forPrintOrPdf={true}
              containerId={`export-card-${emp.id}`}
            />
          </div>
        ))}
      </div>

      {/* ===================================================================== */}
      {/* 4. IN-BROWSER PRINT PORTAL (Active only during window.print()) */}
      {/* ===================================================================== */}
      {isPrinting && (
        <div id="id-card-print-portal" className="print-only">
          {printLayoutFormat === 'cr80' ? (
            // CR80 Direct Print: Each card on its own 54mm x 85.6mm page
            printEmployees.map((emp) => (
              <React.Fragment key={emp.id}>
                {(printSide === 'both' || printSide === 'front') && (
                  <div className="id-card-page-cr80">
                    <IdCardPreview
                      employee={emp}
                      settings={idSettings}
                      side="front"
                      showShadow={false}
                      forPrintOrPdf={true}
                      printModeMm={true}
                    />
                  </div>
                )}
                {(printSide === 'both' || printSide === 'back') && (
                  <div className="id-card-page-cr80">
                    <IdCardPreview
                      employee={emp}
                      settings={idSettings}
                      side="back"
                      showShadow={false}
                      forPrintOrPdf={true}
                      printModeMm={true}
                    />
                  </div>
                )}
              </React.Fragment>
            ))
          ) : (
            // A4 Sheet Grid Print: 6 cards per A4 page (2 cols x 3 rows)
            (() => {
              const slots: Array<{ employee: IdCardEmployeeData; side: 'front' | 'back' }> = [];
              printEmployees.forEach((emp) => {
                if (printSide === 'both') {
                  slots.push({ employee: emp, side: 'front' });
                  slots.push({ employee: emp, side: 'back' });
                } else if (printSide === 'front') {
                  slots.push({ employee: emp, side: 'front' });
                } else {
                  slots.push({ employee: emp, side: 'back' });
                }
              });

              const pages: Array<Array<{ employee: IdCardEmployeeData; side: 'front' | 'back' }>> = [];
              for (let i = 0; i < slots.length; i += 6) {
                pages.push(slots.slice(i, i + 6));
              }

              return pages.map((pageCards, pIdx) => (
                <div key={pIdx} className="id-card-sheet-a4">
                  {pageCards.map((c, cIdx) => (
                    <div key={cIdx} className="id-card-a4-slot">
                      <IdCardPreview
                        employee={c.employee}
                        settings={idSettings}
                        side={c.side}
                        showShadow={false}
                        forPrintOrPdf={true}
                        printModeMm={true}
                      />
                    </div>
                  ))}
                </div>
              ));
            })()
          )}
        </div>
      )}
    </div>
  );
};
