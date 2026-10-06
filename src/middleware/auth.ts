import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifySessionToken, hashPassword } from '../lib/crypto.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq, count } from 'drizzle-orm';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER';

export interface AuthenticatedUser {
  id: number;
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  assignedDepartmentIds: number[];
  status: string;
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

export function parseDepartmentIds(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number).filter((n) => !isNaN(n)) : [];
  } catch {
    return [];
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস: লগইন টোকেন পাওয়া যায়নি।' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    let dbUser: typeof users.$inferSelect | undefined;

    if (token.startsWith('hrf.')) {
      const payload = verifySessionToken(token);
      if (!payload) {
        return res.status(401).json({ error: 'সেশন মেয়াদোত্তীর্ণ হয়েছে। অনুগ্রহ করে পুনরায় লগইন করুন।' });
      }
      const found = await db.select().from(users).where(eq(users.id, payload.userId));
      dbUser = found[0];
    } else {
      // Verify Firebase ID token
      const decoded = await adminAuth.verifyIdToken(token);
      const email = (decoded.email || '').toLowerCase();
      const uid = decoded.uid;

      // Check if user exists by uid or email
      const existingByUid = await db.select().from(users).where(eq(users.uid, uid));
      if (existingByUid.length > 0) {
        dbUser = existingByUid[0];
      } else if (email) {
        const existingByEmail = await db.select().from(users).where(eq(users.email, email));
        if (existingByEmail.length > 0) {
          // Link Firebase UID to existing user record
          const updated = await db
            .update(users)
            .set({ uid })
            .where(eq(users.id, existingByEmail[0].id))
            .returning();
          dbUser = updated[0];
        }
      }

      if (!dbUser) {
        // Check if any Super Admin exists or if this is the owner email
        const totalUsersRes = await db.select({ value: count() }).from(users);
        const isFirstUser = Number(totalUsersRes[0]?.value || 0) === 0;
        const isOwnerEmail = email === 'mdmahmudulhashan0@gmail.com';

        const assignedRole: UserRole = isFirstUser || isOwnerEmail ? 'SUPER_ADMIN' : 'ADMIN';
        const inserted = await db
          .insert(users)
          .values({
            uid,
            name: decoded.name || email.split('@')[0] || 'System User',
            email: email || `${uid}@homerecipefoods.com`,
            passwordHash: hashPassword('Admin@1234'),
            role: assignedRole,
            assignedDepartmentIds: '[]',
            status: 'ACTIVE',
          })
          .onConflictDoUpdate({
            target: users.uid,
            set: { email: email || `${uid}@homerecipefoods.com` },
          })
          .returning();
        dbUser = inserted[0];
      }
    }

    if (!dbUser) {
      return res.status(401).json({ error: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি।' });
    }

    if (dbUser.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'আপনার অ্যাকাউন্টটি বর্তমানে নিষ্ক্রিয় করা হয়েছে।' });
    }

    req.authUser = {
      id: dbUser.id,
      uid: dbUser.uid,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role as UserRole,
      assignedDepartmentIds: parseDepartmentIds(dbUser.assignedDepartmentIds),
      status: dbUser.status,
    };

    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস: অবৈধ টোকেন।' });
  }
};

export const requireRoles = (allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস।' });
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      return res.status(403).json({
        error: 'এই মডিউল বা তথ্যে আপনার প্রবেশের অনুমতি নেই।',
      });
    }
    next();
  };
};

export function canAccessDepartment(user: AuthenticatedUser, departmentId: number): boolean {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  return user.assignedDepartmentIds.includes(Number(departmentId));
}
