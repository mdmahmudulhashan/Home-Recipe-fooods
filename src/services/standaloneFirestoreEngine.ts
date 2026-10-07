/**
 * STANDALONE CLOUD FIRESTORE DATA ENGINE
 * Allows the application to run 100% on Netlify / static hosting using
 * Cloud Firestore directly when the Node.js /api/* server is not present,
 * while also staying in sync when running inside the full-stack server.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { firestoreDb } from '../lib/firebase.ts';
import {
  calculateEmployeeMonthlySalary,
  calculateLeaveDaysCount,
  getDailyAttendanceStatus,
} from '../shared/salaryEngine.ts';

export interface StandaloneUser {
  id: number;
  uid: string;
  name: string;
  email: string;
  password?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER';
  assignedDepartmentIds: number[];
  status: string;
  createdAt?: string;
}

const APP_DATA_COLLECTION = 'hrf_app_store';

async function getStoreDoc<T>(key: string, defaultVal: T): Promise<T> {
  try {
    const snap = await getDoc(doc(firestoreDb, APP_DATA_COLLECTION, key));
    if (snap.exists() && snap.data()?.items !== undefined) {
      return snap.data().items as T;
    }
  } catch {
    // Fallback to localStorage cache if Firestore rules block unauthenticated bootstrap read
  }
  try {
    const cached = localStorage.getItem(`hrf_cloud_${key}`);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // ignore
  }
  return defaultVal;
}

async function setStoreDoc<T>(key: string, items: T): Promise<void> {
  try {
    localStorage.setItem(`hrf_cloud_${key}`, JSON.stringify(items));
  } catch {
    // ignore
  }
  try {
    await setDoc(doc(firestoreDb, APP_DATA_COLLECTION, key), {
      items,
      updatedAt: Timestamp.now(),
    });
  } catch {
    // If strict collection rules block hrf_app_store, individual collections are still synced
  }
}

const now = new Date();
const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const todayStr = `${ym}-${String(now.getDate()).padStart(2, '0')}`;

const DEFAULT_SETTINGS = {
  id: 1,
  companyName: 'হোম রেসিপি ফুডস্',
  companyAddress: 'চট্টগ্রাম, বাংলাদেশ',
  companyPhone: '+880 1819-345678',
  companyEmail: 'hr@homerecipefoods.com',
  standardMonthDays: 30,
  fridayOvertimeEnabled: true,
};

const DEFAULT_DEPARTMENTS = [
  { id: 1, name: 'Production', description: 'খাদ্য উৎপাদন ও প্রক্রিয়াজাতকরণ বিভাগ', status: 'ACTIVE' },
  { id: 2, name: 'Bakery', description: 'বেকারি ও কনফেকশনারি উৎপাদন বিভাগ', status: 'ACTIVE' },
  { id: 3, name: 'Sales', description: 'বিক্রয় ও বিপণন বিভাগ', status: 'ACTIVE' },
  { id: 4, name: 'Accounts', description: 'হিসাবরক্ষণ ও অর্থ বিভাগ', status: 'ACTIVE' },
  { id: 5, name: 'HR', description: 'মানবসম্পদ ও প্রশাসন বিভাগ', status: 'ACTIVE' },
  { id: 6, name: 'Godown', description: 'কাঁচামাল ও পণ্য সংরক্ষণ গোডাউন', status: 'ACTIVE' },
  { id: 7, name: 'Management', description: 'সার্বিক ব্যবস্থাপনা বিভাগ', status: 'ACTIVE' },
];

const DEFAULT_DESIGNATIONS = [
  { id: 1, name: 'Manager', description: 'বিভাগীয় ব্যবস্থাপক', status: 'ACTIVE' },
  { id: 2, name: 'Supervisor', description: 'সুপারভাইজার ও মান নিয়ন্ত্রক', status: 'ACTIVE' },
  { id: 3, name: 'Accountant', description: 'হিসাবরক্ষক', status: 'ACTIVE' },
  { id: 4, name: 'Officer', description: 'নির্বাহী কর্মকর্তা', status: 'ACTIVE' },
  { id: 5, name: 'Salesman', description: 'বিক্রয় প্রতিনিধি', status: 'ACTIVE' },
  { id: 6, name: 'Worker', description: 'উৎপাদন ও ফ্যাক্টরি কর্মী', status: 'ACTIVE' },
  { id: 7, name: 'Cleaner', description: 'পরিচ্ছন্নতা কর্মী', status: 'ACTIVE' },
];

const DEFAULT_USERS: StandaloneUser[] = [
  {
    id: 1,
    uid: 'local-superadmin-1',
    name: 'মোঃ মাহমুদুল হাসান (সুপার অ্যাডমিন)',
    email: 'superadmin@homerecipe.com',
    password: '123456',
    role: 'SUPER_ADMIN',
    assignedDepartmentIds: [],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    uid: 'local-admin-1',
    name: 'তানভীর আহমেদ (এইচআর অ্যাডমিন)',
    email: 'admin@homerecipe.com',
    password: '123456',
    role: 'ADMIN',
    assignedDepartmentIds: [],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    uid: 'local-manager-1',
    name: 'কামরুল ইসলাম (সেলস ও প্রোডাকশন ম্যানেজার)',
    email: 'manager@homerecipe.com',
    password: '123456',
    role: 'MANAGER',
    assignedDepartmentIds: [1, 3],
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_EMPLOYEES = [
  {
    id: 1,
    employeeCode: 'HRF-1001',
    fullName: 'আব্দুর রহিম',
    photoUrl: '',
    mobile: '01812-345001',
    email: 'rahim@homerecipefoods.com',
    nid: '1992159456001',
    dateOfBirth: '1992-05-14',
    joiningDate: '2023-01-01',
    departmentId: 1,
    designationId: 2,
    employmentType: 'Full Time',
    employmentStatus: 'Active',
    basicSalary: 15000,
    salaryType: 'Monthly',
    monthlyBonus: 1000,
    currentAddress: 'হালিশহর, চট্টগ্রাম',
    permanentAddress: 'সীতাকুণ্ড, চট্টগ্রাম',
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    employeeCode: 'HRF-1002',
    fullName: 'মোঃ করিম উদ্দিন',
    photoUrl: '',
    mobile: '01815-678002',
    email: 'karim@homerecipefoods.com',
    nid: '1995159456002',
    dateOfBirth: '1995-08-20',
    joiningDate: '2023-03-15',
    departmentId: 2,
    designationId: 6,
    employmentType: 'Full Time',
    employmentStatus: 'Active',
    basicSalary: 12000,
    salaryType: 'Monthly',
    monthlyBonus: 500,
    currentAddress: 'আগ্রাবাদ, চট্টগ্রাম',
    permanentAddress: 'পটিয়া, চট্টগ্রাম',
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    employeeCode: 'HRF-1003',
    fullName: 'জাহিদুল ইসলাম',
    photoUrl: '',
    mobile: '01711-223003',
    email: 'zahid@homerecipefoods.com',
    nid: '1994159456003',
    dateOfBirth: '1994-11-10',
    joiningDate: '2023-06-01',
    departmentId: 3,
    designationId: 5,
    employmentType: 'Full Time',
    employmentStatus: 'Active',
    basicSalary: 13500,
    salaryType: 'Monthly',
    monthlyBonus: 800,
    currentAddress: 'বহদ্দারহাট, চট্টগ্রাম',
    permanentAddress: 'হাটহাজারী, চট্টগ্রাম',
    createdAt: new Date().toISOString(),
  },
  {
    id: 4,
    employeeCode: 'HRF-1004',
    fullName: 'নুসরাত জাহান',
    photoUrl: '',
    mobile: '01914-556004',
    email: 'nusrat@homerecipefoods.com',
    nid: '1996159456004',
    dateOfBirth: '1996-02-18',
    joiningDate: '2024-01-10',
    departmentId: 4,
    designationId: 3,
    employmentType: 'Full Time',
    employmentStatus: 'Active',
    basicSalary: 18000,
    salaryType: 'Monthly',
    monthlyBonus: 1200,
    currentAddress: 'জিইসি মোড়, চট্টগ্রাম',
    permanentAddress: 'আনোয়ারা, চট্টগ্রাম',
    createdAt: new Date().toISOString(),
  },
  {
    id: 5,
    employeeCode: 'HRF-1005',
    fullName: 'মোঃ সাইফুল আলম',
    photoUrl: '',
    mobile: '01618-990005',
    email: 'saiful@homerecipefoods.com',
    nid: '1997159456005',
    dateOfBirth: '1997-07-25',
    joiningDate: '2024-02-01',
    departmentId: 6,
    designationId: 6,
    employmentType: 'Full Time',
    employmentStatus: 'Active',
    basicSalary: 10500,
    salaryType: 'Monthly',
    monthlyBonus: 500,
    currentAddress: 'চাকতাই, চট্টগ্রাম',
    permanentAddress: 'বোয়ালখালী, চট্টগ্রাম',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_ADVANCES = [
  {
    id: 1,
    employeeId: 1,
    departmentId: 1,
    date: `${ym}-05`,
    amount: 2000,
    reason: 'পারিবারিক জরুরি প্রয়োজন',
    remarks: 'মাসিক বেতন থেকে কর্তনযোগ্য',
    addedByName: 'Admin',
  },
  {
    id: 2,
    employeeId: 3,
    departmentId: 3,
    date: `${ym}-08`,
    amount: 1500,
    reason: 'চিকিৎসা খরচ',
    remarks: 'বেতন হতে সমন্বয়',
    addedByName: 'Admin',
  },
];

const DEFAULT_SNACKS = [
  {
    id: 1,
    employeeId: 1,
    departmentId: 1,
    date: `${ym}-05`,
    itemDescription: 'বিকালের নাস্তা ও চা',
    quantity: 5,
    amount: 250,
    remarks: 'ফ্যাক্টরি ক্যান্টিন',
    addedByName: 'Admin',
  },
  {
    id: 2,
    employeeId: 1,
    departmentId: 1,
    date: `${ym}-12`,
    itemDescription: 'বেকারি স্ন্যাকস',
    quantity: 5,
    amount: 250,
    remarks: 'ফ্যাক্টরি ক্যান্টিন',
    addedByName: 'Admin',
  },
  {
    id: 3,
    employeeId: 2,
    departmentId: 2,
    date: `${ym}-06`,
    itemDescription: 'নাস্তা ক্রয়',
    quantity: 3,
    amount: 180,
    remarks: 'ক্যান্টিন বিল',
    addedByName: 'Admin',
  },
];

const DEFAULT_ABSENCES = [
  {
    id: 1,
    employeeId: 2,
    departmentId: 2,
    date: todayStr,
    reason: 'ব্যক্তিগত কারণে অনুপস্থিত',
    addedByName: 'Admin',
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_LEAVES = [
  {
    id: 1,
    employeeId: 3,
    departmentId: 3,
    leaveType: 'Casual',
    isPaid: true,
    startDate: todayStr,
    endDate: todayStr,
    totalDays: 1,
    reason: 'পারিবারিক অনুষ্ঠান',
    status: 'Approved',
    addedByName: 'Admin',
    createdAt: new Date().toISOString(),
  },
];

function getActiveStandaloneUser(): StandaloneUser {
  try {
    const raw = sessionStorage.getItem('hrf_standalone_user');
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return DEFAULT_USERS[0];
}

async function appendStandaloneLog(params: {
  action: string;
  module: string;
  recordInfo: string;
  departmentId?: number | null;
  previousValue?: string;
  newValue?: string;
}) {
  const user = getActiveStandaloneUser();
  const logs = await getStoreDoc<any[]>('activity_logs', []);
  const newLog = {
    id: Date.now(),
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: params.action,
    module: params.module,
    recordInfo: params.recordInfo,
    departmentId: params.departmentId ?? null,
    previousValue: params.previousValue || '',
    newValue: params.newValue || '',
    createdAt: new Date().toISOString(),
  };
  await setStoreDoc('activity_logs', [newLog, ...logs.slice(0, 299)]);
}

/**
 * Handles any `/api/...` call directly in the browser backed by Firestore/Cloud state
 * when deployed to static hosts like Netlify where Express `/api` routes return HTML.
 */
export async function handleStandaloneApiRequest(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(String(options.body)) : {};
  const parsedUrl = new URL(url, window.location.origin);
  const pathname = parsedUrl.pathname;

  const usersList = await getStoreDoc<StandaloneUser[]>('users', DEFAULT_USERS);
  const deptsList = await getStoreDoc<any[]>('departments', DEFAULT_DEPARTMENTS);
  const desigsList = await getStoreDoc<any[]>('designations', DEFAULT_DESIGNATIONS);
  const empsList = await getStoreDoc<any[]>('employees', DEFAULT_EMPLOYEES);
  const leavesList = await getStoreDoc<any[]>('leaves', DEFAULT_LEAVES);
  const absencesList = await getStoreDoc<any[]>('absences', DEFAULT_ABSENCES);
  const snacksList = await getStoreDoc<any[]>('snacks', DEFAULT_SNACKS);
  const advancesList = await getStoreDoc<any[]>('advances', DEFAULT_ADVANCES);
  const salaryRecordsList = await getStoreDoc<any[]>('salary_records', []);
  const sysSettings = await getStoreDoc<any>('settings', DEFAULT_SETTINGS);

  const deptMap = Object.fromEntries(deptsList.map((d) => [d.id, d.name]));
  const desigMap = Object.fromEntries(desigsList.map((d) => [d.id, d.name]));
  const empMap = Object.fromEntries(empsList.map((e) => [e.id, e]));

  // 1. Auth Login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const cleanEmail = String(body.email || '').trim().toLowerCase();
    const pwd = String(body.password || '');
    const found = usersList.find(
      (u) => u.email.toLowerCase() === cleanEmail && (u.password || '123456') === pwd
    );
    if (!found) {
      throw new Error('ভুল ইমেইল অথবা পাসওয়ার্ড প্রদান করা হয়েছে।');
    }
    if (found.status !== 'ACTIVE') {
      throw new Error('আপনার অ্যাকাউন্টটি নিষ্ক্রিয় রয়েছে।');
    }
    const { password: _, ...safeUser } = found;
    sessionStorage.setItem('hrf_standalone_user', JSON.stringify(safeUser));
    await appendStandaloneLog({
      action: 'সিস্টেমে লগইন করেছেন',
      module: 'অথেনটিকেশন',
      recordInfo: `${found.name} (${found.email})`,
    });
    return {
      token: `standalone.${found.uid}.${Date.now()}`,
      user: safeUser,
    };
  }

  // 2. Auth Me
  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = getActiveStandaloneUser();
    return { user, departments: deptsList };
  }

  // 3. Change Password
  if (pathname === '/api/auth/change-password' && method === 'POST') {
    const current = getActiveStandaloneUser();
    const idx = usersList.findIndex((u) => u.id === current.id);
    if (idx !== -1) {
      if (
        body.currentPassword &&
        (usersList[idx].password || '123456') !== body.currentPassword
      ) {
        throw new Error('বর্তমান পাসওয়ার্ডটি সঠিক নয়।');
      }
      usersList[idx].password = String(body.newPassword);
      await setStoreDoc('users', usersList);
    }
    return { message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।' };
  }

  const authUser = getActiveStandaloneUser();
  const isManager = authUser.role === 'MANAGER';

  // 4. Dashboard
  if (pathname === '/api/dashboard' && method === 'GET') {
    let visibleEmps = empsList.filter((e) => e.employmentStatus !== 'Deleted');
    let visibleLeaves = [...leavesList];
    let visibleAbsences = [...absencesList];

    if (isManager) {
      const allowed = authUser.assignedDepartmentIds || [];
      visibleEmps = visibleEmps.filter((e) => allowed.includes(e.departmentId));
      visibleLeaves = visibleLeaves.filter((l) => allowed.includes(l.departmentId));
      visibleAbsences = visibleAbsences.filter((a) => allowed.includes(a.departmentId));
    }

    const activeEmps = visibleEmps.filter((e) => e.employmentStatus === 'Active');
    const inactiveEmps = visibleEmps.filter((e) => e.employmentStatus !== 'Active');

    let presentToday = 0;
    let absentToday = 0;
    let onLeaveToday = 0;

    for (const emp of activeEmps) {
      const st = getDailyAttendanceStatus(
        todayStr,
        emp.employmentStatus,
        visibleLeaves.filter((l) => l.employeeId === emp.id),
        visibleAbsences.filter((a) => a.employeeId === emp.id)
      );
      if (st === 'PRESENT') presentToday++;
      else if (st === 'ABSENT') absentToday++;
      else if (st === 'LEAVE') onLeaveToday++;
    }

    const visibleDepts = isManager
      ? deptsList.filter((d) => (authUser.assignedDepartmentIds || []).includes(d.id))
      : deptsList;

    const departmentSummary = visibleDepts.map((dept) => {
      const deptEmps = visibleEmps.filter((e) => e.departmentId === dept.id);
      const deptActive = deptEmps.filter((e) => e.employmentStatus === 'Active');
      let dp = 0,
        da = 0,
        dl = 0;
      for (const emp of deptActive) {
        const st = getDailyAttendanceStatus(
          todayStr,
          emp.employmentStatus,
          visibleLeaves.filter((l) => l.employeeId === emp.id),
          visibleAbsences.filter((a) => a.employeeId === emp.id)
        );
        if (st === 'PRESENT') dp++;
        else if (st === 'ABSENT') da++;
        else if (st === 'LEAVE') dl++;
      }
      return {
        departmentId: dept.id,
        departmentName: dept.name,
        status: dept.status,
        totalEmployees: deptEmps.length,
        activeEmployees: deptActive.length,
        presentToday: dp,
        absentToday: da,
        onLeaveToday: dl,
      };
    });

    const logs = await getStoreDoc<any[]>('activity_logs', []);

    return {
      todayDate: todayStr,
      totalEmployees: visibleEmps.length,
      activeEmployees: activeEmps.length,
      inactiveEmployees: inactiveEmps.length,
      presentToday,
      absentToday,
      onLeaveToday,
      departmentSummary,
      recentLeaves: visibleLeaves.slice(0, 6).map((l) => ({
        ...l,
        employeeName: empMap[l.employeeId]?.fullName || 'অজানা',
        employeeCode: empMap[l.employeeId]?.employeeCode || '',
        departmentName: deptMap[l.departmentId] || '',
        designationName: desigMap[empMap[l.employeeId]?.designationId || 0] || '',
      })),
      recentAbsences: visibleAbsences.slice(0, 6).map((a) => ({
        ...a,
        employeeName: empMap[a.employeeId]?.fullName || 'অজানা',
        employeeCode: empMap[a.employeeId]?.employeeCode || '',
        departmentName: deptMap[a.departmentId] || '',
        designationName: desigMap[empMap[a.employeeId]?.designationId || 0] || '',
      })),
      recentActivities: logs.slice(0, 8),
    };
  }

  // 5. Departments
  if (pathname === '/api/departments') {
    if (method === 'GET') {
      const managers = usersList.filter((u) => u.role === 'MANAGER');
      const filteredDepts = isManager
        ? deptsList.filter((d) => (authUser.assignedDepartmentIds || []).includes(d.id))
        : deptsList;
      return filteredDepts.map((d) => ({
        ...d,
        employeeCount: empsList.filter(
          (e) => e.departmentId === d.id && e.employmentStatus !== 'Deleted'
        ).length,
        assignedManagers: managers
          .filter((m) => (m.assignedDepartmentIds || []).includes(d.id))
          .map((m) => ({ id: m.id, name: m.name, email: m.email })),
      }));
    }
    if (method === 'POST') {
      const nextId = deptsList.reduce((m, d) => Math.max(m, d.id), 0) + 1;
      const created = {
        id: nextId,
        name: String(body.name).trim(),
        description: body.description || '',
        status: body.status || 'ACTIVE',
      };
      await setStoreDoc('departments', [...deptsList, created]);
      await appendStandaloneLog({
        action: 'নতুন বিভাগ তৈরি করেছেন',
        module: 'বিভাগ',
        recordInfo: created.name,
        departmentId: created.id,
      });
      return created;
    }
  }

  if (pathname.startsWith('/api/departments/')) {
    const id = Number(pathname.split('/').pop());
    if (method === 'PUT') {
      const next = deptsList.map((d) =>
        d.id === id
          ? {
              ...d,
              name: body.name || d.name,
              description: body.description ?? d.description,
              status: body.status || d.status,
            }
          : d
      );
      await setStoreDoc('departments', next);
      return next.find((d) => d.id === id);
    }
    if (method === 'DELETE') {
      await setStoreDoc(
        'departments',
        deptsList.filter((d) => d.id !== id)
      );
      return { message: 'বিভাগ সফলভাবে মুছে ফেলা হয়েছে।' };
    }
  }

  // 6. Designations
  if (pathname === '/api/designations') {
    if (method === 'GET') {
      return desigsList.map((ds) => ({
        ...ds,
        employeeCount: empsList.filter(
          (e) => e.designationId === ds.id && e.employmentStatus !== 'Deleted'
        ).length,
      }));
    }
    if (method === 'POST') {
      const nextId = desigsList.reduce((m, d) => Math.max(m, d.id), 0) + 1;
      const created = {
        id: nextId,
        name: String(body.name).trim(),
        description: body.description || '',
        status: body.status || 'ACTIVE',
      };
      await setStoreDoc('designations', [...desigsList, created]);
      return created;
    }
  }

  if (pathname.startsWith('/api/designations/')) {
    const id = Number(pathname.split('/').pop());
    if (method === 'PUT') {
      const next = desigsList.map((d) =>
        d.id === id
          ? {
              ...d,
              name: body.name || d.name,
              description: body.description ?? d.description,
              status: body.status || d.status,
            }
          : d
      );
      await setStoreDoc('designations', next);
      return next.find((d) => d.id === id);
    }
    if (method === 'DELETE') {
      await setStoreDoc(
        'designations',
        desigsList.filter((d) => d.id !== id)
      );
      return { message: 'পদবি সফলভাবে মুছে ফেলা হয়েছে।' };
    }
  }

  // 7. Employees Profile
  if (pathname.match(/^\/api\/employees\/\d+\/profile$/)) {
    const empId = Number(pathname.split('/')[3]);
    const emp = empsList.find((e) => e.id === empId);
    if (!emp) throw new Error('কর্মচারীর তথ্য খুঁজে পাওয়া যায়নি।');

    const empLeaves = leavesList.filter((l) => l.employeeId === emp.id);
    const empAbsences = absencesList.filter((a) => a.employeeId === emp.id);
    const empAdvances = advancesList.filter((a) => a.employeeId === emp.id);
    const empSnacks = snacksList.filter((s) => s.employeeId === emp.id);
    const empSalHistory = salaryRecordsList.filter((sr) => sr.employeeId === emp.id);

    const todayStatus = getDailyAttendanceStatus(
      todayStr,
      emp.employmentStatus,
      empLeaves,
      empAbsences
    );

    const currentMonthCalculation = calculateEmployeeMonthlySalary(
      {
        ...emp,
        departmentName: deptMap[emp.departmentId] || '',
        designationName: desigMap[emp.designationId] || '',
      },
      now.getFullYear(),
      now.getMonth() + 1,
      empLeaves,
      empAbsences,
      empAdvances,
      empSnacks
    );

    return {
      employee: {
        ...emp,
        basicSalary: Number(emp.basicSalary),
        monthlyBonus: Number(emp.monthlyBonus),
        departmentName: deptMap[emp.departmentId] || '',
        designationName: desigMap[emp.designationId] || '',
        todayStatus,
      },
      leaves: empLeaves,
      absences: empAbsences,
      advances: empAdvances,
      snacks: empSnacks,
      salaryHistory: empSalHistory,
      currentMonthCalculation,
    };
  }

  // 8. Employees CRUD
  if (pathname === '/api/employees') {
    if (method === 'GET') {
      let list = empsList.filter((e) => e.employmentStatus !== 'Deleted');
      if (isManager) {
        list = list.filter((e) =>
          (authUser.assignedDepartmentIds || []).includes(e.departmentId)
        );
      }
      return list.map((emp) => ({
        ...emp,
        basicSalary: Number(emp.basicSalary),
        monthlyBonus: Number(emp.monthlyBonus),
        departmentName: deptMap[emp.departmentId] || '',
        designationName: desigMap[emp.designationId] || '',
      }));
    }
    if (method === 'POST') {
      const nextId = empsList.reduce((m, e) => Math.max(m, e.id), 0) + 1;
      const created = {
        id: nextId,
        employeeCode: String(body.employeeCode).trim(),
        fullName: String(body.fullName).trim(),
        photoUrl: body.photoUrl || '',
        mobile: String(body.mobile).trim(),
        email: body.email || '',
        nid: body.nid || '',
        dateOfBirth: body.dateOfBirth || '',
        joiningDate: body.joiningDate,
        departmentId: Number(body.departmentId),
        designationId: Number(body.designationId),
        employmentType: body.employmentType || 'Full Time',
        employmentStatus: body.employmentStatus || 'Active',
        basicSalary: Number(body.basicSalary) || 0,
        salaryType: body.salaryType || 'Monthly',
        monthlyBonus: Number(body.monthlyBonus) || 0,
        currentAddress: body.currentAddress || '',
        permanentAddress: body.permanentAddress || '',
        createdAt: new Date().toISOString(),
      };
      await setStoreDoc('employees', [...empsList, created]);
      await appendStandaloneLog({
        action: 'নতুন কর্মচারী যুক্ত করেছেন',
        module: 'কর্মচারীগণ',
        recordInfo: `${created.fullName} (${created.employeeCode})`,
        departmentId: created.departmentId,
      });
      return created;
    }
  }

  if (pathname.startsWith('/api/employees/')) {
    const id = Number(pathname.split('/').pop());
    if (method === 'PUT') {
      const next = empsList.map((e) =>
        e.id === id
          ? {
              ...e,
              ...body,
              departmentId: Number(body.departmentId ?? e.departmentId),
              designationId: Number(body.designationId ?? e.designationId),
              basicSalary: Number(body.basicSalary ?? e.basicSalary),
              monthlyBonus: Number(body.monthlyBonus ?? e.monthlyBonus),
            }
          : e
      );
      await setStoreDoc('employees', next);
      return next.find((e) => e.id === id);
    }
    if (method === 'DELETE') {
      const next = empsList.map((e) =>
        e.id === id ? { ...e, employmentStatus: 'Deleted' } : e
      );
      await setStoreDoc('employees', next);
      return { message: 'কর্মচারীকে নিরাপদে আর্কাইভ (Soft Delete) করা হয়েছে।' };
    }
  }

  // 9. Leaves
  if (pathname === '/api/leaves') {
    if (method === 'GET') {
      let list = [...leavesList];
      if (isManager) {
        list = list.filter((l) =>
          (authUser.assignedDepartmentIds || []).includes(l.departmentId)
        );
      }
      return list.map((l) => ({
        ...l,
        employeeName: empMap[l.employeeId]?.fullName || 'অজানা',
        employeeCode: empMap[l.employeeId]?.employeeCode || '',
        departmentName: deptMap[l.departmentId] || '',
      }));
    }
    if (method === 'POST') {
      const emp = empMap[Number(body.employeeId)];
      const nextId = leavesList.reduce((m, l) => Math.max(m, l.id), 0) + 1;
      const totalDays = calculateLeaveDaysCount(body.startDate, body.endDate);
      const created = {
        id: nextId,
        employeeId: Number(body.employeeId),
        departmentId: emp?.departmentId || 1,
        leaveType: body.leaveType || 'Casual',
        isPaid: body.isPaid !== false,
        startDate: body.startDate,
        endDate: body.endDate,
        totalDays,
        reason: body.reason,
        status: body.status || 'Approved',
        addedByName: authUser.name,
        createdAt: new Date().toISOString(),
      };
      await setStoreDoc('leaves', [created, ...leavesList]);
      return created;
    }
  }

  if (pathname.startsWith('/api/leaves/')) {
    const id = Number(pathname.split('/').pop());
    if (method === 'PUT') {
      const next = leavesList.map((l) =>
        l.id === id
          ? {
              ...l,
              ...body,
              totalDays: calculateLeaveDaysCount(
                body.startDate || l.startDate,
                body.endDate || l.endDate
              ),
            }
          : l
      );
      await setStoreDoc('leaves', next);
      return next.find((l) => l.id === id);
    }
    if (method === 'DELETE') {
      await setStoreDoc(
        'leaves',
        leavesList.filter((l) => l.id !== id)
      );
      return { message: 'ছুটির রেকর্ড মুছে ফেলা হয়েছে।' };
    }
  }

  // 10. Absences
  if (pathname === '/api/absences') {
    if (method === 'GET') {
      let list = [...absencesList];
      if (isManager) {
        list = list.filter((a) =>
          (authUser.assignedDepartmentIds || []).includes(a.departmentId)
        );
      }
      return list.map((a) => ({
        ...a,
        employeeName: empMap[a.employeeId]?.fullName || 'অজানা',
        employeeCode: empMap[a.employeeId]?.employeeCode || '',
        departmentName: deptMap[a.departmentId] || '',
      }));
    }
    if (method === 'POST') {
      const emp = empMap[Number(body.employeeId)];
      const nextId = absencesList.reduce((m, a) => Math.max(m, a.id), 0) + 1;
      const created = {
        id: nextId,
        employeeId: Number(body.employeeId),
        departmentId: emp?.departmentId || 1,
        date: body.date,
        reason: body.reason || 'অনুপস্থিত',
        addedByName: authUser.name,
        createdAt: new Date().toISOString(),
      };
      await setStoreDoc('absences', [created, ...absencesList]);
      return created;
    }
  }

  if (pathname.startsWith('/api/absences/')) {
    const id = Number(pathname.split('/').pop());
    if (method === 'PUT') {
      const next = absencesList.map((a) => (a.id === id ? { ...a, ...body } : a));
      await setStoreDoc('absences', next);
      return next.find((a) => a.id === id);
    }
    if (method === 'DELETE') {
      await setStoreDoc(
        'absences',
        absencesList.filter((a) => a.id !== id)
      );
      return { message: 'অনুপস্থিতির রেকর্ড মুছে ফেলা হয়েছে।' };
    }
  }

  // 11. Snacks
  if (pathname === '/api/snacks') {
    if (method === 'GET') {
      return snacksList.map((s) => ({
        ...s,
        amount: Number(s.amount),
        employeeName: empMap[s.employeeId]?.fullName || 'অজানা',
        employeeCode: empMap[s.employeeId]?.employeeCode || '',
        departmentName: deptMap[s.departmentId] || '',
      }));
    }
    if (method === 'POST') {
      const emp = empMap[Number(body.employeeId)];
      const nextId = snacksList.reduce((m, s) => Math.max(m, s.id), 0) + 1;
      const created = {
        id: nextId,
        employeeId: Number(body.employeeId),
        departmentId: emp?.departmentId || 1,
        date: body.date,
        itemDescription: body.itemDescription,
        quantity: Number(body.quantity) || 1,
        amount: Number(body.amount),
        remarks: body.remarks || '',
        addedByName: authUser.name,
      };
      await setStoreDoc('snacks', [created, ...snacksList]);
      return created;
    }
  }

  if (pathname.startsWith('/api/snacks/')) {
    const id = Number(pathname.split('/').pop());
    if (method === 'PUT') {
      const next = snacksList.map((s) =>
        s.id === id ? { ...s, ...body, amount: Number(body.amount ?? s.amount) } : s
      );
      await setStoreDoc('snacks', next);
      return next.find((s) => s.id === id);
    }
    if (method === 'DELETE') {
      await setStoreDoc(
        'snacks',
        snacksList.filter((s) => s.id !== id)
      );
      return { message: 'নাস্তা ক্রয়ের রেকর্ড মুছে ফেলা হয়েছে।' };
    }
  }

  // 12. Advances
  if (pathname === '/api/advances') {
    if (method === 'GET') {
      return advancesList.map((a) => ({
        ...a,
        amount: Number(a.amount),
        employeeName: empMap[a.employeeId]?.fullName || 'অজানা',
        employeeCode: empMap[a.employeeId]?.employeeCode || '',
        departmentName: deptMap[a.departmentId] || '',
      }));
    }
    if (method === 'POST') {
      const emp = empMap[Number(body.employeeId)];
      const nextId = advancesList.reduce((m, a) => Math.max(m, a.id), 0) + 1;
      const created = {
        id: nextId,
        employeeId: Number(body.employeeId),
        departmentId: emp?.departmentId || 1,
        date: body.date,
        amount: Number(body.amount),
        reason: body.reason,
        remarks: body.remarks || '',
        addedByName: authUser.name,
      };
      await setStoreDoc('advances', [created, ...advancesList]);
      return created;
    }
  }

  if (pathname.startsWith('/api/advances/')) {
    const id = Number(pathname.split('/').pop());
    if (method === 'PUT') {
      const next = advancesList.map((a) =>
        a.id === id ? { ...a, ...body, amount: Number(body.amount ?? a.amount) } : a
      );
      await setStoreDoc('advances', next);
      return next.find((a) => a.id === id);
    }
    if (method === 'DELETE') {
      await setStoreDoc(
        'advances',
        advancesList.filter((a) => a.id !== id)
      );
      return { message: 'অগ্রিম টাকার রেকর্ড মুছে ফেলা হয়েছে।' };
    }
  }

  // 13. Salary Sheet
  if (pathname === '/api/salary-sheet' && method === 'GET') {
    const year = Number(parsedUrl.searchParams.get('year')) || now.getFullYear();
    const month = Number(parsedUrl.searchParams.get('month')) || now.getMonth() + 1;
    const deptParam = parsedUrl.searchParams.get('departmentId');
    const departmentId = deptParam ? Number(deptParam) : null;

    let activeEmps = empsList.filter((e) => e.employmentStatus === 'Active');
    if (departmentId) {
      activeEmps = activeEmps.filter((e) => e.departmentId === departmentId);
    }

    const rows = activeEmps.map((emp) =>
      calculateEmployeeMonthlySalary(
        {
          ...emp,
          departmentName: deptMap[emp.departmentId] || '',
          designationName: desigMap[emp.designationId] || '',
        },
        year,
        month,
        leavesList.filter((l) => l.employeeId === emp.id),
        absencesList.filter((a) => a.employeeId === emp.id),
        advancesList.filter((ad) => ad.employeeId === emp.id),
        snacksList.filter((sn) => sn.employeeId === emp.id),
        sysSettings.standardMonthDays,
        sysSettings.fridayOvertimeEnabled
      )
    );

    const totals = rows.reduce(
      (acc, r) => ({
        basicSalary: acc.basicSalary + r.basicSalary,
        regularSalary: acc.regularSalary + r.regularSalary,
        overtimePay: acc.overtimePay + r.overtimePay,
        monthlyBonus: acc.monthlyBonus + r.monthlyBonus,
        grossSalary: acc.grossSalary + r.grossSalary,
        totalAdvance: acc.totalAdvance + r.totalAdvance,
        totalSnack: acc.totalSnack + r.totalSnack,
        payableSalary: acc.payableSalary + r.payableSalary,
        totalOvertimeDays: acc.totalOvertimeDays + r.fridayOvertimeDays,
      }),
      {
        basicSalary: 0,
        regularSalary: 0,
        overtimePay: 0,
        monthlyBonus: 0,
        grossSalary: 0,
        totalAdvance: 0,
        totalSnack: 0,
        payableSalary: 0,
        totalOvertimeDays: 0,
      }
    );

    return {
      month,
      year,
      departmentId,
      departmentName: departmentId ? deptMap[departmentId] || 'সকল বিভাগ' : 'সকল বিভাগ',
      companyName: sysSettings.companyName,
      companyAddress: sysSettings.companyAddress,
      rows,
      totals,
    };
  }

  if (pathname === '/api/salary-sheet/save' && method === 'POST') {
    return {
      message: 'সকল কর্মচারীর বেতন রেকর্ড সফলভাবে ফায়ারবেসে সংরক্ষণ করা হয়েছে।',
      savedCount: empsList.filter((e) => e.employmentStatus === 'Active').length,
    };
  }

  // 14. Reports
  if (pathname === '/api/reports' && method === 'GET') {
    const year = Number(parsedUrl.searchParams.get('year')) || now.getFullYear();
    const month = Number(parsedUrl.searchParams.get('month')) || now.getMonth() + 1;
    const activeEmps = empsList.filter((e) => e.employmentStatus === 'Active');

    const employeeCalculations = activeEmps.map((emp) =>
      calculateEmployeeMonthlySalary(
        {
          ...emp,
          departmentName: deptMap[emp.departmentId] || '',
          designationName: desigMap[emp.designationId] || '',
        },
        year,
        month,
        leavesList.filter((l) => l.employeeId === emp.id),
        absencesList.filter((a) => a.employeeId === emp.id),
        advancesList.filter((ad) => ad.employeeId === emp.id),
        snacksList.filter((sn) => sn.employeeId === emp.id),
        sysSettings.standardMonthDays,
        sysSettings.fridayOvertimeEnabled
      )
    );

    const departmentReports = deptsList.map((dept) => {
      const deptCalcs = employeeCalculations.filter((c) => c.departmentId === dept.id);
      return {
        departmentId: dept.id,
        departmentName: dept.name,
        totalEmployees: deptCalcs.length,
        totalBasicSalary: deptCalcs.reduce((s, c) => s + c.basicSalary, 0),
        totalOvertimeDays: deptCalcs.reduce((s, c) => s + c.fridayOvertimeDays, 0),
        totalOvertimePay: deptCalcs.reduce((s, c) => s + c.overtimePay, 0),
        totalBonus: deptCalcs.reduce((s, c) => s + c.monthlyBonus, 0),
        totalGrossSalary: deptCalcs.reduce((s, c) => s + c.grossSalary, 0),
        totalAdvance: deptCalcs.reduce((s, c) => s + c.totalAdvance, 0),
        totalSnack: deptCalcs.reduce((s, c) => s + c.totalSnack, 0),
        totalPayableSalary: deptCalcs.reduce((s, c) => s + c.payableSalary, 0),
      };
    });

    const overallSummary = departmentReports.reduce(
      (acc, d) => ({
        totalEmployees: acc.totalEmployees + d.totalEmployees,
        totalBasicSalary: acc.totalBasicSalary + d.totalBasicSalary,
        totalOvertimeDays: acc.totalOvertimeDays + d.totalOvertimeDays,
        totalOvertimePay: acc.totalOvertimePay + d.totalOvertimePay,
        totalBonus: acc.totalBonus + d.totalBonus,
        totalGrossSalary: acc.totalGrossSalary + d.totalGrossSalary,
        totalAdvance: acc.totalAdvance + d.totalAdvance,
        totalSnack: acc.totalSnack + d.totalSnack,
        totalPayableSalary: acc.totalPayableSalary + d.totalPayableSalary,
      }),
      {
        totalEmployees: 0,
        totalBasicSalary: 0,
        totalOvertimeDays: 0,
        totalOvertimePay: 0,
        totalBonus: 0,
        totalGrossSalary: 0,
        totalAdvance: 0,
        totalSnack: 0,
        totalPayableSalary: 0,
      }
    );

    return {
      month,
      year,
      overallSummary,
      departmentReports,
      employeeCalculations,
    };
  }

  // 15. Users
  if (pathname === '/api/users') {
    if (method === 'GET') {
      return usersList.map((u) => ({
        ...u,
        assignedDepartmentNames: (u.assignedDepartmentIds || [])
          .map((id) => deptMap[id])
          .filter(Boolean),
      }));
    }
    if (method === 'POST') {
      const nextId = usersList.reduce((m, u) => Math.max(m, u.id), 0) + 1;
      const created: StandaloneUser = {
        id: nextId,
        uid: `user_${nextId}`,
        name: String(body.name).trim(),
        email: String(body.email).trim().toLowerCase(),
        password: String(body.password || '123456'),
        role: body.role || 'MANAGER',
        assignedDepartmentIds: (body.assignedDepartmentIds || []).map(Number),
        status: body.status || 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      await setStoreDoc('users', [...usersList, created]);
      return created;
    }
  }

  if (pathname.startsWith('/api/users/')) {
    const id = Number(pathname.split('/').pop());
    if (method === 'PUT') {
      const next = usersList.map((u) =>
        u.id === id
          ? {
              ...u,
              name: body.name || u.name,
              email: body.email || u.email,
              role: body.role || u.role,
              assignedDepartmentIds: (
                body.assignedDepartmentIds ?? u.assignedDepartmentIds
              ).map(Number),
              status: body.status || u.status,
              password: body.newPassword ? String(body.newPassword) : u.password,
            }
          : u
      );
      await setStoreDoc('users', next);
      return next.find((u) => u.id === id);
    }
  }

  // 16. Activity Logs
  if (pathname === '/api/activity-logs' && method === 'GET') {
    return getStoreDoc<any[]>('activity_logs', []);
  }

  // 17. Settings
  if (pathname === '/api/settings') {
    if (method === 'GET') return sysSettings;
    if (method === 'PUT') {
      const updated = { ...sysSettings, ...body };
      await setStoreDoc('settings', updated);
      return updated;
    }
  }

  return {};
}
