import { db } from '../db/index.ts';
import {
  activityLogs,
  departments,
  designations,
  employees,
  leaves,
  absences,
  snackPurchases,
  advances,
  settings,
  users,
} from '../db/schema.ts';
import { hashPassword } from '../lib/crypto.ts';
import { AuthenticatedUser } from '../middleware/auth.ts';
import { syncDocToFirestore } from '../lib/firebase-admin.ts';
import { count } from 'drizzle-orm';

export async function logActivity(params: {
  user?: AuthenticatedUser;
  action: string;
  module: string;
  recordInfo: string;
  departmentId?: number | null;
  previousValue?: string;
  newValue?: string;
}) {
  try {
    const [inserted] = await db
      .insert(activityLogs)
      .values({
        userId: params.user?.id || null,
        userName: params.user?.name || 'System',
        userRole: params.user?.role || 'SYSTEM',
        action: params.action,
        module: params.module,
        recordInfo: params.recordInfo,
        departmentId: params.departmentId ?? null,
        previousValue: params.previousValue || '',
        newValue: params.newValue || '',
      })
      .returning();

    if (inserted) {
      await syncDocToFirestore(
        'activity_logs',
        `log_${inserted.id}`,
        {
          userId: String(params.user?.uid || params.user?.id || 'system'),
          userName: params.user?.name || 'System',
          role: params.user?.role || 'SYSTEM',
          action: params.action,
          module: params.module,
          recordId: String(inserted.id),
          employeeId: params.recordInfo.slice(0, 64),
          previousValue: (params.previousValue || '').slice(0, 1900),
          newValue: (params.newValue || '').slice(0, 1900),
        },
        true
      );
    }
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}

let isInitialized = false;

export async function ensureInitialData() {
  if (isInitialized) return;
  try {
    // 1. Settings
    const existingSettings = await db.select().from(settings);
    if (existingSettings.length === 0) {
      await db.insert(settings).values({
        companyName: 'হোম রেসিপি ফুডস্',
        companyAddress: 'চট্টগ্রাম, বাংলাদেশ',
        companyPhone: '+880 1819-345678',
        companyEmail: 'hr@homerecipefoods.com',
        standardMonthDays: 30,
        fridayOvertimeEnabled: true,
      });
    }

    // 2. Departments
    const existingDepts = await db.select().from(departments);
    let deptMap: Record<string, number> = {};
    if (existingDepts.length === 0) {
      const initialDepts = [
        { name: 'Production', description: 'খাদ্য উৎপাদন ও প্রক্রিয়াজাতকরণ বিভাগ' },
        { name: 'Bakery', description: 'বেকারি ও কনফেকশনারি উৎপাদন বিভাগ' },
        { name: 'Sales', description: 'বিক্রয় ও বিপণন বিভাগ' },
        { name: 'Accounts', description: 'হিসাবরক্ষণ ও অর্থ বিভাগ' },
        { name: 'HR', description: 'মানবসম্পদ ও প্রশাসন বিভাগ' },
        { name: 'Godown', description: 'কাঁচামাল ও পণ্য সংরক্ষণ গোডাউন' },
        { name: 'Management', description: 'সার্বিক ব্যবস্থাপনা বিভাগ' },
      ];
      for (const d of initialDepts) {
        const [inserted] = await db
          .insert(departments)
          .values({ name: d.name, description: d.description, status: 'ACTIVE' })
          .onConflictDoNothing()
          .returning();
        if (inserted) deptMap[d.name] = inserted.id;
      }
    } else {
      for (const d of existingDepts) {
        deptMap[d.name] = d.id;
      }
    }

    // 3. Designations
    const existingDesigs = await db.select().from(designations);
    let desigMap: Record<string, number> = {};
    if (existingDesigs.length === 0) {
      const initialDesigs = [
        { name: 'Manager', description: 'বিভাগীয় ব্যবস্থাপক' },
        { name: 'Supervisor', description: 'সুপারভাইজার ও মান নিয়ন্ত্রক' },
        { name: 'Accountant', description: 'হিসাবরক্ষক' },
        { name: 'Officer', description: 'নির্বাহী কর্মকর্তা' },
        { name: 'Salesman', description: 'বিক্রয় প্রতিনিধি' },
        { name: 'Worker', description: 'উৎপাদন ও ফ্যাক্টরি কর্মী' },
        { name: 'Cleaner', description: 'পরিচ্ছন্নতা কর্মী' },
      ];
      for (const ds of initialDesigs) {
        const [inserted] = await db
          .insert(designations)
          .values({ name: ds.name, description: ds.description, status: 'ACTIVE' })
          .onConflictDoNothing()
          .returning();
        if (inserted) desigMap[ds.name] = inserted.id;
      }
    } else {
      for (const ds of existingDesigs) {
        desigMap[ds.name] = ds.id;
      }
    }

    // 4. Default Role Accounts (Super Admin, Admin, Manager)
    const userCountRes = await db.select({ value: count() }).from(users);
    if (Number(userCountRes[0]?.value || 0) === 0) {
      const salesDeptId = deptMap['Sales'] || 1;
      const prodDeptId = deptMap['Production'] || 1;

      await db
        .insert(users)
        .values([
          {
            uid: 'local-superadmin-1',
            name: 'মোঃ মাহমুদুল হাসান (সুপার অ্যাডমিন)',
            email: 'superadmin@homerecipe.com',
            passwordHash: hashPassword('123456'),
            role: 'SUPER_ADMIN',
            assignedDepartmentIds: '[]',
            status: 'ACTIVE',
          },
          {
            uid: 'local-admin-1',
            name: 'তানভীর আহমেদ (এইচআর অ্যাডমিন)',
            email: 'admin@homerecipe.com',
            passwordHash: hashPassword('123456'),
            role: 'ADMIN',
            assignedDepartmentIds: '[]',
            status: 'ACTIVE',
          },
          {
            uid: 'local-manager-1',
            name: 'কামরুল ইসলাম (সেলস ও প্রোডাকশন ম্যানেজার)',
            email: 'manager@homerecipe.com',
            passwordHash: hashPassword('123456'),
            role: 'MANAGER',
            assignedDepartmentIds: JSON.stringify([salesDeptId, prodDeptId]),
            status: 'ACTIVE',
          },
        ])
        .onConflictDoNothing();
    }

    // 5. Initial Real-World Employees (if table empty)
    const empCountRes = await db.select({ value: count() }).from(employees);
    if (Number(empCountRes[0]?.value || 0) === 0) {
      const allUsers = await db.select().from(users);
      const adminUser = allUsers[0];

      const prodId = deptMap['Production'] || 1;
      const bakeryId = deptMap['Bakery'] || prodId;
      const salesId = deptMap['Sales'] || prodId;
      const accId = deptMap['Accounts'] || prodId;
      const godownId = deptMap['Godown'] || prodId;

      const supId = desigMap['Supervisor'] || 1;
      const workerId = desigMap['Worker'] || 1;
      const salesmanId = desigMap['Salesman'] || 1;
      const accDesigId = desigMap['Accountant'] || 1;

      const insertedEmps = await db
        .insert(employees)
        .values([
          {
            employeeCode: 'HRF-1001',
            fullName: 'আব্দুর রহিম',
            mobile: '01812-345001',
            email: 'rahim@homerecipefoods.com',
            nid: '1992159456001',
            dateOfBirth: '1992-05-14',
            joiningDate: '2023-01-01',
            departmentId: prodId,
            designationId: supId,
            employmentType: 'Full Time',
            employmentStatus: 'Active',
            basicSalary: '15000',
            salaryType: 'Monthly',
            monthlyBonus: '1000',
            currentAddress: 'হালিশহর, চট্টগ্রাম',
            permanentAddress: 'সীতাকুণ্ড, চট্টগ্রাম',
          },
          {
            employeeCode: 'HRF-1002',
            fullName: 'মোঃ করিম উদ্দিন',
            mobile: '01815-678002',
            email: 'karim@homerecipefoods.com',
            nid: '1995159456002',
            dateOfBirth: '1995-08-20',
            joiningDate: '2023-03-15',
            departmentId: bakeryId,
            designationId: workerId,
            employmentType: 'Full Time',
            employmentStatus: 'Active',
            basicSalary: '12000',
            salaryType: 'Monthly',
            monthlyBonus: '500',
            currentAddress: 'আগ্রাবাদ, চট্টগ্রাম',
            permanentAddress: 'পটিয়া, চট্টগ্রাম',
          },
          {
            employeeCode: 'HRF-1003',
            fullName: 'জাহিদুল ইসলাম',
            mobile: '01711-223003',
            email: 'zahid@homerecipefoods.com',
            nid: '1994159456003',
            dateOfBirth: '1994-11-10',
            joiningDate: '2023-06-01',
            departmentId: salesId,
            designationId: salesmanId,
            employmentType: 'Full Time',
            employmentStatus: 'Active',
            basicSalary: '13500',
            salaryType: 'Monthly',
            monthlyBonus: '800',
            currentAddress: 'বহদ্দারহাট, চট্টগ্রাম',
            permanentAddress: 'হাটহাজারী, চট্টগ্রাম',
          },
          {
            employeeCode: 'HRF-1004',
            fullName: 'নুসরাত জাহান',
            mobile: '01914-556004',
            email: 'nusrat@homerecipefoods.com',
            nid: '1996159456004',
            dateOfBirth: '1996-02-18',
            joiningDate: '2024-01-10',
            departmentId: accId,
            designationId: accDesigId,
            employmentType: 'Full Time',
            employmentStatus: 'Active',
            basicSalary: '18000',
            salaryType: 'Monthly',
            monthlyBonus: '1200',
            currentAddress: 'জিইসি মোড়, চট্টগ্রাম',
            permanentAddress: 'আনোয়ারা, চট্টগ্রাম',
          },
          {
            employeeCode: 'HRF-1005',
            fullName: 'মোঃ সাইফুল আলম',
            mobile: '01618-990005',
            email: 'saiful@homerecipefoods.com',
            nid: '1997159456005',
            dateOfBirth: '1997-07-25',
            joiningDate: '2024-02-01',
            departmentId: godownId,
            designationId: workerId,
            employmentType: 'Full Time',
            employmentStatus: 'Active',
            basicSalary: '10500',
            salaryType: 'Monthly',
            monthlyBonus: '500',
            currentAddress: 'চাকতাই, চট্টগ্রাম',
            permanentAddress: 'বোয়ালখালী, চট্টগ্রাম',
          },
        ])
        .returning();

      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const todayStr = `${ym}-${String(now.getDate()).padStart(2, '0')}`;

      if (insertedEmps.length >= 3) {
        const rahim = insertedEmps[0];
        const karim = insertedEmps[1];
        const zahid = insertedEmps[2];

        // Add sample advance & snacks for Rahim matching Rule 21 example (Advance 2,000 Tk, Snack 500 Tk)
        await db.insert(advances).values([
          {
            employeeId: rahim.id,
            departmentId: rahim.departmentId,
            date: `${ym}-05`,
            amount: '2000',
            reason: 'পারিবারিক জরুরি প্রয়োজন',
            remarks: 'মাসিক বেতন থেকে কর্তনযোগ্য',
            addedByUserId: adminUser?.id || null,
            addedByName: adminUser?.name || 'Admin',
          },
          {
            employeeId: zahid.id,
            departmentId: zahid.departmentId,
            date: `${ym}-08`,
            amount: '1500',
            reason: 'চিকিৎসা খরচ',
            remarks: 'বেতন হতে সমন্বয়',
            addedByUserId: adminUser?.id || null,
            addedByName: adminUser?.name || 'Admin',
          },
        ]);

        await db.insert(snackPurchases).values([
          {
            employeeId: rahim.id,
            departmentId: rahim.departmentId,
            date: `${ym}-05`,
            itemDescription: 'বিকালের নাস্তা ও চা',
            quantity: 5,
            amount: '250',
            remarks: 'ফ্যাক্টরি ক্যান্টিন',
            addedByUserId: adminUser?.id || null,
            addedByName: adminUser?.name || 'Admin',
          },
          {
            employeeId: rahim.id,
            departmentId: rahim.departmentId,
            date: `${ym}-12`,
            itemDescription: 'বেকারি স্ন্যাকস',
            quantity: 5,
            amount: '250',
            remarks: 'ফ্যাক্টরি ক্যান্টিন',
            addedByUserId: adminUser?.id || null,
            addedByName: adminUser?.name || 'Admin',
          },
          {
            employeeId: karim.id,
            departmentId: karim.departmentId,
            date: `${ym}-06`,
            itemDescription: 'নাস্তা ক্রয়',
            quantity: 3,
            amount: '180',
            remarks: 'ক্যান্টিন বিল',
            addedByUserId: adminUser?.id || null,
            addedByName: adminUser?.name || 'Admin',
          },
        ]);

        // Add 1 absence record for Karim today
        await db
          .insert(absences)
          .values({
            employeeId: karim.id,
            departmentId: karim.departmentId,
            date: todayStr,
            reason: 'ব্যক্তিগত কারণে অনুপস্থিত',
            addedByUserId: adminUser?.id || null,
            addedByName: adminUser?.name || 'Admin',
          })
          .onConflictDoNothing();

        // Add 1 approved leave record for Zahid
        await db.insert(leaves).values({
          employeeId: zahid.id,
          departmentId: zahid.departmentId,
          leaveType: 'Casual',
          isPaid: true,
          startDate: todayStr,
          endDate: todayStr,
          totalDays: 1,
          reason: 'পারিবারিক অনুষ্ঠান',
          status: 'Approved',
          addedByUserId: adminUser?.id || null,
          addedByName: adminUser?.name || 'Admin',
        });

        await logActivity({
          action: 'প্রাথমিক ডাটাবেস সেটআপ সম্পন্ন',
          module: 'সিস্টেম',
          recordInfo: 'হোম রেসিপি ফুডস্ - চট্টগ্রাম',
          newValue: '৫ জন কর্মচারী ও ৭টি বিভাগ যুক্ত করা হয়েছে',
        });
      }
    }

    isInitialized = true;
  } catch (error) {
    console.error('Error initializing seed data:', error);
  }
}
