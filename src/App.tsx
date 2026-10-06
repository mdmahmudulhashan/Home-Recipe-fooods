import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  CalendarOff,
  UserX,
  Coffee,
  Wallet,
  FileSpreadsheet,
  BarChart3,
  ShieldCheck,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { AuthProvider, useAuth, UserRole } from './context/AuthContext.tsx';
import { LoginView } from './views/LoginView.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { EmployeesView } from './views/EmployeesView.tsx';
import { DepartmentsView, DesignationsView } from './views/OrgStructureView.tsx';
import { LeavesView, AbsencesView } from './views/AttendanceViews.tsx';
import { SnacksView, AdvancesView } from './views/DeductionViews.tsx';
import { SalarySheetView } from './views/SalarySheetView.tsx';
import { ReportsView } from './views/ReportsView.tsx';
import {
  UsersPermissionView,
  ActivityLogsView,
  SettingsView,
} from './views/AdminViews.tsx';
import { EmployeeProfileModal } from './components/EmployeeProfileModal.tsx';
import { getRoleLabel } from './utils/formatters.ts';

interface NavModule {
  id: string;
  path: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  allowedRoles: UserRole[];
}

// 13 Required Navigation Modules from Master Prompt Section 3
const NAV_MODULES: NavModule[] = [
  {
    id: 'dashboard',
    path: '/dashboard',
    label: 'ড্যাশবোর্ড',
    icon: LayoutDashboard,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    id: 'employees',
    path: '/employees',
    label: 'কর্মচারীগণ',
    icon: Users,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    id: 'departments',
    path: '/departments',
    label: 'বিভাগ',
    icon: Building2,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    id: 'designations',
    path: '/designations',
    label: 'পদবি',
    icon: Briefcase,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'leaves',
    path: '/leaves',
    label: 'ছুটি',
    icon: CalendarOff,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    id: 'absences',
    path: '/absences',
    label: 'অনুপস্থিত',
    icon: UserX,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    id: 'snacks',
    path: '/snacks',
    label: 'নাস্তা ক্রয়',
    icon: Coffee,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'advances',
    path: '/advances',
    label: 'অগ্রিম টাকা',
    icon: Wallet,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'salary',
    path: '/salary',
    label: 'সেলারি শিট',
    icon: FileSpreadsheet,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'reports',
    path: '/reports',
    label: 'রিপোর্ট',
    icon: BarChart3,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'users',
    path: '/users',
    label: 'ইউজার পারমিশন',
    icon: ShieldCheck,
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'activity-logs',
    path: '/activity-logs',
    label: 'অ্যাক্টিভিটি লগ',
    icon: Activity,
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'সেটিংস',
    icon: Settings,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
];

function resolveModuleFromPath(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '') || '/dashboard';
  const found = NAV_MODULES.find((m) => m.path === clean);
  return found ? found.id : 'dashboard';
}

const MainAppShell: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const [activeModule, setActiveModule] = useState<string>(() =>
    resolveModuleFromPath(window.location.pathname)
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null
  );

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 4000);
    },
    []
  );

  const navigateTo = useCallback((moduleId: string) => {
    const mod = NAV_MODULES.find((m) => m.id === moduleId);
    if (mod) {
      window.history.pushState({}, '', mod.path);
      setActiveModule(mod.id);
      setMobileMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveModule(resolveModuleFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
        হোম রেসিপি ফুডস্ এইচআর সিস্টেম লোড হচ্ছে...
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const permittedModules = NAV_MODULES.filter((m) =>
    m.allowedRoles.includes(user.role)
  );

  const currentModConfig = NAV_MODULES.find((m) => m.id === activeModule);
  const isAuthorizedForCurrent =
    currentModConfig && currentModConfig.allowedRoles.includes(user.role);

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-slate-950 text-slate-200 border-r border-slate-800 shrink-0 no-print">
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="text-lg font-bold text-white tracking-tight">
            হোম রেসিপি ফুডস্
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            চট্টগ্রাম, বাংলাদেশ · HR System
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {permittedModules.map((mod) => {
            const Icon = mod.icon;
            const isActive = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => navigateTo(mod.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{mod.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="text-xs font-semibold text-white truncate">{user.name}</div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">
            {getRoleLabel(user.role)}
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full py-2 px-3 bg-slate-800 hover:bg-red-600/90 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>লগআউট (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-slate-950 text-slate-200 flex flex-col z-10">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <span className="text-base font-bold text-white">হোম রেসিপি ফুডস্</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {permittedModules.map((mod) => {
                const Icon = mod.icon;
                const isActive = activeModule === mod.id;
                return (
                  <button
                    key={mod.id}
                    onClick={() => navigateTo(mod.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium ${
                      isActive
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{mod.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800">
              <button
                onClick={logout}
                className="w-full py-2 px-3 bg-red-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>লগআউট</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract (Strictly 3 zones: Brand/Breadcrumb, Quick Nav, Action) */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 no-print">
          {/* Zone 1: Brand / Active Module Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-base font-bold text-slate-900 truncate">
              {currentModConfig?.label || 'ড্যাশবোর্ড'}
            </span>
          </div>

          {/* Zone 2: Clean Text Navigation Links */}
          <nav className="hidden xl:flex items-center gap-6 text-xs font-medium text-slate-600">
            <button
              onClick={() => navigateTo('dashboard')}
              className="hover:text-slate-900 hover:underline transition-colors whitespace-nowrap"
            >
              ড্যাশবোর্ড
            </button>
            <button
              onClick={() => navigateTo('employees')}
              className="hover:text-slate-900 hover:underline transition-colors whitespace-nowrap"
            >
              কর্মচারীগণ
            </button>
            <button
              onClick={() => navigateTo('absences')}
              className="hover:text-slate-900 hover:underline transition-colors whitespace-nowrap"
            >
              অনুপস্থিত
            </button>
            {user.role !== 'MANAGER' && (
              <button
                onClick={() => navigateTo('salary')}
                className="hover:text-slate-900 hover:underline transition-colors whitespace-nowrap"
              >
                সেলারি শিট
              </button>
            )}
          </nav>

          {/* Zone 3: Primary Account Action */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-600">
              {user.name} · {user.role}
            </span>
            <button
              onClick={() => navigateTo('settings')}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              সেটিংস
            </button>
          </div>
        </header>

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-3 text-xs no-print">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {!isAuthorizedForCurrent ? (
            <div className="bg-white border border-red-200 rounded-xl p-8 text-center space-y-3">
              <h3 className="text-base font-bold text-red-600">
                অননুমোদিত প্রবেশাধিকার (Unauthorized Access)
              </h3>
              <p className="text-xs text-slate-600">
                আপনার বর্তমান রোল ({getRoleLabel(user.role)}) দিয়ে এই মডিউলে প্রবেশ করার অনুমতি নেই।
              </p>
              <button
                onClick={() => navigateTo('dashboard')}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
              >
                ড্যাশবোর্ডে ফিরে যান
              </button>
            </div>
          ) : (
            <>
              {activeModule === 'dashboard' && (
                <DashboardView
                  onSelectEmployee={(id) => setSelectedEmployeeId(id)}
                  onNavigate={navigateTo}
                />
              )}
              {activeModule === 'employees' && (
                <EmployeesView
                  onSelectEmployee={(id) => setSelectedEmployeeId(id)}
                  showToast={showToast}
                />
              )}
              {activeModule === 'departments' && (
                <DepartmentsView showToast={showToast} />
              )}
              {activeModule === 'designations' && (
                <DesignationsView showToast={showToast} />
              )}
              {activeModule === 'leaves' && (
                <LeavesView
                  onSelectEmployee={(id) => setSelectedEmployeeId(id)}
                  showToast={showToast}
                />
              )}
              {activeModule === 'absences' && (
                <AbsencesView
                  onSelectEmployee={(id) => setSelectedEmployeeId(id)}
                  showToast={showToast}
                />
              )}
              {activeModule === 'snacks' && (
                <SnacksView
                  onSelectEmployee={(id) => setSelectedEmployeeId(id)}
                  showToast={showToast}
                />
              )}
              {activeModule === 'advances' && (
                <AdvancesView
                  onSelectEmployee={(id) => setSelectedEmployeeId(id)}
                  showToast={showToast}
                />
              )}
              {activeModule === 'salary' && (
                <SalarySheetView
                  onSelectEmployee={(id) => setSelectedEmployeeId(id)}
                  showToast={showToast}
                />
              )}
              {activeModule === 'reports' && (
                <ReportsView
                  onSelectEmployee={(id) => setSelectedEmployeeId(id)}
                  showToast={showToast}
                />
              )}
              {activeModule === 'users' && (
                <UsersPermissionView showToast={showToast} />
              )}
              {activeModule === 'activity-logs' && (
                <ActivityLogsView showToast={showToast} />
              )}
              {activeModule === 'settings' && (
                <SettingsView showToast={showToast} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Global Clickable Employee Profile Modal */}
      <EmployeeProfileModal
        employeeId={selectedEmployeeId}
        onClose={() => setSelectedEmployeeId(null)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainAppShell />
    </AuthProvider>
  );
}
