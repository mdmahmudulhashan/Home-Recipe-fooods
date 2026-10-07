/**
 * CENTRALIZED FIREBASE MODULAR SDK SERVICES
 * Home Recipe Foods — Chattogram, Bangladesh
 *
 * Reusable modular services for:
 * 1. Authentication (authService)
 * 2. Employees (employeeService)
 * 3. Departments (departmentService)
 * 4. Designations (designationService)
 * 5. Leaves (leaveService)
 * 6. Absences (absenceService)
 * 7. Advances (advanceService)
 * 8. Snack Purchases (snackPurchaseService)
 * 9. Salary Records & Salary Sheets (salaryService)
 * 10. Reports (reportService)
 * 11. Activity Logs (activityLogService)
 * 12. File Uploads (fileUploadService)
 *
 * Every CRUD write operation mirrors and verifies persistence in Cloud Firestore
 * (`getDocFromServer`) when a Firebase Auth user session is active, while also
 * persisting via the authenticated backend API so all data reloads cleanly on page refresh.
 */

import {
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
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
  OperationType,
  handleFirestoreError,
} from '../lib/firebase.ts';
import { handleStandaloneApiRequest } from './standaloneFirestoreEngine.ts';

export type ApiFetcher = <T = any>(url: string, options?: RequestInit) => Promise<T>;

function withFastTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
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

/**
 * Helper to verify that a document written to Cloud Firestore exists on the server.
 * Only runs when `auth.currentUser` is signed in with a verified email so it
 * complies with our strict production `firestore.rules`.
 */
async function syncAndVerifyFirestoreDoc(
  collectionName: string,
  docId: string,
  data: Record<string, any>,
  isCreate = false
): Promise<boolean> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) {
    return false;
  }

  const cleanDocId = String(docId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const docRef = doc(firestoreDb, collectionName, cleanDocId);
  const fullPath = `${collectionName}/${cleanDocId}`;

  try {
    return await withFastTimeout(
      (async () => {
        const payload: Record<string, any> = {
          ...data,
          updatedAt: serverTimestamp(),
        };

        if (isCreate) {
          payload.createdAt = serverTimestamp();
        } else {
          const existingSnap = await getDoc(docRef);
          if (existingSnap.exists() && existingSnap.data()?.createdAt) {
            payload.createdAt = existingSnap.data().createdAt;
          } else {
            payload.createdAt = serverTimestamp();
          }
          if (
            existingSnap.exists() &&
            existingSnap.data()?.createdBy &&
            !payload.createdBy
          ) {
            payload.createdBy = existingSnap.data().createdBy;
          }
        }

        await setDoc(docRef, payload);

        // Explicitly verify from server that the document was persisted in Firestore
        const verifiedSnap = await getDocFromServer(docRef);
        return verifiedSnap.exists();
      })(),
      2500
    );
  } catch (error) {
    // If permission denied due to role restrictions, log via structured handler only when appropriate
    if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
      try {
        handleFirestoreError(
          error,
          isCreate ? OperationType.CREATE : OperationType.UPDATE,
          fullPath
        );
      } catch {
        // Caught after structured logging so UI flow remains uninterrupted
      }
    }
    return false;
  }
}

async function removeAndVerifyFirestoreDoc(
  collectionName: string,
  docId: string
): Promise<boolean> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) {
    return false;
  }

  const cleanDocId = String(docId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const docRef = doc(firestoreDb, collectionName, cleanDocId);
  try {
    return await withFastTimeout(
      (async () => {
        await deleteDoc(docRef);
        const snap = await getDocFromServer(docRef);
        return !snap.exists();
      })(),
      2000
    );
  } catch {
    return false;
  }
}

// ============================================================================
// 1. AUTHENTICATION SERVICE
// ============================================================================
export const authService = {
  async loginWithEmail(email: string, password: string) {
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname.includes('netlify.app') ||
        window.sessionStorage.getItem('hrf_standalone_mode') === '1')
    ) {
      return await handleStandaloneApiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    }

    // Attempt Firebase Auth sign-in in the background without blocking login UI
    signInWithEmailAndPassword(auth, email.trim(), password).catch(() => {
      // Non-blocking background attempt
    });

    try {
      const res = await withFastTimeout(
        fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        }),
        2500
      );
      const rawText = await res.text();
      const trimmed = rawText.trim();
      if (
        trimmed.startsWith('<') ||
        trimmed.toLowerCase().startsWith('<!doctype') ||
        !trimmed.startsWith('{')
      ) {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('hrf_standalone_mode', '1');
        }
        return await handleStandaloneApiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      }
      const data = JSON.parse(trimmed);
      if (!res.ok) {
        throw new Error(data.error || 'লগইন ব্যর্থ হয়েছে।');
      }
      return data;
    } catch (err: any) {
      if (
        err instanceof SyntaxError ||
        String(err?.message || '').includes('timeout') ||
        String(err?.message || '').includes('Unexpected token') ||
        String(err?.message || '').includes('Failed to fetch') ||
        String(err?.message || '').includes('NetworkError')
      ) {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('hrf_standalone_mode', '1');
        }
        return await handleStandaloneApiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      }
      throw err;
    }
  },

  async loginWithGooglePopup(apiFetch: ApiFetcher) {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await result.user.getIdToken();
    const data = await apiFetch<{ user: any }>('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    // Ensure user profile is synced and verified in Firestore /users/{uid}
    if (result.user.emailVerified) {
      await syncAndVerifyFirestoreDoc(
        'users',
        result.user.uid,
        {
          uid: result.user.uid,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          assignedDepartmentIds: data.user.assignedDepartmentIds || [],
          status: data.user.status || 'ACTIVE',
        },
        true
      );
    }

    return { token: idToken, user: data.user };
  },

  async changePassword(
    apiFetch: ApiFetcher,
    currentPassword: string,
    newPassword: string
  ) {
    if (auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, newPassword);
      } catch {
        // Proceed with server-side credential update
      }
    }
    return apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async logout() {
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
  },
};

// ============================================================================
// 2. FILE UPLOAD SERVICE (Firebase Storage)
// ============================================================================
export const fileUploadService = {
  async uploadEmployeePhoto(employeeCode: string, dataUrl: string): Promise<string> {
    if (!dataUrl || !dataUrl.startsWith('data:image/') || !auth.currentUser) {
      return dataUrl;
    }
    const cleanCode = String(employeeCode).replace(/[^a-zA-Z0-9_-]/g, '_');
    const storagePath = `employee-photos/${cleanCode}/profile.jpg`;
    const photoRef = ref(storage, storagePath);

    try {
      return await withFastTimeout(
        (async () => {
          await uploadString(photoRef, dataUrl, 'data_url');
          return await getDownloadURL(photoRef);
        })(),
        2500
      );
    } catch {
      return dataUrl;
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

    await withFastTimeout(uploadBytes(docRef, file), 4000);
    const url = await withFastTimeout(getDownloadURL(docRef), 2500);
    return { name: file.name, url };
  },

  async deleteEmployeePhoto(employeeCode: string): Promise<void> {
    if (!auth.currentUser) {
      return;
    }
    try {
      const cleanCode = String(employeeCode).replace(/[^a-zA-Z0-9_-]/g, '_');
      const photoRef = ref(storage, `employee-photos/${cleanCode}/profile.jpg`);
      await withFastTimeout(deleteObject(photoRef), 1500);
    } catch {
      // Ignore if file was not uploaded to Storage or timed out
    }
  },
};

// ============================================================================
// 3. EMPLOYEES SERVICE
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

    const created = await apiFetch<any>('/api/employees', {
      method: 'POST',
      body: JSON.stringify({ ...payload, photoUrl: finalPhotoUrl }),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'employees',
      created.employeeCode,
      {
        employeeId: String(created.employeeCode),
        name: String(created.fullName),
        profilePhotoUrl: String(created.photoUrl || ''),
        mobile: String(created.mobile),
        email: String(created.email || ''),
        nid: String(created.nid || ''),
        dateOfBirth: String(created.dateOfBirth || ''),
        joiningDate: String(created.joiningDate),
        departmentId: Number(created.departmentId),
        designationId: Number(created.designationId),
        employmentType: String(created.employmentType || 'Full Time'),
        employmentStatus: String(created.employmentStatus || 'Active'),
        basicSalary: Number(created.basicSalary || 0),
        salaryType: String(created.salaryType || 'Monthly'),
        monthlyBonus: Number(created.monthlyBonus || 0),
        currentAddress: String(created.currentAddress || ''),
        permanentAddress: String(created.permanentAddress || ''),
        createdBy: uid,
        updatedBy: uid,
      },
      true
    );

    return created;
  },

  async update(apiFetch: ApiFetcher, id: number, payload: Record<string, any>) {
    let finalPhotoUrl = payload.photoUrl || '';
    if (finalPhotoUrl.startsWith('data:image/')) {
      finalPhotoUrl = await fileUploadService.uploadEmployeePhoto(
        payload.employeeCode,
        finalPhotoUrl
      );
    }

    const updated = await apiFetch<any>(`/api/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, photoUrl: finalPhotoUrl }),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'employees',
      updated.employeeCode,
      {
        employeeId: String(updated.employeeCode),
        name: String(updated.fullName),
        profilePhotoUrl: String(updated.photoUrl || ''),
        mobile: String(updated.mobile),
        email: String(updated.email || ''),
        nid: String(updated.nid || ''),
        dateOfBirth: String(updated.dateOfBirth || ''),
        joiningDate: String(updated.joiningDate),
        departmentId: Number(updated.departmentId),
        designationId: Number(updated.designationId),
        employmentType: String(updated.employmentType || 'Full Time'),
        employmentStatus: String(updated.employmentStatus || 'Active'),
        basicSalary: Number(updated.basicSalary || 0),
        salaryType: String(updated.salaryType || 'Monthly'),
        monthlyBonus: Number(updated.monthlyBonus || 0),
        currentAddress: String(updated.currentAddress || ''),
        permanentAddress: String(updated.permanentAddress || ''),
        createdBy: uid,
        updatedBy: uid,
      },
      false
    );

    return updated;
  },

  async remove(apiFetch: ApiFetcher, employee: any) {
    await fileUploadService.deleteEmployeePhoto(employee.employeeCode);
    const res = await apiFetch<any>(`/api/employees/${employee.id}`, {
      method: 'DELETE',
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'employees',
      employee.employeeCode,
      {
        employeeId: String(employee.employeeCode),
        name: String(employee.fullName),
        profilePhotoUrl: '',
        mobile: String(employee.mobile),
        email: String(employee.email || ''),
        nid: String(employee.nid || ''),
        dateOfBirth: String(employee.dateOfBirth || ''),
        joiningDate: String(employee.joiningDate),
        departmentId: Number(employee.departmentId),
        designationId: Number(employee.designationId),
        employmentType: String(employee.employmentType || 'Full Time'),
        employmentStatus: 'Deleted',
        basicSalary: Number(employee.basicSalary || 0),
        salaryType: String(employee.salaryType || 'Monthly'),
        monthlyBonus: Number(employee.monthlyBonus || 0),
        currentAddress: String(employee.currentAddress || ''),
        permanentAddress: String(employee.permanentAddress || ''),
        createdBy: uid,
        updatedBy: uid,
      },
      false
    );

    return res;
  },
};

// ============================================================================
// 4. DEPARTMENTS SERVICE
// ============================================================================
export const departmentService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/departments');
  },

  async create(apiFetch: ApiFetcher, payload: {
    name: string;
    description: string;
    status: string;
    managerIds: number[];
  }) {
    const created = await apiFetch<any>('/api/departments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'departments',
      `dept_${created.id}`,
      {
        name: String(created.name),
        description: String(created.description || ''),
        status: String(created.status || 'ACTIVE'),
        managerIds: (payload.managerIds || []).map(String),
        createdBy: uid,
        updatedBy: uid,
      },
      true
    );

    return created;
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
    const updated = await apiFetch<any>(`/api/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'departments',
      `dept_${updated.id}`,
      {
        name: String(updated.name),
        description: String(updated.description || ''),
        status: String(updated.status || 'ACTIVE'),
        managerIds: (payload.managerIds || []).map(String),
        createdBy: uid,
        updatedBy: uid,
      },
      false
    );

    return updated;
  },

  async remove(apiFetch: ApiFetcher, id: number) {
    const res = await apiFetch<any>(`/api/departments/${id}`, {
      method: 'DELETE',
    });
    await removeAndVerifyFirestoreDoc('departments', `dept_${id}`);
    return res;
  },
};

// ============================================================================
// 5. DESIGNATIONS SERVICE
// ============================================================================
export const designationService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/designations');
  },

  async create(
    apiFetch: ApiFetcher,
    payload: { name: string; description: string; status: string }
  ) {
    const created = await apiFetch<any>('/api/designations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'designations',
      `desig_${created.id}`,
      {
        name: String(created.name),
        description: String(created.description || ''),
        status: String(created.status || 'ACTIVE'),
        createdBy: uid,
        updatedBy: uid,
      },
      true
    );

    return created;
  },

  async update(
    apiFetch: ApiFetcher,
    id: number,
    payload: { name: string; description: string; status: string }
  ) {
    const updated = await apiFetch<any>(`/api/designations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'designations',
      `desig_${updated.id}`,
      {
        name: String(updated.name),
        description: String(updated.description || ''),
        status: String(updated.status || 'ACTIVE'),
        createdBy: uid,
        updatedBy: uid,
      },
      false
    );

    return updated;
  },

  async remove(apiFetch: ApiFetcher, id: number) {
    const res = await apiFetch<any>(`/api/designations/${id}`, {
      method: 'DELETE',
    });
    await removeAndVerifyFirestoreDoc('designations', `desig_${id}`);
    return res;
  },
};

// ============================================================================
// 6. LEAVES SERVICE
// ============================================================================
export const leaveService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/leaves');
  },

  async create(apiFetch: ApiFetcher, payload: Record<string, any>) {
    const created = await apiFetch<any>('/api/leaves', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'leaves',
      `leave_${created.id}`,
      {
        employeeId: Number(created.employeeId),
        departmentId: Number(created.departmentId),
        leaveType: String(created.leaveType),
        isPaid: Boolean(created.isPaid),
        startDate: String(created.startDate),
        endDate: String(created.endDate),
        totalDays: Number(created.totalDays),
        reason: String(created.reason),
        status: String(created.status),
        addedBy: String(created.addedByName || 'Admin'),
        createdBy: uid,
        updatedBy: uid,
      },
      true
    );

    return created;
  },

  async update(apiFetch: ApiFetcher, id: number, payload: Record<string, any>) {
    const updated = await apiFetch<any>(`/api/leaves/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'leaves',
      `leave_${updated.id}`,
      {
        employeeId: Number(updated.employeeId),
        departmentId: Number(updated.departmentId),
        leaveType: String(updated.leaveType),
        isPaid: Boolean(updated.isPaid),
        startDate: String(updated.startDate),
        endDate: String(updated.endDate),
        totalDays: Number(updated.totalDays),
        reason: String(updated.reason),
        status: String(updated.status),
        addedBy: String(updated.addedByName || 'Admin'),
        createdBy: uid,
        updatedBy: uid,
      },
      false
    );

    return updated;
  },

  async remove(apiFetch: ApiFetcher, id: number) {
    const res = await apiFetch<any>(`/api/leaves/${id}`, {
      method: 'DELETE',
    });
    await removeAndVerifyFirestoreDoc('leaves', `leave_${id}`);
    return res;
  },
};

// ============================================================================
// 7. ABSENCES SERVICE
// ============================================================================
export const absenceService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/absences');
  },

  async create(apiFetch: ApiFetcher, payload: Record<string, any>) {
    const created = await apiFetch<any>('/api/absences', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'absences',
      `absence_${created.id}`,
      {
        employeeId: Number(created.employeeId),
        departmentId: Number(created.departmentId),
        date: String(created.date),
        reason: String(created.reason),
        addedBy: String(created.addedByName || 'User'),
        createdBy: uid,
        updatedBy: uid,
      },
      true
    );

    return created;
  },

  async update(apiFetch: ApiFetcher, id: number, payload: Record<string, any>) {
    const updated = await apiFetch<any>(`/api/absences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'absences',
      `absence_${updated.id}`,
      {
        employeeId: Number(updated.employeeId),
        departmentId: Number(updated.departmentId),
        date: String(updated.date),
        reason: String(updated.reason),
        addedBy: String(updated.addedByName || 'User'),
        createdBy: uid,
        updatedBy: uid,
      },
      false
    );

    return updated;
  },

  async remove(apiFetch: ApiFetcher, id: number) {
    const res = await apiFetch<any>(`/api/absences/${id}`, {
      method: 'DELETE',
    });
    await removeAndVerifyFirestoreDoc('absences', `absence_${id}`);
    return res;
  },
};

// ============================================================================
// 8. SNACK PURCHASES SERVICE
// ============================================================================
export const snackPurchaseService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/snacks');
  },

  async create(apiFetch: ApiFetcher, payload: Record<string, any>) {
    const created = await apiFetch<any>('/api/snacks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'snack_purchases',
      `snack_${created.id}`,
      {
        employeeId: Number(created.employeeId),
        departmentId: Number(created.departmentId),
        date: String(created.date),
        item: String(created.itemDescription),
        quantity: Number(created.quantity || 1),
        amount: Number(created.amount),
        remarks: String(created.remarks || ''),
        addedBy: String(created.addedByName || 'Admin'),
        createdBy: uid,
        updatedBy: uid,
      },
      true
    );

    return created;
  },

  async update(apiFetch: ApiFetcher, id: number, payload: Record<string, any>) {
    const updated = await apiFetch<any>(`/api/snacks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'snack_purchases',
      `snack_${updated.id}`,
      {
        employeeId: Number(updated.employeeId),
        departmentId: Number(updated.departmentId),
        date: String(updated.date),
        item: String(updated.itemDescription),
        quantity: Number(updated.quantity || 1),
        amount: Number(updated.amount),
        remarks: String(updated.remarks || ''),
        addedBy: String(updated.addedByName || 'Admin'),
        createdBy: uid,
        updatedBy: uid,
      },
      false
    );

    return updated;
  },

  async remove(apiFetch: ApiFetcher, id: number) {
    const res = await apiFetch<any>(`/api/snacks/${id}`, {
      method: 'DELETE',
    });
    await removeAndVerifyFirestoreDoc('snack_purchases', `snack_${id}`);
    return res;
  },
};

// ============================================================================
// 9. ADVANCES SERVICE
// ============================================================================
export const advanceService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/advances');
  },

  async create(apiFetch: ApiFetcher, payload: Record<string, any>) {
    const created = await apiFetch<any>('/api/advances', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'advances',
      `advance_${created.id}`,
      {
        employeeId: Number(created.employeeId),
        departmentId: Number(created.departmentId),
        date: String(created.date),
        amount: Number(created.amount),
        reason: String(created.reason),
        remarks: String(created.remarks || ''),
        addedBy: String(created.addedByName || 'Admin'),
        createdBy: uid,
        updatedBy: uid,
      },
      true
    );

    return created;
  },

  async update(apiFetch: ApiFetcher, id: number, payload: Record<string, any>) {
    const updated = await apiFetch<any>(`/api/advances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    const uid = auth.currentUser?.uid || 'system';
    await syncAndVerifyFirestoreDoc(
      'advances',
      `advance_${updated.id}`,
      {
        employeeId: Number(updated.employeeId),
        departmentId: Number(updated.departmentId),
        date: String(updated.date),
        amount: Number(updated.amount),
        reason: String(updated.reason),
        remarks: String(updated.remarks || ''),
        addedBy: String(updated.addedByName || 'Admin'),
        createdBy: uid,
        updatedBy: uid,
      },
      false
    );

    return updated;
  },

  async remove(apiFetch: ApiFetcher, id: number) {
    const res = await apiFetch<any>(`/api/advances/${id}`, {
      method: 'DELETE',
    });
    await removeAndVerifyFirestoreDoc('advances', `advance_${id}`);
    return res;
  },
};

// ============================================================================
// 10. SALARY RECORDS & SALARY SHEETS SERVICE
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
    const res = await apiFetch<any>('/api/salary-sheet/save', {
      method: 'POST',
      body: JSON.stringify({
        year,
        month,
        departmentId: departmentId !== 'ALL' ? Number(departmentId) : null,
      }),
    });

    const uid = auth.currentUser?.uid || 'system';
    const deptNum = departmentId !== 'ALL' ? Number(departmentId) : 0;
    const sheetId = `sheet_${year}_${month}_${deptNum}`;

    if (sheetData) {
      await syncAndVerifyFirestoreDoc(
        'salary_sheets',
        sheetId,
        {
          month: Number(month),
          year: Number(year),
          departmentId: deptNum,
          totalEmployees: Number(sheetData.rows?.length || 0),
          totalPayableSalary: Number(sheetData.totals?.payableSalary || 0),
          createdBy: uid,
          updatedBy: uid,
        },
        true
      );

      for (const row of sheetData.rows || []) {
        await syncAndVerifyFirestoreDoc(
          'salary_records',
          `sal_${year}_${month}_${row.employeeId}`,
          {
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
          },
          true
        );
      }
    }

    return res;
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
    const apiLogs = await apiFetch<any[]>('/api/activity-logs');
    if (auth.currentUser?.emailVerified) {
      try {
        const q = query(
          collection(firestoreDb, 'activity_logs'),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        await getDocs(q);
      } catch {
        // Fallback to API logs if Firestore query is restricted for current session
      }
    }
    return apiLogs;
  },

  async recordLog(params: {
    userName: string;
    role: string;
    action: string;
    module: string;
    recordId: string;
    employeeId?: string;
    previousValue?: string;
    newValue?: string;
  }) {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.emailVerified) return false;
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const docRef = doc(firestoreDb, 'activity_logs', logId);
    try {
      await setDoc(docRef, {
        userId: fbUser.uid,
        userName: params.userName.slice(0, 120),
        role: params.role.slice(0, 40),
        action: params.action.slice(0, 200),
        module: params.module.slice(0, 80),
        recordId: params.recordId.slice(0, 120),
        employeeId: (params.employeeId || '').slice(0, 64),
        previousValue: (params.previousValue || '').slice(0, 2000),
        newValue: (params.newValue || '').slice(0, 2000),
        timestamp: serverTimestamp(),
      });
      const snap = await getDocFromServer(docRef);
      return snap.exists();
    } catch {
      return false;
    }
  },
};

export const userManagementService = {
  async list(apiFetch: ApiFetcher) {
    return apiFetch<any[]>('/api/users');
  },

  async create(apiFetch: ApiFetcher, payload: Record<string, any>) {
    const created = await apiFetch<any>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    await syncAndVerifyFirestoreDoc(
      'users',
      `user_${created.id}`,
      {
        uid: `user_${created.id}`,
        name: String(created.name),
        email: String(created.email),
        role: String(created.role),
        assignedDepartmentIds: (created.assignedDepartmentIds || []).map(Number),
        status: String(created.status || 'ACTIVE'),
      },
      true
    );

    return created;
  },

  async update(apiFetch: ApiFetcher, id: number, payload: Record<string, any>) {
    const updated = await apiFetch<any>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    await syncAndVerifyFirestoreDoc(
      'users',
      `user_${updated.id}`,
      {
        uid: `user_${updated.id}`,
        name: String(updated.name),
        email: String(updated.email),
        role: String(updated.role),
        assignedDepartmentIds: (updated.assignedDepartmentIds || []).map(Number),
        status: String(updated.status || 'ACTIVE'),
      },
      false
    );

    return updated;
  },
};

export const settingsService = {
  async get(apiFetch: ApiFetcher) {
    return apiFetch<any>('/api/settings');
  },

  async update(apiFetch: ApiFetcher, payload: Record<string, any>) {
    const updated = await apiFetch<any>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    const uid = auth.currentUser?.uid || 'system';
    const docRef = doc(firestoreDb, 'settings', 'company_config');
    if (auth.currentUser?.emailVerified) {
      try {
        await setDoc(docRef, {
          companyName: String(updated.companyName),
          companyAddress: String(updated.companyAddress),
          companyPhone: String(updated.companyPhone || ''),
          companyEmail: String(updated.companyEmail || ''),
          standardMonthDays: Number(updated.standardMonthDays || 30),
          fridayOvertimeEnabled: Boolean(updated.fridayOvertimeEnabled),
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        });
        await getDocFromServer(docRef);
      } catch {
        // ignore if not super admin in firestore
      }
    }

    return updated;
  },
};
