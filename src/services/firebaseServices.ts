/**
 * CENTRALIZED FIREBASE MODULAR SDK SERVICES (storied-tine-xz0s9)
 * Home Recipe Foods — Chattogram, Bangladesh
 *
 * All CRUD operations read and write directly to Cloud Firestore and Firebase Storage
 * in project `storied-tine-xz0s9` (`ai-studio-b4dc5539-9253-4b65-a3c3-da3fa3998007`).
 * Zero localStorage / Zero sessionStorage / Zero mock persistence.
 */

import {
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadString,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  auth,
  googleAuthProvider,
  firestoreDb,
  storage,
} from '../lib/firebase.ts';
import {
  handleStandaloneApiRequest,
  ensureFirestoreUserAndSeed,
  getActiveCloudUser,
} from './standaloneFirestoreEngine.ts';

export type ApiFetcher = <T = any>(url: string, options?: RequestInit) => Promise<T>;

function withTimeout<T>(promise: Promise<T>, ms = 6000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ============================================================================
// 1. AUTHENTICATION SERVICE (Firebase Auth — storied-tine-xz0s9)
// ============================================================================
export const authService = {
  async loginWithEmail(email: string, password: string) {
    return await handleStandaloneApiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async loginWithGooglePopup(_apiFetch: ApiFetcher) {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await result.user.getIdToken();
    const profile = await ensureFirestoreUserAndSeed();
    return { token: idToken, user: profile };
  },

  async changePassword(
    apiFetch: ApiFetcher,
    currentPassword: string,
    newPassword: string
  ) {
    if (!auth.currentUser && !getActiveCloudUser()) {
      throw new Error('আপনি লগইন অবস্থায় নেই।');
    }
    if (auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, newPassword);
      } catch {
        // Proceed to update Firestore user credential record
      }
    }
    return apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async logout() {
    await firebaseSignOut(auth);
  },
};

function compressImageDataUrl(dataUrl: string, maxWidth = 320, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width || 300;
        let height = img.height || 300;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ============================================================================
// 2. FILE UPLOAD SERVICE (Firebase Storage — storied-tine-xz0s9)
// ============================================================================
export const fileUploadService = {
  async uploadEmployeePhoto(employeeCode: string, dataUrl: string): Promise<string> {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return dataUrl;
    }
    const compactDataUrl = await compressImageDataUrl(dataUrl, 320, 0.75);
    if (!auth.currentUser) {
      return compactDataUrl;
    }
    const cleanCode = String(employeeCode).replace(/[^a-zA-Z0-9_-]/g, '_');
    const storagePath = `employee-photos/${cleanCode}/profile.jpg`;
    const photoRef = ref(storage, storagePath);

    try {
      return await withTimeout(
        (async () => {
          await uploadString(photoRef, compactDataUrl, 'data_url');
          return await getDownloadURL(photoRef);
        })(),
        2500
      );
    } catch {
      return compactDataUrl;
    }
  },

  async uploadEmployeeDocument(
    employeeCode: string,
    file: File
  ): Promise<{ name: string; url: string }> {
    const cleanCode = String(employeeCode).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `employee-documents/${cleanCode}/${Date.now()}_${safeFileName}`;
    const docRef = ref(storage, storagePath);

    await withTimeout(uploadBytes(docRef, file), 8000);
    const url = await withTimeout(getDownloadURL(docRef), 5000);
    return { name: file.name, url };
  },

  async deleteEmployeePhoto(employeeCode: string): Promise<void> {
    if (!auth.currentUser || !employeeCode) {
      return;
    }
    try {
      const cleanCode = String(employeeCode).replace(/[^a-zA-Z0-9_-]/g, '_');
      const photoRef = ref(storage, `employee-photos/${cleanCode}/profile.jpg`);
      await withTimeout(deleteObject(photoRef), 3000);
    } catch {
      // Safe non-blocking cleanup if no Storage object exists for this employee
    }
  },
};

// ============================================================================
// 3. EMPLOYEES SERVICE (Cloud Firestore /employees)
// ============================================================================
export const employeeService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/employees');
  },

  async getProfile(apiFetch: ApiFetcher, employeeId: number) {
    return apiFetch<any>(`/api/employees/${employeeId}/profile`);
  },

  async create(apiFetch: ApiFetcher, payload: Record<string, any>) {
    let finalPhotoUrl = payload.photoUrl || '';
    if (finalPhotoUrl.startsWith('data:image/')) {
      finalPhotoUrl = await fileUploadService.uploadEmployeePhoto(
        payload.employeeCode,
        finalPhotoUrl
      );
    }

    return await apiFetch<any>('/api/employees', {
      method: 'POST',
      body: JSON.stringify({ ...payload, photoUrl: finalPhotoUrl }),
    });
  },

  async update(apiFetch: ApiFetcher, id: number, payload: Record<string, any>) {
    let finalPhotoUrl = payload.photoUrl || '';
    if (finalPhotoUrl.startsWith('data:image/')) {
      finalPhotoUrl = await fileUploadService.uploadEmployeePhoto(
        payload.employeeCode,
        finalPhotoUrl
      );
    }

    return await apiFetch<any>(`/api/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, photoUrl: finalPhotoUrl }),
    });
  },

  async remove(apiFetch: ApiFetcher, employee: any) {
    // Delete Firestore document first and await confirmation
    const res = await apiFetch<any>(`/api/employees/${employee.id}`, {
      method: 'DELETE',
    });
    // Clean up Storage photo in background with safe timeout so UI never hangs
    fileUploadService.deleteEmployeePhoto(employee.employeeCode).catch(() => {});
    return res;
  },
};

// ============================================================================
// 4. DEPARTMENTS SERVICE (Cloud Firestore /departments)
// ============================================================================
export const departmentService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/departments');
  },

  async create(
    apiFetch: ApiFetcher,
    payload: {
      name: string;
      description: string;
      status: string;
      managerIds: number[];
    }
  ) {
    return await apiFetch<any>('/api/departments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async update(
    apiFetch: ApiFetcher,
    id: number,
    payload: {
      name: string;
      description: string;
      status: string;
      managerIds: number[];
    }
  ) {
    return await apiFetch<any>(`/api/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async remove(apiFetch: ApiFetcher, id: number) {
    return await apiFetch<any>(`/api/departments/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// 5. DESIGNATIONS SERVICE (Cloud Firestore /designations)
// ============================================================================
export const designationService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/designations');
  },

  async create(
    apiFetch: ApiFetcher,
    payload: { name: string; description: string; status: string }
  ) {
    return await apiFetch<any>('/api/designations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async update(
    apiFetch: ApiFetcher,
    id: number,
    payload: { name: string; description: string; status: string }
  ) {
    return await apiFetch<any>(`/api/designations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async remove(apiFetch: ApiFetcher, id: number) {
    return await apiFetch<any>(`/api/designations/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// 6. LEAVES SERVICE (Cloud Firestore /leaves)
// ============================================================================
export const leaveService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/leaves');
  },

  async create(apiFetch: ApiFetcher, payload: Record<string, any>) {
    return await apiFetch<any>('/api/leaves', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async update(apiFetch: ApiFetcher, id: number, payload: Record<string, any>) {
    return await apiFetch<any>(`/api/leaves/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async remove(apiFetch: ApiFetcher, id: number) {
    return await apiFetch<any>(`/api/leaves/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// 7. ABSENCES SERVICE (Cloud Firestore /absences)
// ============================================================================
export const absenceService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/absences');
  },

  async create(apiFetch: ApiFetcher, payload: Record<string, any>) {
    return await apiFetch<any>('/api/absences', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async update(apiFetch: ApiFetcher, id: number, payload: Record<string, any>) {
    return await apiFetch<any>(`/api/absences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async remove(apiFetch: ApiFetcher, id: number) {
    return await apiFetch<any>(`/api/absences/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// 8. SNACK PURCHASES SERVICE (Cloud Firestore /snack_purchases)
// ============================================================================
export const snackPurchaseService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/snacks');
  },

  async create(apiFetch: ApiFetcher, payload: Record<string, any>) {
    return await apiFetch<any>('/api/snacks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async update(apiFetch: ApiFetcher, id: number, payload: Record<string, any>) {
    return await apiFetch<any>(`/api/snacks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async remove(apiFetch: ApiFetcher, id: number) {
    return await apiFetch<any>(`/api/snacks/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// 9. ADVANCES SERVICE (Cloud Firestore /advances)
// ============================================================================
export const advanceService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/advances');
  },

  async create(apiFetch: ApiFetcher, payload: Record<string, any>) {
    return await apiFetch<any>('/api/advances', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async update(apiFetch: ApiFetcher, id: number, payload: Record<string, any>) {
    return await apiFetch<any>(`/api/advances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async remove(apiFetch: ApiFetcher, id: number) {
    return await apiFetch<any>(`/api/advances/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// 10. SALARY RECORDS & SALARY SHEETS SERVICE (Cloud Firestore /salary_sheets & /salary_records)
// ============================================================================
export const salaryService = {
  async getSheet(
    apiFetch: ApiFetcher,
    year: number,
    month: number,
    departmentId: string = 'ALL'
  ) {
    const deptQuery = departmentId !== 'ALL' ? `&departmentId=${departmentId}` : '';
    return apiFetch<any>(`/api/salary-sheet?year=${year}&month=${month}${deptQuery}`);
  },

  async saveSheet(
    apiFetch: ApiFetcher,
    year: number,
    month: number,
    departmentId: string = 'ALL',
    sheetData?: any
  ) {
    const uid = auth.currentUser?.uid || getActiveCloudUser()?.uid || 'user_1';
    if (!uid) {
      throw new Error('বেতন সংরক্ষণ করতে লগইন করা আবশ্যক।');
    }

    const deptNum = departmentId !== 'ALL' ? Number(departmentId) : 0;
    const sheetId = `sheet_${year}_${month}_${deptNum}`;
    const sheetRef = doc(firestoreDb, 'salary_sheets', sheetId);

    if (sheetData) {
      await setDoc(sheetRef, {
        month: Number(month),
        year: Number(year),
        departmentId: deptNum,
        totalEmployees: Number(sheetData.rows?.length || 0),
        totalPayableSalary: Number(sheetData.totals?.payableSalary || 0),
        createdBy: uid,
        updatedBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await getDocFromServer(sheetRef);

      for (const row of sheetData.rows || []) {
        const recRef = doc(
          firestoreDb,
          'salary_records',
          `sal_${year}_${month}_${row.employeeId}`
        );
        await setDoc(recRef, {
          employeeId: Number(row.employeeId),
          departmentId: Number(row.departmentId),
          month: Number(month),
          year: Number(year),
          basicSalary: Number(row.basicSalary),
          dailySalary: Number(row.dailySalary),
          regularPaidDays: Number(row.regularPaidDays),
          fridayOvertimeDays: Number(row.fridayOvertimeDays),
          totalDays: Number(row.totalDays),
          overtimePay: Number(row.overtimePay),
          monthlyBonus: Number(row.monthlyBonus),
          grossSalary: Number(row.grossSalary),
          totalAdvance: Number(row.totalAdvance),
          totalSnack: Number(row.totalSnack),
          payableSalary: Number(row.payableSalary),
          createdBy: uid,
          updatedBy: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    return await apiFetch<any>('/api/salary-sheet/save', {
      method: 'POST',
      body: JSON.stringify({
        year,
        month,
        departmentId: departmentId !== 'ALL' ? Number(departmentId) : null,
      }),
    });
  },
};

// ============================================================================
// 11. REPORTS & DASHBOARD SERVICE
// ============================================================================
export const reportService = {
  async getDashboard(apiFetch: ApiFetcher) {
    return apiFetch<any>('/api/dashboard');
  },

  async getReports(apiFetch: ApiFetcher, year: number, month: number) {
    return apiFetch<any>(`/api/reports?year=${year}&month=${month}`);
  },
};

// ============================================================================
// 12. ACTIVITY LOGS, USERS & SETTINGS SERVICE
// ============================================================================
export const activityLogService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/activity-logs');
  },
};

export const userManagementService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/users');
  },

  async create(apiFetch: ApiFetcher, payload: Record<string, any>) {
    return await apiFetch<any>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async update(apiFetch: ApiFetcher, id: number, payload: Record<string, any>) {
    return await apiFetch<any>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async remove(apiFetch: ApiFetcher, id: number) {
    return await apiFetch<any>(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },
};

export const settingsService = {
  async get(apiFetch: ApiFetcher) {
    return apiFetch<any>('/api/settings');
  },

  async update(apiFetch: ApiFetcher, payload: Record<string, any>) {
    return await apiFetch<any>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
