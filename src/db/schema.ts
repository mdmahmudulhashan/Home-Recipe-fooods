import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. Users table (Authentication & RBAC)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase UID or credential UID
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('MANAGER'), // 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER'
  assignedDepartmentIds: text('assigned_department_ids').notNull().default('[]'), // JSON stringified array of department IDs
  status: text('status').notNull().default('ACTIVE'), // 'ACTIVE' | 'INACTIVE'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Departments table
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').default(''),
  status: text('status').notNull().default('ACTIVE'), // 'ACTIVE' | 'INACTIVE'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Designations table
export const designations = pgTable('designations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').default(''),
  status: text('status').notNull().default('ACTIVE'), // 'ACTIVE' | 'INACTIVE'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Employees table
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  employeeCode: text('employee_code').notNull().unique(), // e.g., HRF-1001
  fullName: text('full_name').notNull(),
  photoUrl: text('photo_url').default(''),
  mobile: text('mobile').notNull(),
  email: text('email').default(''),
  nid: text('nid').default(''),
  dateOfBirth: text('date_of_birth').default(''), // YYYY-MM-DD
  joiningDate: text('joining_date').notNull(), // YYYY-MM-DD
  departmentId: integer('department_id')
    .references(() => departments.id)
    .notNull(),
  designationId: integer('designation_id')
    .references(() => designations.id)
    .notNull(),
  employmentType: text('employment_type').notNull().default('Full Time'), // 'Full Time' | 'Part Time' | 'Contract' | 'Temporary'
  employmentStatus: text('employment_status').notNull().default('Active'), // 'Active' | 'Inactive' | 'Resigned' | 'Terminated'
  basicSalary: numeric('basic_salary', { precision: 12, scale: 2 }).notNull().default('0'),
  salaryType: text('salary_type').notNull().default('Monthly'), // 'Monthly' | 'Daily'
  monthlyBonus: numeric('monthly_bonus', { precision: 12, scale: 2 }).notNull().default('0'),
  currentAddress: text('current_address').default(''),
  permanentAddress: text('permanent_address').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Leaves table
export const leaves = pgTable('leaves', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
  departmentId: integer('department_id')
    .references(() => departments.id)
    .notNull(),
  leaveType: text('leave_type').notNull().default('Casual'), // 'Casual' | 'Sick' | 'Annual' | 'Emergency' | 'Other'
  isPaid: boolean('is_paid').notNull().default(true),
  startDate: text('start_date').notNull(), // YYYY-MM-DD
  endDate: text('end_date').notNull(), // YYYY-MM-DD
  totalDays: integer('total_days').notNull().default(1),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('Approved'), // 'Pending' | 'Approved' | 'Rejected'
  addedByUserId: integer('added_by_user_id').references(() => users.id),
  addedByName: text('added_by_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Absences table
export const absences = pgTable(
  'absences',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id')
      .references(() => employees.id, { onDelete: 'cascade' })
      .notNull(),
    departmentId: integer('department_id')
      .references(() => departments.id)
      .notNull(),
    date: text('date').notNull(), // YYYY-MM-DD
    reason: text('reason').notNull().default('অনুপস্থিত'),
    addedByUserId: integer('added_by_user_id').references(() => users.id),
    addedByName: text('added_by_name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    empDateIdx: uniqueIndex('absences_emp_date_idx').on(table.employeeId, table.date),
  })
);

// 7. Snack Purchases table
export const snackPurchases = pgTable('snack_purchases', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
  departmentId: integer('department_id')
    .references(() => departments.id)
    .notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  itemDescription: text('item_description').notNull(),
  quantity: integer('quantity').notNull().default(1),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  remarks: text('remarks').default(''),
  addedByUserId: integer('added_by_user_id').references(() => users.id),
  addedByName: text('added_by_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Advances table
export const advances = pgTable('advances', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
  departmentId: integer('department_id')
    .references(() => departments.id)
    .notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  remarks: text('remarks').default(''),
  addedByUserId: integer('added_by_user_id').references(() => users.id),
  addedByName: text('added_by_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Salary Records (Saved / Finalized Salary Sheets)
export const salaryRecords = pgTable(
  'salary_records',
  {
    id: serial('id').primaryKey(),
    month: integer('month').notNull(), // 1 - 12
    year: integer('year').notNull(), // e.g., 2026
    employeeId: integer('employee_id')
      .references(() => employees.id, { onDelete: 'cascade' })
      .notNull(),
    departmentId: integer('department_id')
      .references(() => departments.id)
      .notNull(),
    basicSalary: numeric('basic_salary', { precision: 12, scale: 2 }).notNull(),
    dailySalary: numeric('daily_salary', { precision: 12, scale: 2 }).notNull(),
    regularPaidDays: integer('regular_paid_days').notNull(),
    fridayOvertimeDays: integer('friday_overtime_days').notNull(),
    totalDays: integer('total_days').notNull(),
    overtimePay: numeric('overtime_pay', { precision: 12, scale: 2 }).notNull(),
    monthlyBonus: numeric('monthly_bonus', { precision: 12, scale: 2 }).notNull(),
    grossSalary: numeric('gross_salary', { precision: 12, scale: 2 }).notNull(),
    totalAdvance: numeric('total_advance', { precision: 12, scale: 2 }).notNull(),
    totalSnack: numeric('total_snack', { precision: 12, scale: 2 }).notNull(),
    payableSalary: numeric('payable_salary', { precision: 12, scale: 2 }).notNull(),
    generatedByUserId: integer('generated_by_user_id').references(() => users.id),
    generatedByName: text('generated_by_name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    empMonthYearIdx: uniqueIndex('salary_emp_month_year_idx').on(
      table.employeeId,
      table.month,
      table.year
    ),
  })
);

// 10. Activity Logs table
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  userName: text('user_name').notNull(),
  userRole: text('user_role').notNull(),
  action: text('action').notNull(),
  module: text('module').notNull(),
  recordInfo: text('record_info').notNull(),
  departmentId: integer('department_id'),
  previousValue: text('previous_value').default(''),
  newValue: text('new_value').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Settings table
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  companyName: text('company_name').notNull().default('হোম রেসিপি ফুডস্'),
  companyAddress: text('company_address').notNull().default('চট্টগ্রাম, বাংলাদেশ'),
  companyPhone: text('company_phone').notNull().default('+880 1800-000000'),
  companyEmail: text('company_email').notNull().default('hr@homerecipefoods.com'),
  standardMonthDays: integer('standard_month_days').notNull().default(30),
  fridayOvertimeEnabled: boolean('friday_overtime_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const employeesRelations = relations(employees, ({ one, many }) => ({
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  designation: one(designations, {
    fields: [employees.designationId],
    references: [designations.id],
  }),
  leaves: many(leaves),
  absences: many(absences),
  snackPurchases: many(snackPurchases),
  advances: many(advances),
  salaryRecords: many(salaryRecords),
}));
