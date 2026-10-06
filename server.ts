import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/db/index.ts';
import {
  users,
  departments,
  designations,
  employees,
  leaves,
  absences,
  snackPurchases,
  advances,
  salaryRecords,
  activityLogs,
  settings,
} from './src/db/schema.ts';
import { eq, desc, and, inArray } from 'drizzle-orm';
import {
  requireAuth,
  requireRoles,
  AuthRequest,
  canAccessDepartment,
  parseDepartmentIds,
} from './src/middleware/auth.ts';
import { hashPassword, verifyPassword, createSessionToken } from './src/lib/crypto.ts';
import { ensureInitialData, logActivity } from './src/services/auditAndSeed.ts';
import { syncDocToFirestore, deleteDocFromFirestore } from './src/lib/firebase-admin.ts';
import {
  calculateEmployeeMonthlySalary,
  calculateLeaveDaysCount,
  getDailyAttendanceStatus,
} from './src/shared/salaryEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // Trigger initial seed on first request
  app.use('/api', async (_req, _res, next) => {
    await ensureInitialData();
    next();
  });

  // ============================================================================
  // 1. AUTHENTICATION ROUTES
  // ============================================================================
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'ইমেইল এবং পাসওয়ার্ড প্রদান করা আবশ্যক।' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const found = await db.select().from(users).where(eq(users.email, cleanEmail));
      const user = found[0];

      if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: 'ভুল ইমেইল অথবা পাসওয়ার্ড প্রদান করা হয়েছে।' });
      }

      if (user.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'আপনার অ্যাকাউন্টটি নিষ্ক্রিয় রয়েছে। কর্তৃপক্ষের সাথে যোগাযোগ করুন।' });
      }

      const token = createSessionToken({
        id: user.id,
        uid: user.uid,
        email: user.email,
      });

      const authUser = {
        id: user.id,
        uid: user.uid,
        name: user.name,
        email: user.email,
        role: user.role as 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER',
        assignedDepartmentIds: parseDepartmentIds(user.assignedDepartmentIds),
        status: user.status,
      };

      await logActivity({
        user: authUser,
        action: 'সিস্টেমে লগইন করেছেন',
        module: 'অথেনটিকেশন',
        recordInfo: `${user.name} (${user.email})`,
      });

      return res.json({ token, user: authUser });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'লগইন সম্পন্ন করতে সমস্যা হয়েছে।' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const allDepts = await db.select().from(departments);
      return res.json({
        user: req.authUser,
        departments: allDepts,
      });
    } catch (error) {
      console.error('Auth me error:', error);
      return res.status(500).json({ error: 'ব্যবহারকারীর তথ্য লোড করতে সমস্যা হয়েছে।' });
    }
  });

  app.post('/api/auth/change-password', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!newPassword || String(newPassword).length < 6) {
        return res.status(400).json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
      }

      const found = await db.select().from(users).where(eq(users.id, req.authUser!.id));
      const user = found[0];
      if (!user) {
        return res.status(404).json({ error: 'ব্যবহারকারী পাওয়া যায়নি।' });
      }

      if (currentPassword && !verifyPassword(currentPassword, user.passwordHash)) {
        return res.status(400).json({ error: 'বর্তমান পাসওয়ার্ডটি সঠিক নয়।' });
      }

      await db
        .update(users)
        .set({ passwordHash: hashPassword(newPassword) })
        .where(eq(users.id, user.id));

      await logActivity({
        user: req.authUser,
        action: 'নিজের পাসওয়ার্ড পরিবর্তন করেছেন',
        module: 'সেটিংস',
        recordInfo: user.email,
      });

      return res.json({ message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।' });
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({ error: 'পাসওয়ার্ড পরিবর্তন করতে সমস্যা হয়েছে।' });
    }
  });

  // ============================================================================
  // 2. DASHBOARD SUMMARY ROUTE
  // ============================================================================
  app.get('/api/dashboard', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      const isManager = authUser.role === 'MANAGER';

      const allDepts = await db.select().from(departments);
      const allDesigs = await db.select().from(designations);
      let allEmps = await db.select().from(employees);
      let allLeaves = await db.select().from(leaves).orderBy(desc(leaves.createdAt));
      let allAbsences = await db.select().from(absences).orderBy(desc(absences.createdAt));

      if (isManager) {
        const allowed = authUser.assignedDepartmentIds;
        allEmps = allEmps.filter((e) => allowed.includes(e.departmentId));
        allLeaves = allLeaves.filter((l) => allowed.includes(l.departmentId));
        allAbsences = allAbsences.filter((a) => allowed.includes(a.departmentId));
      }

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const activeEmployees = allEmps.filter((e) => e.employmentStatus === 'Active');
      const inactiveEmployees = allEmps.filter((e) => e.employmentStatus !== 'Active');

      let presentToday = 0;
      let absentToday = 0;
      let onLeaveToday = 0;

      for (const emp of activeEmployees) {
        const empLeaves = allLeaves.filter((l) => l.employeeId === emp.id);
        const empAbsences = allAbsences.filter((a) => a.employeeId === emp.id);
        const status = getDailyAttendanceStatus(
          todayStr,
          emp.employmentStatus,
          empLeaves,
          empAbsences
        );
        if (status === 'PRESENT') presentToday++;
        else if (status === 'ABSENT') absentToday++;
        else if (status === 'LEAVE') onLeaveToday++;
      }

      const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d.name]));
      const desigMap = Object.fromEntries(allDesigs.map((d) => [d.id, d.name]));
      const empMap = Object.fromEntries(allEmps.map((e) => [e.id, e]));

      const visibleDepts = isManager
        ? allDepts.filter((d) => authUser.assignedDepartmentIds.includes(d.id))
        : allDepts;

      const departmentSummary = visibleDepts.map((dept) => {
        const deptEmps = allEmps.filter((e) => e.departmentId === dept.id);
        const deptActive = deptEmps.filter((e) => e.employmentStatus === 'Active');
        let deptPresent = 0;
        let deptAbsent = 0;
        let deptLeave = 0;
        for (const emp of deptActive) {
          const st = getDailyAttendanceStatus(
            todayStr,
            emp.employmentStatus,
            allLeaves.filter((l) => l.employeeId === emp.id),
            allAbsences.filter((a) => a.employeeId === emp.id)
          );
          if (st === 'PRESENT') deptPresent++;
          else if (st === 'ABSENT') deptAbsent++;
          else if (st === 'LEAVE') deptLeave++;
        }
        return {
          departmentId: dept.id,
          departmentName: dept.name,
          status: dept.status,
          totalEmployees: deptEmps.length,
          activeEmployees: deptActive.length,
          presentToday: deptPresent,
          absentToday: deptAbsent,
          onLeaveToday: deptLeave,
        };
      });

      const recentLeaves = allLeaves.slice(0, 6).map((l) => ({
        ...l,
        employeeName: empMap[l.employeeId]?.fullName || 'অজানা',
        employeeCode: empMap[l.employeeId]?.employeeCode || '',
        departmentName: deptMap[l.departmentId] || '',
        designationName: desigMap[empMap[l.employeeId]?.designationId || 0] || '',
      }));

      const recentAbsences = allAbsences.slice(0, 6).map((a) => ({
        ...a,
        employeeName: empMap[a.employeeId]?.fullName || 'অজানা',
        employeeCode: empMap[a.employeeId]?.employeeCode || '',
        departmentName: deptMap[a.departmentId] || '',
        designationName: desigMap[empMap[a.employeeId]?.designationId || 0] || '',
      }));

      let recentLogs: (typeof activityLogs.$inferSelect)[] = [];
      if (!isManager) {
        recentLogs = await db
          .select()
          .from(activityLogs)
          .orderBy(desc(activityLogs.createdAt))
          .limit(8);
      } else {
        const allLogs = await db
          .select()
          .from(activityLogs)
          .orderBy(desc(activityLogs.createdAt))
          .limit(40);
        recentLogs = allLogs
          .filter(
            (lg) =>
              lg.departmentId !== null &&
              authUser.assignedDepartmentIds.includes(lg.departmentId) &&
              !['বেতন', 'অগ্রিম টাকা', 'নাস্তা ক্রয়', 'ইউজার পারমিশন'].includes(lg.module)
          )
          .slice(0, 6);
      }

      return res.json({
        todayDate: todayStr,
        totalEmployees: allEmps.length,
        activeEmployees: activeEmployees.length,
        inactiveEmployees: inactiveEmployees.length,
        presentToday,
        absentToday,
        onLeaveToday,
        departmentSummary,
        recentLeaves,
        recentAbsences,
        recentActivities: recentLogs,
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      return res.status(500).json({ error: 'ড্যাশবোর্ডের তথ্য লোড করতে সমস্যা হয়েছে।' });
    }
  });

  // ============================================================================
  // 3. DEPARTMENTS ROUTES
  // ============================================================================
  app.get('/api/departments', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      let allDepts = await db.select().from(departments).orderBy(departments.id);
      const allEmps = await db.select().from(employees);
      const allUsers = await db.select().from(users);

      if (authUser.role === 'MANAGER') {
        allDepts = allDepts.filter((d) => authUser.assignedDepartmentIds.includes(d.id));
      }

      const managers = allUsers.filter((u) => u.role === 'MANAGER');

      const enriched = allDepts.map((d) => {
        const empCount = allEmps.filter((e) => e.departmentId === d.id).length;
        const assignedManagers = managers
          .filter((m) => parseDepartmentIds(m.assignedDepartmentIds).includes(d.id))
          .map((m) => ({ id: m.id, name: m.name, email: m.email }));
        return {
          ...d,
          employeeCount: empCount,
          assignedManagers,
        };
      });

      return res.json(enriched);
    } catch (error) {
      console.error('Get departments error:', error);
      return res.status(500).json({ error: 'বিভাগের তালিকা লোড করতে সমস্যা হয়েছে।' });
    }
  });

  app.post(
    '/api/departments',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const { name, description, status, managerIds } = req.body;
        if (!name || !String(name).trim()) {
          return res.status(400).json({ error: 'বিভাগের নাম প্রদান করা আবশ্যক।' });
        }

        const [created] = await db
          .insert(departments)
          .values({
            name: String(name).trim(),
            description: description || '',
            status: status || 'ACTIVE',
          })
          .returning();

        if (Array.isArray(managerIds) && managerIds.length > 0) {
          const allManagers = await db.select().from(users).where(eq(users.role, 'MANAGER'));
          for (const mgr of allManagers) {
            const currentDepts = parseDepartmentIds(mgr.assignedDepartmentIds);
            if (managerIds.includes(mgr.id) && !currentDepts.includes(created.id)) {
              await db
                .update(users)
                .set({
                  assignedDepartmentIds: JSON.stringify([...currentDepts, created.id]),
                })
                .where(eq(users.id, mgr.id));
            }
          }
        }

        await logActivity({
          user: req.authUser,
          action: 'নতুন বিভাগ তৈরি করেছেন',
          module: 'বিভাগ',
          recordInfo: created.name,
          departmentId: created.id,
          newValue: JSON.stringify({ name: created.name, status: created.status }),
        });

        return res.status(201).json(created);
      } catch (error: any) {
        console.error('Create department error:', error);
        return res.status(400).json({ error: 'বিভাগ তৈরি করা যায়নি। একই নামের বিভাগ ইতিমধ্যে থাকতে পারে।' });
      }
    }
  );

  app.put(
    '/api/departments/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const deptId = Number(req.params.id);
        const { name, description, status, managerIds } = req.body;

        const existing = await db.select().from(departments).where(eq(departments.id, deptId));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'বিভাগ খুঁজে পাওয়া যায়নি।' });
        }

        const [updated] = await db
          .update(departments)
          .set({
            name: name ? String(name).trim() : existing[0].name,
            description: description !== undefined ? description : existing[0].description,
            status: status || existing[0].status,
          })
          .where(eq(departments.id, deptId))
          .returning();

        if (Array.isArray(managerIds)) {
          const allManagers = await db.select().from(users).where(eq(users.role, 'MANAGER'));
          for (const mgr of allManagers) {
            const currentDepts = parseDepartmentIds(mgr.assignedDepartmentIds);
            const shouldHave = managerIds.map(Number).includes(mgr.id);
            let nextDepts = currentDepts;
            if (shouldHave && !currentDepts.includes(deptId)) {
              nextDepts = [...currentDepts, deptId];
            } else if (!shouldHave && currentDepts.includes(deptId)) {
              nextDepts = currentDepts.filter((id) => id !== deptId);
            }
            if (JSON.stringify(nextDepts) !== JSON.stringify(currentDepts)) {
              await db
                .update(users)
                .set({ assignedDepartmentIds: JSON.stringify(nextDepts) })
                .where(eq(users.id, mgr.id));
            }
          }
        }

        await logActivity({
          user: req.authUser,
          action: 'বিভাগ আপডেট করেছেন',
          module: 'বিভাগ',
          recordInfo: updated.name,
          departmentId: updated.id,
          previousValue: JSON.stringify({ name: existing[0].name, status: existing[0].status }),
          newValue: JSON.stringify({ name: updated.name, status: updated.status }),
        });

        return res.json(updated);
      } catch (error) {
        console.error('Update department error:', error);
        return res.status(400).json({ error: 'বিভাগ আপডেট করতে সমস্যা হয়েছে।' });
      }
    }
  );

  app.delete(
    '/api/departments/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const deptId = Number(req.params.id);
        const empInDept = await db
          .select()
          .from(employees)
          .where(eq(employees.departmentId, deptId));
        if (empInDept.length > 0) {
          return res.status(400).json({
            error: 'এই বিভাগে কর্মচারী নিযুক্ত রয়েছেন। মুছে ফেলার আগে কর্মচারীদের অন্য বিভাগে স্থানান্তর করুন।',
          });
        }

        const existing = await db.select().from(departments).where(eq(departments.id, deptId));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'বিভাগ খুঁজে পাওয়া যায়নি।' });
        }

        await db.delete(departments).where(eq(departments.id, deptId));

        await logActivity({
          user: req.authUser,
          action: 'বিভাগ মুছে ফেলেছেন',
          module: 'বিভাগ',
          recordInfo: existing[0].name,
          previousValue: existing[0].name,
        });

        return res.json({ message: 'বিভাগ সফলভাবে মুছে ফেলা হয়েছে।' });
      } catch (error) {
        console.error('Delete department error:', error);
        return res.status(400).json({ error: 'বিভাগটি মুছে ফেলা সম্ভব হয়নি।' });
      }
    }
  );

  // ============================================================================
  // 4. DESIGNATIONS ROUTES
  // ============================================================================
  app.get('/api/designations', requireAuth, async (_req: AuthRequest, res: Response) => {
    try {
      const allDesigs = await db.select().from(designations).orderBy(designations.id);
      const allEmps = await db.select().from(employees);
      const enriched = allDesigs.map((ds) => ({
        ...ds,
        employeeCount: allEmps.filter((e) => e.designationId === ds.id).length,
      }));
      return res.json(enriched);
    } catch (error) {
      console.error('Get designations error:', error);
      return res.status(500).json({ error: 'পদবির তালিকা লোড করতে সমস্যা হয়েছে।' });
    }
  });

  app.post(
    '/api/designations',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const { name, description, status } = req.body;
        if (!name || !String(name).trim()) {
          return res.status(400).json({ error: 'পদবির নাম প্রদান করা আবশ্যক।' });
        }

        const [created] = await db
          .insert(designations)
          .values({
            name: String(name).trim(),
            description: description || '',
            status: status || 'ACTIVE',
          })
          .returning();

        await logActivity({
          user: req.authUser,
          action: 'নতুন পদবি যুক্ত করেছেন',
          module: 'পদবি',
          recordInfo: created.name,
          newValue: created.name,
        });

        return res.status(201).json(created);
      } catch (error) {
        console.error('Create designation error:', error);
        return res.status(400).json({ error: 'পদবি তৈরি করা যায়নি। এই নামটি ইতিমধ্যে ব্যবহৃত হতে পারে।' });
      }
    }
  );

  app.put(
    '/api/designations/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        const { name, description, status } = req.body;
        const existing = await db.select().from(designations).where(eq(designations.id, id));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'পদবি খুঁজে পাওয়া যায়নি।' });
        }

        const [updated] = await db
          .update(designations)
          .set({
            name: name ? String(name).trim() : existing[0].name,
            description: description !== undefined ? description : existing[0].description,
            status: status || existing[0].status,
          })
          .where(eq(designations.id, id))
          .returning();

        await logActivity({
          user: req.authUser,
          action: 'পদবি আপডেট করেছেন',
          module: 'পদবি',
          recordInfo: updated.name,
          previousValue: existing[0].name,
          newValue: updated.name,
        });

        return res.json(updated);
      } catch (error) {
        console.error('Update designation error:', error);
        return res.status(400).json({ error: 'পদবি আপডেট করতে সমস্যা হয়েছে।' });
      }
    }
  );

  app.delete(
    '/api/designations/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        const empWithDesig = await db
          .select()
          .from(employees)
          .where(eq(employees.designationId, id));
        if (empWithDesig.length > 0) {
          return res.status(400).json({
            error: 'এই পদবিতে কর্মচারী নিযুক্ত রয়েছেন। মুছে ফেলার আগে কর্মচারীদের পদবি পরিবর্তন করুন।',
          });
        }

        const existing = await db.select().from(designations).where(eq(designations.id, id));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'পদবি খুঁজে পাওয়া যায়নি।' });
        }

        await db.delete(designations).where(eq(designations.id, id));

        await logActivity({
          user: req.authUser,
          action: 'পদবি মুছে ফেলেছেন',
          module: 'পদবি',
          recordInfo: existing[0].name,
          previousValue: existing[0].name,
        });

        return res.json({ message: 'পদবি সফলভাবে মুছে ফেলা হয়েছে।' });
      } catch (error) {
        console.error('Delete designation error:', error);
        return res.status(400).json({ error: 'পদবি মুছে ফেলা সম্ভব হয়নি।' });
      }
    }
  );

  // ============================================================================
  // 5. EMPLOYEES & DETAILED PROFILE ROUTES
  // ============================================================================
  app.get('/api/employees', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      const isManager = authUser.role === 'MANAGER';

      let allEmps = await db.select().from(employees).orderBy(employees.id);
      // Exclude soft-deleted employees unless explicitly requested
      allEmps = allEmps.filter((e) => e.employmentStatus !== 'Deleted');
      const allDepts = await db.select().from(departments);
      const allDesigs = await db.select().from(designations);

      if (isManager) {
        allEmps = allEmps.filter((e) =>
          authUser.assignedDepartmentIds.includes(e.departmentId)
        );
      }

      const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d.name]));
      const desigMap = Object.fromEntries(allDesigs.map((d) => [d.id, d.name]));

      const sanitized = allEmps.map((emp) => {
        const base = {
          id: emp.id,
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,
          photoUrl: emp.photoUrl,
          mobile: emp.mobile,
          email: emp.email,
          nid: emp.nid,
          dateOfBirth: emp.dateOfBirth,
          joiningDate: emp.joiningDate,
          departmentId: emp.departmentId,
          departmentName: deptMap[emp.departmentId] || '',
          designationId: emp.designationId,
          designationName: desigMap[emp.designationId] || '',
          employmentType: emp.employmentType,
          employmentStatus: emp.employmentStatus,
          currentAddress: emp.currentAddress,
          permanentAddress: emp.permanentAddress,
          createdAt: emp.createdAt,
        };

        // Security Rule 5 & 8: Managers MUST NOT see financial data
        if (isManager) {
          return base;
        }
        return {
          ...base,
          basicSalary: Number(emp.basicSalary),
          salaryType: emp.salaryType,
          monthlyBonus: Number(emp.monthlyBonus),
        };
      });

      return res.json(sanitized);
    } catch (error) {
      console.error('Get employees error:', error);
      return res.status(500).json({ error: 'কর্মচারীদের তালিকা লোড করতে সমস্যা হয়েছে।' });
    }
  });

  app.get('/api/employees/:id/profile', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const empId = Number(req.params.id);
      const authUser = req.authUser!;
      const isManager = authUser.role === 'MANAGER';

      const found = await db.select().from(employees).where(eq(employees.id, empId));
      const emp = found[0];
      if (!emp) {
        return res.status(404).json({ error: 'কর্মচারীর তথ্য খুঁজে পাওয়া যায়নি।' });
      }

      // Enforce Department Authorization for Managers
      if (!canAccessDepartment(authUser, emp.departmentId)) {
        return res.status(403).json({
          error: 'অন্য বিভাগের কর্মচারীর তথ্য দেখার অনুমতি আপনার নেই।',
        });
      }

      const allDepts = await db.select().from(departments);
      const allDesigs = await db.select().from(designations);
      const deptName = allDepts.find((d) => d.id === emp.departmentId)?.name || '';
      const desigName = allDesigs.find((d) => d.id === emp.designationId)?.name || '';

      const empLeaves = await db
        .select()
        .from(leaves)
        .where(eq(leaves.employeeId, emp.id))
        .orderBy(desc(leaves.startDate));

      const empAbsences = await db
        .select()
        .from(absences)
        .where(eq(absences.employeeId, emp.id))
        .orderBy(desc(absences.date));

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayStatus = getDailyAttendanceStatus(
        todayStr,
        emp.employmentStatus,
        empLeaves,
        empAbsences
      );

      if (isManager) {
        return res.json({
          employee: {
            id: emp.id,
            employeeCode: emp.employeeCode,
            fullName: emp.fullName,
            photoUrl: emp.photoUrl,
            mobile: emp.mobile,
            email: emp.email,
            nid: emp.nid,
            dateOfBirth: emp.dateOfBirth,
            joiningDate: emp.joiningDate,
            departmentId: emp.departmentId,
            departmentName: deptName,
            designationId: emp.designationId,
            designationName: desigName,
            employmentType: emp.employmentType,
            employmentStatus: emp.employmentStatus,
            currentAddress: emp.currentAddress,
            permanentAddress: emp.permanentAddress,
            todayStatus,
          },
          leaves: empLeaves,
          absences: empAbsences,
        });
      }

      // Admin / Super Admin receives full financial history + live calculation
      const empAdvances = await db
        .select()
        .from(advances)
        .where(eq(advances.employeeId, emp.id))
        .orderBy(desc(advances.date));

      const empSnacks = await db
        .select()
        .from(snackPurchases)
        .where(eq(snackPurchases.employeeId, emp.id))
        .orderBy(desc(snackPurchases.date));

      const empSalaryHistory = await db
        .select()
        .from(salaryRecords)
        .where(eq(salaryRecords.employeeId, emp.id))
        .orderBy(desc(salaryRecords.year), desc(salaryRecords.month));

      const currentMonthSalary = calculateEmployeeMonthlySalary(
        {
          ...emp,
          departmentName: deptName,
          designationName: desigName,
        },
        now.getFullYear(),
        now.getMonth() + 1,
        empLeaves,
        empAbsences,
        empAdvances,
        empSnacks
      );

      return res.json({
        employee: {
          ...emp,
          basicSalary: Number(emp.basicSalary),
          monthlyBonus: Number(emp.monthlyBonus),
          departmentName: deptName,
          designationName: desigName,
          todayStatus,
        },
        leaves: empLeaves,
        absences: empAbsences,
        advances: empAdvances.map((a) => ({ ...a, amount: Number(a.amount) })),
        snacks: empSnacks.map((s) => ({ ...s, amount: Number(s.amount) })),
        salaryHistory: empSalaryHistory.map((sr) => ({
          ...sr,
          basicSalary: Number(sr.basicSalary),
          dailySalary: Number(sr.dailySalary),
          overtimePay: Number(sr.overtimePay),
          monthlyBonus: Number(sr.monthlyBonus),
          grossSalary: Number(sr.grossSalary),
          totalAdvance: Number(sr.totalAdvance),
          totalSnack: Number(sr.totalSnack),
          payableSalary: Number(sr.payableSalary),
        })),
        currentMonthCalculation: currentMonthSalary,
      });
    } catch (error) {
      console.error('Get employee profile error:', error);
      return res.status(500).json({ error: 'কর্মচারীর প্রোফাইল লোড করতে সমস্যা হয়েছে।' });
    }
  });

  app.post(
    '/api/employees',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const {
          employeeCode,
          fullName,
          photoUrl,
          mobile,
          email,
          nid,
          dateOfBirth,
          joiningDate,
          departmentId,
          designationId,
          employmentType,
          employmentStatus,
          basicSalary,
          salaryType,
          monthlyBonus,
          currentAddress,
          permanentAddress,
        } = req.body;

        if (!employeeCode || !fullName || !mobile || !joiningDate || !departmentId || !designationId) {
          return res.status(400).json({
            error: 'কর্মচারী আইডি, পূর্ণ নাম, মোবাইল নম্বর, যোগদানের তারিখ, বিভাগ এবং পদবি প্রদান করা আবশ্যক।',
          });
        }

        if (Number(basicSalary) < 0 || Number(monthlyBonus) < 0) {
          return res.status(400).json({ error: 'বেতন বা বোনাস ঋণাত্মক হতে পারবে না।' });
        }

        const [created] = await db
          .insert(employees)
          .values({
            employeeCode: String(employeeCode).trim(),
            fullName: String(fullName).trim(),
            photoUrl: photoUrl || '',
            mobile: String(mobile).trim(),
            email: email ? String(email).trim() : '',
            nid: nid ? String(nid).trim() : '',
            dateOfBirth: dateOfBirth || '',
            joiningDate: String(joiningDate).trim(),
            departmentId: Number(departmentId),
            designationId: Number(designationId),
            employmentType: employmentType || 'Full Time',
            employmentStatus: employmentStatus || 'Active',
            basicSalary: String(Number(basicSalary) || 0),
            salaryType: salaryType || 'Monthly',
            monthlyBonus: String(Number(monthlyBonus) || 0),
            currentAddress: currentAddress || '',
            permanentAddress: permanentAddress || '',
          })
          .returning();

        await syncDocToFirestore(
          'employees',
          created.employeeCode,
          {
            employeeId: created.employeeCode,
            name: created.fullName,
            profilePhotoUrl: created.photoUrl || '',
            mobile: created.mobile,
            email: created.email || '',
            nid: created.nid || '',
            dateOfBirth: created.dateOfBirth || '',
            joiningDate: created.joiningDate,
            departmentId: Number(created.departmentId),
            designationId: Number(created.designationId),
            employmentType: created.employmentType,
            employmentStatus: created.employmentStatus,
            basicSalary: Number(created.basicSalary),
            salaryType: created.salaryType,
            monthlyBonus: Number(created.monthlyBonus),
            currentAddress: created.currentAddress || '',
            permanentAddress: created.permanentAddress || '',
            createdBy: String(req.authUser!.uid || req.authUser!.id),
            updatedBy: String(req.authUser!.uid || req.authUser!.id),
          },
          true
        );

        await logActivity({
          user: req.authUser,
          action: 'নতুন কর্মচারী যুক্ত করেছেন',
          module: 'কর্মচারীগণ',
          recordInfo: `${created.fullName} (${created.employeeCode})`,
          departmentId: created.departmentId,
          newValue: JSON.stringify({
            employeeCode: created.employeeCode,
            fullName: created.fullName,
            basicSalary: created.basicSalary,
          }),
        });

        return res.status(201).json(created);
      } catch (error) {
        console.error('Create employee error:', error);
        return res.status(400).json({
          error: 'কর্মচারী যুক্ত করা যায়নি। এই Employee ID ইতিমধ্যে ব্যবহৃত হতে পারে।',
        });
      }
    }
  );

  app.put(
    '/api/employees/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const empId = Number(req.params.id);
        const existing = await db.select().from(employees).where(eq(employees.id, empId));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'কর্মচারী খুঁজে পাওয়া যায়নি।' });
        }

        const prev = existing[0];
        const {
          employeeCode,
          fullName,
          photoUrl,
          mobile,
          email,
          nid,
          dateOfBirth,
          joiningDate,
          departmentId,
          designationId,
          employmentType,
          employmentStatus,
          basicSalary,
          salaryType,
          monthlyBonus,
          currentAddress,
          permanentAddress,
        } = req.body;

        if (basicSalary !== undefined && Number(basicSalary) < 0) {
          return res.status(400).json({ error: 'বেতন ঋণাত্মক হতে পারবে না।' });
        }

        const [updated] = await db
          .update(employees)
          .set({
            employeeCode: employeeCode ? String(employeeCode).trim() : prev.employeeCode,
            fullName: fullName ? String(fullName).trim() : prev.fullName,
            photoUrl: photoUrl !== undefined ? photoUrl : prev.photoUrl,
            mobile: mobile ? String(mobile).trim() : prev.mobile,
            email: email !== undefined ? email : prev.email,
            nid: nid !== undefined ? nid : prev.nid,
            dateOfBirth: dateOfBirth !== undefined ? dateOfBirth : prev.dateOfBirth,
            joiningDate: joiningDate || prev.joiningDate,
            departmentId: departmentId ? Number(departmentId) : prev.departmentId,
            designationId: designationId ? Number(designationId) : prev.designationId,
            employmentType: employmentType || prev.employmentType,
            employmentStatus: employmentStatus || prev.employmentStatus,
            basicSalary:
              basicSalary !== undefined ? String(Number(basicSalary)) : prev.basicSalary,
            salaryType: salaryType || prev.salaryType,
            monthlyBonus:
              monthlyBonus !== undefined ? String(Number(monthlyBonus)) : prev.monthlyBonus,
            currentAddress:
              currentAddress !== undefined ? currentAddress : prev.currentAddress,
            permanentAddress:
              permanentAddress !== undefined ? permanentAddress : prev.permanentAddress,
          })
          .where(eq(employees.id, empId))
          .returning();

        await syncDocToFirestore(
          'employees',
          updated.employeeCode,
          {
            employeeId: updated.employeeCode,
            name: updated.fullName,
            profilePhotoUrl: updated.photoUrl || '',
            mobile: updated.mobile,
            email: updated.email || '',
            nid: updated.nid || '',
            dateOfBirth: updated.dateOfBirth || '',
            joiningDate: updated.joiningDate,
            departmentId: Number(updated.departmentId),
            designationId: Number(updated.designationId),
            employmentType: updated.employmentType,
            employmentStatus: updated.employmentStatus,
            basicSalary: Number(updated.basicSalary),
            salaryType: updated.salaryType,
            monthlyBonus: Number(updated.monthlyBonus),
            currentAddress: updated.currentAddress || '',
            permanentAddress: updated.permanentAddress || '',
            updatedBy: String(req.authUser!.uid || req.authUser!.id),
          },
          false
        );

        await logActivity({
          user: req.authUser,
          action: 'কর্মচারীর তথ্য আপডেট করেছেন',
          module: 'কর্মচারীগণ',
          recordInfo: `${updated.fullName} (${updated.employeeCode})`,
          departmentId: updated.departmentId,
          previousValue: JSON.stringify({
            fullName: prev.fullName,
            departmentId: prev.departmentId,
            basicSalary: prev.basicSalary,
            status: prev.employmentStatus,
          }),
          newValue: JSON.stringify({
            fullName: updated.fullName,
            departmentId: updated.departmentId,
            basicSalary: updated.basicSalary,
            status: updated.employmentStatus,
          }),
        });

        return res.json(updated);
      } catch (error) {
        console.error('Update employee error:', error);
        return res.status(400).json({ error: 'কর্মচারীর তথ্য আপডেট করতে সমস্যা হয়েছে।' });
      }
    }
  );

  app.delete(
    '/api/employees/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const empId = Number(req.params.id);
        const existing = await db.select().from(employees).where(eq(employees.id, empId));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'কর্মচারী খুঁজে পাওয়া যায়নি।' });
        }

        // Requirement 16: Safe Soft Deletion (employmentStatus = 'Deleted') so historical salary & financial records are preserved
        const [archived] = await db
          .update(employees)
          .set({ employmentStatus: 'Deleted' })
          .where(eq(employees.id, empId))
          .returning();

        await syncDocToFirestore(
          'employees',
          archived.employeeCode,
          {
            employmentStatus: 'Deleted',
            updatedBy: String(req.authUser!.uid || req.authUser!.id),
          },
          false
        );

        await logActivity({
          user: req.authUser,
          action: 'কর্মচারী আর্কাইভ/মুছে ফেলেছেন (Soft Deleted)',
          module: 'কর্মচারীগণ',
          recordInfo: `${existing[0].fullName} (${existing[0].employeeCode})`,
          departmentId: existing[0].departmentId,
          previousValue: JSON.stringify({
            employeeCode: existing[0].employeeCode,
            fullName: existing[0].fullName,
            employmentStatus: existing[0].employmentStatus,
          }),
          newValue: JSON.stringify({
            employeeCode: archived.employeeCode,
            employmentStatus: 'Deleted',
          }),
        });

        return res.json({
          message: 'কর্মচারীকে নিরাপদে আর্কাইভ (Soft Delete) করা হয়েছে; পূর্ববর্তী বেতন ও আর্থিক রেকর্ড সংরক্ষিত থাকবে।',
        });
      } catch (error) {
        console.error('Delete employee error:', error);
        return res.status(400).json({ error: 'কর্মচারী মুছে ফেলা সম্ভব হয়নি।' });
      }
    }
  );

  // ============================================================================
  // 6. LEAVE MANAGEMENT ROUTES
  // ============================================================================
  app.get('/api/leaves', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      let allLeaves = await db.select().from(leaves).orderBy(desc(leaves.startDate));
      const allEmps = await db.select().from(employees);
      const allDepts = await db.select().from(departments);

      if (authUser.role === 'MANAGER') {
        allLeaves = allLeaves.filter((l) =>
          authUser.assignedDepartmentIds.includes(l.departmentId)
        );
      }

      const empMap = Object.fromEntries(allEmps.map((e) => [e.id, e]));
      const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d.name]));

      const enriched = allLeaves.map((l) => ({
        ...l,
        employeeName: empMap[l.employeeId]?.fullName || 'অজানা',
        employeeCode: empMap[l.employeeId]?.employeeCode || '',
        departmentName: deptMap[l.departmentId] || '',
      }));

      return res.json(enriched);
    } catch (error) {
      console.error('Get leaves error:', error);
      return res.status(500).json({ error: 'ছুটির তালিকা লোড করতে সমস্যা হয়েছে।' });
    }
  });

  app.post(
    '/api/leaves',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const { employeeId, leaveType, isPaid, startDate, endDate, reason, status } = req.body;
        if (!employeeId || !startDate || !endDate || !reason) {
          return res.status(400).json({
            error: 'কর্মচারী, শুরুর তারিখ, শেষ তারিখ এবং ছুটির কারণ প্রদান করা আবশ্যক।',
          });
        }

        const totalDays = calculateLeaveDaysCount(startDate, endDate);
        if (totalDays <= 0) {
          return res.status(400).json({
            error: 'শেষ তারিখ অবশ্যই শুরুর তারিখের সমান বা পরের তারিখ হতে হবে।',
          });
        }

        const empFound = await db
          .select()
          .from(employees)
          .where(eq(employees.id, Number(employeeId)));
        if (empFound.length === 0) {
          return res.status(404).json({ error: 'কর্মচারী খুঁজে পাওয়া যায়নি।' });
        }

        const emp = empFound[0];

        const [created] = await db
          .insert(leaves)
          .values({
            employeeId: emp.id,
            departmentId: emp.departmentId,
            leaveType: leaveType || 'Casual',
            isPaid: isPaid !== false,
            startDate,
            endDate,
            totalDays,
            reason: String(reason).trim(),
            status: status || 'Approved',
            addedByUserId: req.authUser!.id,
            addedByName: req.authUser!.name,
          })
          .returning();

        await logActivity({
          user: req.authUser,
          action: 'ছুটির রেকর্ড যুক্ত করেছেন',
          module: 'ছুটি',
          recordInfo: `${emp.fullName} (${startDate} হতে ${endDate}, মোট ${totalDays} দিন)`,
          departmentId: emp.departmentId,
          newValue: JSON.stringify({
            leaveType: created.leaveType,
            totalDays: created.totalDays,
            status: created.status,
          }),
        });

        return res.status(201).json(created);
      } catch (error) {
        console.error('Create leave error:', error);
        return res.status(400).json({ error: 'ছুটির রেকর্ড যুক্ত করতে সমস্যা হয়েছে।' });
      }
    }
  );

  app.put(
    '/api/leaves/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const leaveId = Number(req.params.id);
        const existing = await db.select().from(leaves).where(eq(leaves.id, leaveId));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'ছুটির রেকর্ড খুঁজে পাওয়া যায়নি।' });
        }

        const prev = existing[0];
        const { leaveType, isPaid, startDate, endDate, reason, status } = req.body;
        const nextStart = startDate || prev.startDate;
        const nextEnd = endDate || prev.endDate;
        const totalDays = calculateLeaveDaysCount(nextStart, nextEnd);

        if (totalDays <= 0) {
          return res.status(400).json({ error: 'ছুটির তারিখ সঠিক নয়।' });
        }

        const [updated] = await db
          .update(leaves)
          .set({
            leaveType: leaveType || prev.leaveType,
            isPaid: isPaid !== undefined ? Boolean(isPaid) : prev.isPaid,
            startDate: nextStart,
            endDate: nextEnd,
            totalDays,
            reason: reason ? String(reason).trim() : prev.reason,
            status: status || prev.status,
          })
          .where(eq(leaves.id, leaveId))
          .returning();

        await logActivity({
          user: req.authUser,
          action: 'ছুটির রেকর্ড আপডেট করেছেন',
          module: 'ছুটি',
          recordInfo: `Leave ID #${leaveId}`,
          departmentId: updated.departmentId,
          previousValue: JSON.stringify({
            startDate: prev.startDate,
            endDate: prev.endDate,
            status: prev.status,
          }),
          newValue: JSON.stringify({
            startDate: updated.startDate,
            endDate: updated.endDate,
            status: updated.status,
          }),
        });

        return res.json(updated);
      } catch (error) {
        console.error('Update leave error:', error);
        return res.status(400).json({ error: 'ছুটির তথ্য আপডেট করতে সমস্যা হয়েছে।' });
      }
    }
  );

  app.delete(
    '/api/leaves/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const leaveId = Number(req.params.id);
        const existing = await db.select().from(leaves).where(eq(leaves.id, leaveId));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'ছুটির রেকর্ড খুঁজে পাওয়া যায়নি।' });
        }

        await db.delete(leaves).where(eq(leaves.id, leaveId));

        await logActivity({
          user: req.authUser,
          action: 'ছুটির রেকর্ড মুছে ফেলেছেন',
          module: 'ছুটি',
          recordInfo: `Leave ID #${leaveId} (${existing[0].startDate} - ${existing[0].endDate})`,
          departmentId: existing[0].departmentId,
          previousValue: JSON.stringify(existing[0]),
        });

        return res.json({ message: 'ছুটির রেকর্ড মুছে ফেলা হয়েছে।' });
      } catch (error) {
        console.error('Delete leave error:', error);
        return res.status(400).json({ error: 'ছুটির রেকর্ড মুছে ফেলা সম্ভব হয়নি।' });
      }
    }
  );

  // ============================================================================
  // 7. ABSENCE MANAGEMENT ROUTES (Managers can view & add for assigned depts)
  // ============================================================================
  app.get('/api/absences', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      let allAbsences = await db.select().from(absences).orderBy(desc(absences.date));
      const allEmps = await db.select().from(employees);
      const allDepts = await db.select().from(departments);

      if (authUser.role === 'MANAGER') {
        allAbsences = allAbsences.filter((a) =>
          authUser.assignedDepartmentIds.includes(a.departmentId)
        );
      }

      const empMap = Object.fromEntries(allEmps.map((e) => [e.id, e]));
      const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d.name]));

      const enriched = allAbsences.map((a) => ({
        ...a,
        employeeName: empMap[a.employeeId]?.fullName || 'অজানা',
        employeeCode: empMap[a.employeeId]?.employeeCode || '',
        departmentName: deptMap[a.departmentId] || '',
      }));

      return res.json(enriched);
    } catch (error) {
      console.error('Get absences error:', error);
      return res.status(500).json({ error: 'অনুপস্থিতির তালিকা লোড করতে সমস্যা হয়েছে।' });
    }
  });

  app.post('/api/absences', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      const { employeeId, date, reason } = req.body;

      if (!employeeId || !date) {
        return res.status(400).json({ error: 'কর্মচারী এবং তারিখ নির্বাচন করা আবশ্যক।' });
      }

      const empFound = await db
        .select()
        .from(employees)
        .where(eq(employees.id, Number(employeeId)));
      if (empFound.length === 0) {
        return res.status(404).json({ error: 'কর্মচারী খুঁজে পাওয়া যায়নি।' });
      }

      const emp = empFound[0];

      // Rule 14: Managers can only add absence records for employees in their assigned departments
      if (!canAccessDepartment(authUser, emp.departmentId)) {
        return res.status(403).json({
          error: 'আপনি শুধুমাত্র আপনার নির্ধারিত বিভাগের কর্মচারীদের অনুপস্থিতি যুক্ত করতে পারবেন।',
        });
      }

      // Check if employee is on Approved Leave on that date (Rule 12 & 13)
      const empLeaves = await db
        .select()
        .from(leaves)
        .where(and(eq(leaves.employeeId, emp.id), eq(leaves.status, 'Approved')));
      const onApprovedLeave = empLeaves.some(
        (l) => date >= l.startDate && date <= l.endDate
      );
      if (onApprovedLeave) {
        return res.status(400).json({
          error: 'এই তারিখে কর্মচারীর অনুমোদিত ছুটি রয়েছে। অনুমোদিত ছুটির দিনে অনুপস্থিতি যুক্ত করা যাবে না।',
        });
      }

      // Check duplicate absence (Rule 29)
      const duplicate = await db
        .select()
        .from(absences)
        .where(and(eq(absences.employeeId, emp.id), eq(absences.date, String(date))));
      if (duplicate.length > 0) {
        return res.status(400).json({
          error: 'এই তারিখে উক্ত কর্মচারীর অনুপস্থিতি ইতিমধ্যে লিপিবদ্ধ করা হয়েছে।',
        });
      }

      const [created] = await db
        .insert(absences)
        .values({
          employeeId: emp.id,
          departmentId: emp.departmentId,
          date: String(date),
          reason: reason ? String(reason).trim() : 'অনুপস্থিত',
          addedByUserId: authUser.id,
          addedByName: authUser.name,
        })
        .returning();

      await logActivity({
        user: authUser,
        action: 'কর্মচারী অনুপস্থিত মার্ক করেছেন',
        module: 'অনুপস্থিত',
        recordInfo: `${emp.fullName} (${emp.employeeCode}) - তারিখ: ${date}`,
        departmentId: emp.departmentId,
        newValue: JSON.stringify({ date, reason: created.reason }),
      });

      return res.status(201).json(created);
    } catch (error) {
      console.error('Create absence error:', error);
      return res.status(400).json({ error: 'অনুপস্থিতির রেকর্ড সংরক্ষণ করা যায়নি।' });
    }
  });

  app.put(
    '/api/absences/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        const { date, reason } = req.body;
        const existing = await db.select().from(absences).where(eq(absences.id, id));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'অনুপস্থিতির রেকর্ড পাওয়া যায়নি।' });
        }

        const [updated] = await db
          .update(absences)
          .set({
            date: date || existing[0].date,
            reason: reason !== undefined ? String(reason).trim() : existing[0].reason,
          })
          .where(eq(absences.id, id))
          .returning();

        await logActivity({
          user: req.authUser,
          action: 'অনুপস্থিতির তথ্য সংশোধন করেছেন',
          module: 'অনুপস্থিত',
          recordInfo: `Absence ID #${id}`,
          departmentId: updated.departmentId,
          previousValue: JSON.stringify({ date: existing[0].date, reason: existing[0].reason }),
          newValue: JSON.stringify({ date: updated.date, reason: updated.reason }),
        });

        return res.json(updated);
      } catch (error) {
        console.error('Update absence error:', error);
        return res.status(400).json({ error: 'অনুপস্থিতি আপডেট করা যায়নি।' });
      }
    }
  );

  app.delete(
    '/api/absences/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        const existing = await db.select().from(absences).where(eq(absences.id, id));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'অনুপস্থিতির রেকর্ড পাওয়া যায়নি।' });
        }

        await db.delete(absences).where(eq(absences.id, id));

        await logActivity({
          user: req.authUser,
          action: 'অনুপস্থিতির রেকর্ড মুছে ফেলেছেন',
          module: 'অনুপস্থিত',
          recordInfo: `Absence ID #${id} (Date: ${existing[0].date})`,
          departmentId: existing[0].departmentId,
          previousValue: JSON.stringify(existing[0]),
        });

        return res.json({ message: 'অনুপস্থিতির রেকর্ড মুছে ফেলা হয়েছে।' });
      } catch (error) {
        console.error('Delete absence error:', error);
        return res.status(400).json({ error: 'অনুপস্থিতির রেকর্ড মুছে ফেলা সম্ভব হয়নি।' });
      }
    }
  );

  // ============================================================================
  // 8. SNACK PURCHASE ROUTES (Strictly forbidden for Managers)
  // ============================================================================
  app.get(
    '/api/snacks',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (_req: AuthRequest, res: Response) => {
      try {
        const allSnacks = await db
          .select()
          .from(snackPurchases)
          .orderBy(desc(snackPurchases.date));
        const allEmps = await db.select().from(employees);
        const allDepts = await db.select().from(departments);

        const empMap = Object.fromEntries(allEmps.map((e) => [e.id, e]));
        const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d.name]));

        const enriched = allSnacks.map((s) => ({
          ...s,
          amount: Number(s.amount),
          employeeName: empMap[s.employeeId]?.fullName || 'অজানা',
          employeeCode: empMap[s.employeeId]?.employeeCode || '',
          departmentName: deptMap[s.departmentId] || '',
        }));

        return res.json(enriched);
      } catch (error) {
        console.error('Get snacks error:', error);
        return res.status(500).json({ error: 'নাস্তা ক্রয়ের তালিকা লোড করতে সমস্যা হয়েছে।' });
      }
    }
  );

  app.post(
    '/api/snacks',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const { employeeId, date, itemDescription, quantity, amount, remarks } = req.body;
        if (!employeeId || !date || !itemDescription || amount === undefined) {
          return res.status(400).json({
            error: 'কর্মচারী, তারিখ, বিবরণ এবং টাকার পরিমাণ প্রদান করা আবশ্যক।',
          });
        }
        if (Number(amount) <= 0) {
          return res.status(400).json({ error: 'টাকার পরিমাণ ০ এর বেশি হতে হবে।' });
        }

        const empFound = await db
          .select()
          .from(employees)
          .where(eq(employees.id, Number(employeeId)));
        if (empFound.length === 0) {
          return res.status(404).json({ error: 'কর্মচারী খুঁজে পাওয়া যায়নি।' });
        }
        const emp = empFound[0];

        const [created] = await db
          .insert(snackPurchases)
          .values({
            employeeId: emp.id,
            departmentId: emp.departmentId,
            date: String(date),
            itemDescription: String(itemDescription).trim(),
            quantity: Number(quantity) || 1,
            amount: String(Number(amount)),
            remarks: remarks || '',
            addedByUserId: req.authUser!.id,
            addedByName: req.authUser!.name,
          })
          .returning();

        await logActivity({
          user: req.authUser,
          action: 'নাস্তা ক্রয় রেকর্ড যুক্ত করেছেন',
          module: 'নাস্তা ক্রয়',
          recordInfo: `${emp.fullName} - ${itemDescription} (${amount} ৳)`,
          departmentId: emp.departmentId,
          newValue: JSON.stringify({ date, itemDescription, amount }),
        });

        return res.status(201).json({ ...created, amount: Number(created.amount) });
      } catch (error) {
        console.error('Create snack error:', error);
        return res.status(400).json({ error: 'নাস্তা ক্রয়ের তথ্য সংরক্ষণ করা যায়নি।' });
      }
    }
  );

  app.put(
    '/api/snacks/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        const { date, itemDescription, quantity, amount, remarks } = req.body;
        const existing = await db
          .select()
          .from(snackPurchases)
          .where(eq(snackPurchases.id, id));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'নাস্তা ক্রয়ের রেকর্ড পাওয়া যায়নি।' });
        }

        if (amount !== undefined && Number(amount) <= 0) {
          return res.status(400).json({ error: 'টাকার পরিমাণ বৈধ হতে হবে।' });
        }

        const [updated] = await db
          .update(snackPurchases)
          .set({
            date: date || existing[0].date,
            itemDescription: itemDescription
              ? String(itemDescription).trim()
              : existing[0].itemDescription,
            quantity: quantity ? Number(quantity) : existing[0].quantity,
            amount: amount !== undefined ? String(Number(amount)) : existing[0].amount,
            remarks: remarks !== undefined ? remarks : existing[0].remarks,
          })
          .where(eq(snackPurchases.id, id))
          .returning();

        await logActivity({
          user: req.authUser,
          action: 'নাস্তা ক্রয় রেকর্ড আপডেট করেছেন',
          module: 'নাস্তা ক্রয়',
          recordInfo: `Snack ID #${id}`,
          departmentId: updated.departmentId,
          previousValue: JSON.stringify({ amount: existing[0].amount }),
          newValue: JSON.stringify({ amount: updated.amount }),
        });

        return res.json({ ...updated, amount: Number(updated.amount) });
      } catch (error) {
        console.error('Update snack error:', error);
        return res.status(400).json({ error: 'নাস্তা ক্রয়ের তথ্য আপডেট করা যায়নি।' });
      }
    }
  );

  app.delete(
    '/api/snacks/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        const existing = await db
          .select()
          .from(snackPurchases)
          .where(eq(snackPurchases.id, id));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'নাস্তা ক্রয়ের রেকর্ড পাওয়া যায়নি।' });
        }

        await db.delete(snackPurchases).where(eq(snackPurchases.id, id));

        await logActivity({
          user: req.authUser,
          action: 'নাস্তা ক্রয় রেকর্ড মুছে ফেলেছেন',
          module: 'নাস্তা ক্রয়',
          recordInfo: `Snack ID #${id} (${existing[0].amount} ৳)`,
          departmentId: existing[0].departmentId,
          previousValue: JSON.stringify(existing[0]),
        });

        return res.json({ message: 'নাস্তা ক্রয়ের রেকর্ড মুছে ফেলা হয়েছে।' });
      } catch (error) {
        console.error('Delete snack error:', error);
        return res.status(400).json({ error: 'নাস্তা ক্রয়ের রেকর্ড মুছে ফেলা সম্ভব হয়নি।' });
      }
    }
  );

  // ============================================================================
  // 9. ADVANCE MONEY ROUTES (Strictly forbidden for Managers)
  // ============================================================================
  app.get(
    '/api/advances',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (_req: AuthRequest, res: Response) => {
      try {
        const allAdvances = await db.select().from(advances).orderBy(desc(advances.date));
        const allEmps = await db.select().from(employees);
        const allDepts = await db.select().from(departments);

        const empMap = Object.fromEntries(allEmps.map((e) => [e.id, e]));
        const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d.name]));

        const enriched = allAdvances.map((a) => ({
          ...a,
          amount: Number(a.amount),
          employeeName: empMap[a.employeeId]?.fullName || 'অজানা',
          employeeCode: empMap[a.employeeId]?.employeeCode || '',
          departmentName: deptMap[a.departmentId] || '',
        }));

        return res.json(enriched);
      } catch (error) {
        console.error('Get advances error:', error);
        return res.status(500).json({ error: 'অগ্রিম টাকার তালিকা লোড করতে সমস্যা হয়েছে।' });
      }
    }
  );

  app.post(
    '/api/advances',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const { employeeId, date, amount, reason, remarks } = req.body;
        if (!employeeId || !date || amount === undefined || !reason) {
          return res.status(400).json({
            error: 'কর্মচারী, তারিখ, অগ্রিম টাকার পরিমাণ এবং কারণ প্রদান করা আবশ্যক।',
          });
        }
        if (Number(amount) <= 0) {
          return res.status(400).json({ error: 'অগ্রিম টাকার পরিমাণ ০ এর বেশি হতে হবে।' });
        }

        const empFound = await db
          .select()
          .from(employees)
          .where(eq(employees.id, Number(employeeId)));
        if (empFound.length === 0) {
          return res.status(404).json({ error: 'কর্মচারী খুঁজে পাওয়া যায়নি।' });
        }
        const emp = empFound[0];

        const [created] = await db
          .insert(advances)
          .values({
            employeeId: emp.id,
            departmentId: emp.departmentId,
            date: String(date),
            amount: String(Number(amount)),
            reason: String(reason).trim(),
            remarks: remarks || '',
            addedByUserId: req.authUser!.id,
            addedByName: req.authUser!.name,
          })
          .returning();

        await logActivity({
          user: req.authUser,
          action: 'অগ্রিম টাকা প্রদান রেকর্ড করেছেন',
          module: 'অগ্রিম টাকা',
          recordInfo: `${emp.fullName} - ${amount} ৳ (${date})`,
          departmentId: emp.departmentId,
          newValue: JSON.stringify({ date, amount, reason }),
        });

        return res.status(201).json({ ...created, amount: Number(created.amount) });
      } catch (error) {
        console.error('Create advance error:', error);
        return res.status(400).json({ error: 'অগ্রিম টাকার তথ্য সংরক্ষণ করা যায়নি।' });
      }
    }
  );

  app.put(
    '/api/advances/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        const { date, amount, reason, remarks } = req.body;
        const existing = await db.select().from(advances).where(eq(advances.id, id));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'অগ্রিম টাকার রেকর্ড পাওয়া যায়নি।' });
        }

        if (amount !== undefined && Number(amount) <= 0) {
          return res.status(400).json({ error: 'অগ্রিম টাকার পরিমাণ বৈধ হতে হবে।' });
        }

        const [updated] = await db
          .update(advances)
          .set({
            date: date || existing[0].date,
            amount: amount !== undefined ? String(Number(amount)) : existing[0].amount,
            reason: reason ? String(reason).trim() : existing[0].reason,
            remarks: remarks !== undefined ? remarks : existing[0].remarks,
          })
          .where(eq(advances.id, id))
          .returning();

        await logActivity({
          user: req.authUser,
          action: 'অগ্রিম টাকার রেকর্ড আপডেট করেছেন',
          module: 'অগ্রিম টাকা',
          recordInfo: `Advance ID #${id}`,
          departmentId: updated.departmentId,
          previousValue: JSON.stringify({ amount: existing[0].amount }),
          newValue: JSON.stringify({ amount: updated.amount }),
        });

        return res.json({ ...updated, amount: Number(updated.amount) });
      } catch (error) {
        console.error('Update advance error:', error);
        return res.status(400).json({ error: 'অগ্রিম টাকার তথ্য আপডেট করা যায়নি।' });
      }
    }
  );

  app.delete(
    '/api/advances/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        const existing = await db.select().from(advances).where(eq(advances.id, id));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'অগ্রিম টাকার রেকর্ড পাওয়া যায়নি।' });
        }

        await db.delete(advances).where(eq(advances.id, id));

        await logActivity({
          user: req.authUser,
          action: 'অগ্রিম টাকার রেকর্ড মুছে ফেলেছেন',
          module: 'অগ্রিম টাকা',
          recordInfo: `Advance ID #${id} (${existing[0].amount} ৳)`,
          departmentId: existing[0].departmentId,
          previousValue: JSON.stringify(existing[0]),
        });

        return res.json({ message: 'অগ্রিম টাকার রেকর্ড মুছে ফেলা হয়েছে।' });
      } catch (error) {
        console.error('Delete advance error:', error);
        return res.status(400).json({ error: 'অগ্রিম টাকার রেকর্ড মুছে ফেলা সম্ভব হয়নি।' });
      }
    }
  );

  // ============================================================================
  // 10. CENTRALIZED SALARY SHEET & REPORTS ENGINE ROUTES (Admin / Super Admin Only)
  // ============================================================================
  app.get(
    '/api/salary-sheet',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const now = new Date();
        const year = Number(req.query.year) || now.getFullYear();
        const month = Number(req.query.month) || now.getMonth() + 1;
        const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;

        const allSettings = await db.select().from(settings);
        const sysSetting = allSettings[0] || {
          companyName: 'হোম রেসিপি ফুডস্',
          companyAddress: 'চট্টগ্রাম, বাংলাদেশ',
          standardMonthDays: 30,
          fridayOvertimeEnabled: true,
        };

        let allEmps = await db.select().from(employees).orderBy(employees.id);
        // Include Active employees (or employees active in that period)
        allEmps = allEmps.filter((e) => e.employmentStatus === 'Active');

        if (departmentId) {
          allEmps = allEmps.filter((e) => e.departmentId === departmentId);
        }

        const allDepts = await db.select().from(departments);
        const allDesigs = await db.select().from(designations);
        const allLeaves = await db.select().from(leaves);
        const allAbsences = await db.select().from(absences);
        const allAdvances = await db.select().from(advances);
        const allSnacks = await db.select().from(snackPurchases);

        const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d.name]));
        const desigMap = Object.fromEntries(allDesigs.map((d) => [d.id, d.name]));

        const rows = allEmps.map((emp) =>
          calculateEmployeeMonthlySalary(
            {
              ...emp,
              departmentName: deptMap[emp.departmentId] || '',
              designationName: desigMap[emp.designationId] || '',
            },
            year,
            month,
            allLeaves.filter((l) => l.employeeId === emp.id),
            allAbsences.filter((a) => a.employeeId === emp.id),
            allAdvances.filter((ad) => ad.employeeId === emp.id),
            allSnacks.filter((sn) => sn.employeeId === emp.id),
            sysSetting.standardMonthDays,
            sysSetting.fridayOvertimeEnabled
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

        return res.json({
          month,
          year,
          departmentId,
          departmentName: departmentId ? deptMap[departmentId] || 'সকল বিভাগ' : 'সকল বিভাগ',
          companyName: sysSetting.companyName,
          companyAddress: sysSetting.companyAddress,
          rows,
          totals,
        });
      } catch (error) {
        console.error('Get salary sheet error:', error);
        return res.status(500).json({ error: 'সেলারি শিট প্রস্তুত করতে সমস্যা হয়েছে।' });
      }
    }
  );

  // Save/Finalize monthly salary records into database
  app.post(
    '/api/salary-sheet/save',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const { year, month, departmentId } = req.body;
        if (!year || !month) {
          return res.status(400).json({ error: 'মাস এবং বছর নির্বাচন করা আবশ্যক।' });
        }

        const allSettings = await db.select().from(settings);
        const sysSetting = allSettings[0] || {
          standardMonthDays: 30,
          fridayOvertimeEnabled: true,
        };

        let allEmps = await db
          .select()
          .from(employees)
          .where(eq(employees.employmentStatus, 'Active'));
        if (departmentId) {
          allEmps = allEmps.filter((e) => e.departmentId === Number(departmentId));
        }

        const allLeaves = await db.select().from(leaves);
        const allAbsences = await db.select().from(absences);
        const allAdvances = await db.select().from(advances);
        const allSnacks = await db.select().from(snackPurchases);

        let savedCount = 0;
        for (const emp of allEmps) {
          const calc = calculateEmployeeMonthlySalary(
            emp,
            Number(year),
            Number(month),
            allLeaves.filter((l) => l.employeeId === emp.id),
            allAbsences.filter((a) => a.employeeId === emp.id),
            allAdvances.filter((ad) => ad.employeeId === emp.id),
            allSnacks.filter((sn) => sn.employeeId === emp.id),
            sysSetting.standardMonthDays,
            sysSetting.fridayOvertimeEnabled
          );

          await db
            .insert(salaryRecords)
            .values({
              month: Number(month),
              year: Number(year),
              employeeId: emp.id,
              departmentId: emp.departmentId,
              basicSalary: String(calc.basicSalary),
              dailySalary: String(calc.dailySalary),
              regularPaidDays: calc.regularPaidDays,
              fridayOvertimeDays: calc.fridayOvertimeDays,
              totalDays: calc.totalDays,
              overtimePay: String(calc.overtimePay),
              monthlyBonus: String(calc.monthlyBonus),
              grossSalary: String(calc.grossSalary),
              totalAdvance: String(calc.totalAdvance),
              totalSnack: String(calc.totalSnack),
              payableSalary: String(calc.payableSalary),
              generatedByUserId: req.authUser!.id,
              generatedByName: req.authUser!.name,
            })
            .onConflictDoUpdate({
              target: [salaryRecords.employeeId, salaryRecords.month, salaryRecords.year],
              set: {
                basicSalary: String(calc.basicSalary),
                dailySalary: String(calc.dailySalary),
                regularPaidDays: calc.regularPaidDays,
                fridayOvertimeDays: calc.fridayOvertimeDays,
                totalDays: calc.totalDays,
                overtimePay: String(calc.overtimePay),
                monthlyBonus: String(calc.monthlyBonus),
                grossSalary: String(calc.grossSalary),
                totalAdvance: String(calc.totalAdvance),
                totalSnack: String(calc.totalSnack),
                payableSalary: String(calc.payableSalary),
                generatedByUserId: req.authUser!.id,
                generatedByName: req.authUser!.name,
              },
            });
          savedCount++;
        }

        await logActivity({
          user: req.authUser,
          action: 'মাসিক সেলারি শিট ডাটাবেসে সংরক্ষণ করেছেন',
          module: 'সেলারি শিট',
          recordInfo: `মাস: ${month}/${year}, মোট কর্মচারী: ${savedCount} জন`,
          departmentId: departmentId ? Number(departmentId) : null,
        });

        return res.json({
          message: `${savedCount} জন কর্মচারীর বেতন রেকর্ড সফলভাবে সংরক্ষণ করা হয়েছে।`,
          savedCount,
        });
      } catch (error) {
        console.error('Save salary sheet error:', error);
        return res.status(500).json({ error: 'সেলারি শিট সংরক্ষণ করতে সমস্যা হয়েছে।' });
      }
    }
  );

  // Reports Endpoint (Department-wise, Monthly, Employee-wise)
  app.get(
    '/api/reports',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const now = new Date();
        const year = Number(req.query.year) || now.getFullYear();
        const month = Number(req.query.month) || now.getMonth() + 1;

        const allSettings = await db.select().from(settings);
        const sysSetting = allSettings[0] || {
          standardMonthDays: 30,
          fridayOvertimeEnabled: true,
        };

        const allDepts = await db.select().from(departments).orderBy(departments.id);
        const allDesigs = await db.select().from(designations);
        const allEmps = await db
          .select()
          .from(employees)
          .where(eq(employees.employmentStatus, 'Active'));
        const allLeaves = await db.select().from(leaves);
        const allAbsences = await db.select().from(absences);
        const allAdvances = await db.select().from(advances);
        const allSnacks = await db.select().from(snackPurchases);

        const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d.name]));
        const desigMap = Object.fromEntries(allDesigs.map((d) => [d.id, d.name]));

        const employeeCalculations = allEmps.map((emp) =>
          calculateEmployeeMonthlySalary(
            {
              ...emp,
              departmentName: deptMap[emp.departmentId] || '',
              designationName: desigMap[emp.designationId] || '',
            },
            year,
            month,
            allLeaves.filter((l) => l.employeeId === emp.id),
            allAbsences.filter((a) => a.employeeId === emp.id),
            allAdvances.filter((ad) => ad.employeeId === emp.id),
            allSnacks.filter((sn) => sn.employeeId === emp.id),
            sysSetting.standardMonthDays,
            sysSetting.fridayOvertimeEnabled
          )
        );

        const departmentReports = allDepts.map((dept) => {
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

        return res.json({
          month,
          year,
          overallSummary,
          departmentReports,
          employeeCalculations,
        });
      } catch (error) {
        console.error('Get reports error:', error);
        return res.status(500).json({ error: 'রিপোর্ট লোড করতে সমস্যা হয়েছে।' });
      }
    }
  );

  // ============================================================================
  // 11. USER PERMISSIONS ROUTES (Strictly Super Admin Only)
  // ============================================================================
  app.get(
    '/api/users',
    requireAuth,
    requireRoles(['SUPER_ADMIN', 'ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        // Note: Admin can view manager list for department assignment, but ONLY Super Admin can access full User Permission management
        const allUsers = await db.select().from(users).orderBy(users.id);
        const allDepts = await db.select().from(departments);
        const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d.name]));

        const sanitized = allUsers.map((u) => {
          const deptIds = parseDepartmentIds(u.assignedDepartmentIds);
          return {
            id: u.id,
            uid: u.uid,
            name: u.name,
            email: u.email,
            role: u.role,
            assignedDepartmentIds: deptIds,
            assignedDepartmentNames: deptIds.map((id) => deptMap[id]).filter(Boolean),
            status: u.status,
            createdAt: u.createdAt,
          };
        });

        return res.json(sanitized);
      } catch (error) {
        console.error('Get users error:', error);
        return res.status(500).json({ error: 'ব্যবহারকারীদের তালিকা লোড করতে সমস্যা হয়েছে।' });
      }
    }
  );

  app.post(
    '/api/users',
    requireAuth,
    requireRoles(['SUPER_ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const { name, email, password, role, assignedDepartmentIds, status } = req.body;
        if (!name || !email || !password || !role) {
          return res.status(400).json({
            error: 'নাম, ইমেইল, পাসওয়ার্ড এবং রোল প্রদান করা আবশ্যক।',
          });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const deptIds = Array.isArray(assignedDepartmentIds)
          ? assignedDepartmentIds.map(Number)
          : [];

        const [created] = await db
          .insert(users)
          .values({
            uid: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: String(name).trim(),
            email: cleanEmail,
            passwordHash: hashPassword(String(password)),
            role: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role) ? role : 'MANAGER',
            assignedDepartmentIds: JSON.stringify(deptIds),
            status: status || 'ACTIVE',
          })
          .returning();

        await logActivity({
          user: req.authUser,
          action: 'নতুন সিস্টেম ইউজার তৈরি করেছেন',
          module: 'ইউজার পারমিশন',
          recordInfo: `${created.name} (${created.email}) - Role: ${created.role}`,
          newValue: JSON.stringify({
            email: created.email,
            role: created.role,
            assignedDepartmentIds: deptIds,
          }),
        });

        return res.status(201).json({
          id: created.id,
          name: created.name,
          email: created.email,
          role: created.role,
          assignedDepartmentIds: deptIds,
          status: created.status,
        });
      } catch (error) {
        console.error('Create user error:', error);
        return res.status(400).json({
          error: 'ব্যবহারকারী তৈরি করা যায়নি। এই ইমেইল ইতিমধ্যে ব্যবহৃত হতে পারে।',
        });
      }
    }
  );

  app.put(
    '/api/users/:id',
    requireAuth,
    requireRoles(['SUPER_ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const targetId = Number(req.params.id);
        const { name, email, role, assignedDepartmentIds, status, newPassword } = req.body;

        const existing = await db.select().from(users).where(eq(users.id, targetId));
        if (existing.length === 0) {
          return res.status(404).json({ error: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি।' });
        }

        const prev = existing[0];
        const deptIds = Array.isArray(assignedDepartmentIds)
          ? assignedDepartmentIds.map(Number)
          : parseDepartmentIds(prev.assignedDepartmentIds);

        const updatePayload: Partial<typeof users.$inferInsert> = {
          name: name ? String(name).trim() : prev.name,
          email: email ? String(email).trim().toLowerCase() : prev.email,
          role: role || prev.role,
          assignedDepartmentIds: JSON.stringify(deptIds),
          status: status || prev.status,
        };

        if (newPassword && String(newPassword).trim().length >= 6) {
          updatePayload.passwordHash = hashPassword(String(newPassword).trim());
        }

        const [updated] = await db
          .update(users)
          .set(updatePayload)
          .where(eq(users.id, targetId))
          .returning();

        await logActivity({
          user: req.authUser,
          action: 'ইউজার পারমিশন/তথ্য আপডেট করেছেন',
          module: 'ইউজার পারমিশন',
          recordInfo: `${updated.name} (${updated.email})`,
          previousValue: JSON.stringify({
            role: prev.role,
            assignedDepartmentIds: parseDepartmentIds(prev.assignedDepartmentIds),
            status: prev.status,
          }),
          newValue: JSON.stringify({
            role: updated.role,
            assignedDepartmentIds: deptIds,
            status: updated.status,
          }),
        });

        return res.json({
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          assignedDepartmentIds: deptIds,
          status: updated.status,
        });
      } catch (error) {
        console.error('Update user error:', error);
        return res.status(400).json({ error: 'ব্যবহারকারীর তথ্য আপডেট করা যায়নি।' });
      }
    }
  );

  // ============================================================================
  // 12. ACTIVITY LOGS ROUTE (Strictly Super Admin Only)
  // ============================================================================
  app.get(
    '/api/activity-logs',
    requireAuth,
    requireRoles(['SUPER_ADMIN']),
    async (_req: AuthRequest, res: Response) => {
      try {
        const logs = await db
          .select()
          .from(activityLogs)
          .orderBy(desc(activityLogs.createdAt))
          .limit(300);
        const allDepts = await db.select().from(departments);
        const deptMap = Object.fromEntries(allDepts.map((d) => [d.id, d.name]));

        const enriched = logs.map((l) => ({
          ...l,
          departmentName: l.departmentId ? deptMap[l.departmentId] || '' : '',
        }));

        return res.json(enriched);
      } catch (error) {
        console.error('Get activity logs error:', error);
        return res.status(500).json({ error: 'অ্যাক্টিভিটি লগ লোড করতে সমস্যা হয়েছে।' });
      }
    }
  );

  // ============================================================================
  // 13. SETTINGS ROUTES
  // ============================================================================
  app.get('/api/settings', requireAuth, async (_req: AuthRequest, res: Response) => {
    try {
      const allSettings = await db.select().from(settings);
      return res.json(
        allSettings[0] || {
          companyName: 'হোম রেসিপি ফুডস্',
          companyAddress: 'চট্টগ্রাম, বাংলাদেশ',
          companyPhone: '+880 1819-345678',
          companyEmail: 'hr@homerecipefoods.com',
          standardMonthDays: 30,
          fridayOvertimeEnabled: true,
        }
      );
    } catch (error) {
      console.error('Get settings error:', error);
      return res.status(500).json({ error: 'সেটিংস লোড করতে সমস্যা হয়েছে।' });
    }
  });

  app.put(
    '/api/settings',
    requireAuth,
    requireRoles(['SUPER_ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const {
          companyName,
          companyAddress,
          companyPhone,
          companyEmail,
          standardMonthDays,
          fridayOvertimeEnabled,
        } = req.body;

        const existing = await db.select().from(settings);
        let updated;

        if (existing.length === 0) {
          const [ins] = await db
            .insert(settings)
            .values({
              companyName: companyName || 'হোম রেসিপি ফুডস্',
              companyAddress: companyAddress || 'চট্টগ্রাম, বাংলাদেশ',
              companyPhone: companyPhone || '',
              companyEmail: companyEmail || '',
              standardMonthDays: Number(standardMonthDays) || 30,
              fridayOvertimeEnabled: fridayOvertimeEnabled !== false,
            })
            .returning();
          updated = ins;
        } else {
          const [upd] = await db
            .update(settings)
            .set({
              companyName: companyName || existing[0].companyName,
              companyAddress: companyAddress || existing[0].companyAddress,
              companyPhone:
                companyPhone !== undefined ? companyPhone : existing[0].companyPhone,
              companyEmail:
                companyEmail !== undefined ? companyEmail : existing[0].companyEmail,
              standardMonthDays: Number(standardMonthDays) || existing[0].standardMonthDays,
              fridayOvertimeEnabled:
                fridayOvertimeEnabled !== undefined
                  ? Boolean(fridayOvertimeEnabled)
                  : existing[0].fridayOvertimeEnabled,
              updatedAt: new Date(),
            })
            .where(eq(settings.id, existing[0].id))
            .returning();
          updated = upd;
        }

        await logActivity({
          user: req.authUser,
          action: 'কোম্পানি ও সিস্টেম সেটিংস পরিবর্তন করেছেন',
          module: 'সেটিংস',
          recordInfo: updated.companyName,
          newValue: JSON.stringify(updated),
        });

        return res.json(updated);
      } catch (error) {
        console.error('Update settings error:', error);
        return res.status(400).json({ error: 'সেটিংস সংরক্ষণ করতে সমস্যা হয়েছে।' });
      }
    }
  );

  // Vite middleware for development / static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Home Recipe Foods HR System running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
