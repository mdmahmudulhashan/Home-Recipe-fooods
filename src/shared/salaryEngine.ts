/**
 * CENTRALIZED ATTENDANCE, FRIDAY OVERTIME & SALARY CALCULATION ENGINE
 * Home Recipe Foods — Chattogram, Bangladesh
 *
 * All modules (Salary Sheet, Employee Profile, Reports, Dashboard, Print/PDF)
 * MUST use this single calculation engine to ensure 100% mathematical consistency.
 */

export interface LeaveRecordInput {
  id: number;
  employeeId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isPaid: boolean;
  status: string; // 'Approved' | 'Pending' | 'Rejected'
  leaveType: string;
}

export interface AbsenceRecordInput {
  id: number;
  employeeId: number;
  date: string; // YYYY-MM-DD
  reason: string;
}

export interface AdvanceRecordInput {
  id: number;
  employeeId: number;
  date: string; // YYYY-MM-DD
  amount: number | string;
}

export interface SnackRecordInput {
  id: number;
  employeeId: number;
  date: string; // YYYY-MM-DD
  amount: number | string;
}

export interface EmployeeCalculationInput {
  id: number;
  employeeCode: string;
  fullName: string;
  departmentId: number;
  departmentName?: string;
  designationId: number;
  designationName?: string;
  basicSalary: number | string;
  salaryType: string; // 'Monthly' | 'Daily'
  monthlyBonus: number | string;
  employmentStatus: string;
  joiningDate: string;
}

export interface MonthlyCalculationResult {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  departmentId: number;
  departmentName: string;
  designationName: string;
  month: number;
  year: number;
  basicSalary: number;
  dailySalary: number;
  standardRegularDays: number; // Default 30
  regularAbsenceDays: number; // Absences on non-Fridays
  fridayAbsenceDays: number; // Absences on Fridays
  totalAbsenceDays: number; // All absences in the month (excluding approved leave)
  approvedPaidLeaveDays: number;
  approvedUnpaidLeaveDays: number;
  regularUnpaidLeaveDays: number; // Unpaid leave on non-Fridays
  totalFridaysInMonth: number;
  fridayLeaveDays: number; // Approved leaves falling on Fridays
  fridayOvertimeDays: number; // Fridays where employee is NOT absent AND NOT on approved leave
  regularPaidDays: number; // 30 - regularAbsenceDays - regularUnpaidLeaveDays
  totalDays: number; // regularPaidDays + fridayOvertimeDays
  regularSalary: number; // dailySalary * regularPaidDays
  overtimePay: number; // dailySalary * fridayOvertimeDays
  monthlyBonus: number;
  grossSalary: number; // regularSalary + overtimePay + monthlyBonus
  totalAdvance: number;
  totalSnack: number;
  payableSalary: number; // grossSalary - totalAdvance - totalSnack
  fridaysDetail: {
    date: string;
    status: 'WORKED_OVERTIME' | 'ABSENT' | 'ON_LEAVE';
  }[];
}

/**
 * Helper to format YYYY-MM-DD cleanly without timezone shifts
 */
export function formatDateYMD(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Returns true if the given YYYY-MM-DD string is a Friday
 */
export function isFridayDate(dateStr: string): boolean {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return false;
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  return dateObj.getDay() === 5; // 5 = Friday
}

/**
 * Gets all dates in a given month (1-12) and year
 */
export function getDatesInMonth(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(formatDateYMD(year, month, d));
  }
  return dates;
}

/**
 * Checks if a specific date (YYYY-MM-DD) falls inside an approved leave record
 */
export function findLeaveOnDate(
  dateStr: string,
  leaves: LeaveRecordInput[]
): LeaveRecordInput | undefined {
  return leaves.find(
    (l) =>
      l.status === 'Approved' &&
      dateStr >= l.startDate &&
      dateStr <= l.endDate
  );
}

/**
 * Determines daily attendance status for an employee on a specific date
 * Rule 13:
 * - Every active employee is Present by default.
 * - If approved leave exists -> 'LEAVE' (Approved leave must NOT be counted as absence)
 * - Else if absence exists -> 'ABSENT'
 * - Else -> 'PRESENT'
 */
export function getDailyAttendanceStatus(
  dateStr: string,
  employeeStatus: string,
  leaves: LeaveRecordInput[],
  absences: AbsenceRecordInput[]
): 'PRESENT' | 'ABSENT' | 'LEAVE' | 'INACTIVE' {
  if (employeeStatus !== 'Active') {
    return 'INACTIVE';
  }
  const leave = findLeaveOnDate(dateStr, leaves);
  if (leave) {
    return 'LEAVE';
  }
  const hasAbsence = absences.some((a) => a.date === dateStr);
  if (hasAbsence) {
    return 'ABSENT';
  }
  return 'PRESENT';
}

/**
 * Centralized Monthly Salary & Attendance Calculation Engine
 * Follows Rules 15, 16, 20, 21, 37, 38 strictly.
 */
export function calculateEmployeeMonthlySalary(
  employee: EmployeeCalculationInput,
  year: number,
  month: number,
  employeeLeaves: LeaveRecordInput[],
  employeeAbsences: AbsenceRecordInput[],
  employeeAdvances: AdvanceRecordInput[],
  employeeSnacks: SnackRecordInput[],
  standardMonthDays = 30,
  fridayOvertimeEnabled = true
): MonthlyCalculationResult {
  const basicSalary = Number(employee.basicSalary) || 0;
  const monthlyBonus = Number(employee.monthlyBonus) || 0;
  const dailySalary =
    employee.salaryType === 'Daily'
      ? basicSalary
      : Number((basicSalary / standardMonthDays).toFixed(2));

  const datesInMonth = getDatesInMonth(year, month);
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  let regularAbsenceDays = 0;
  let fridayAbsenceDays = 0;
  let approvedPaidLeaveDays = 0;
  let approvedUnpaidLeaveDays = 0;
  let regularUnpaidLeaveDays = 0;
  let totalFridaysInMonth = 0;
  let fridayLeaveDays = 0;
  let fridayOvertimeDays = 0;

  const fridaysDetail: {
    date: string;
    status: 'WORKED_OVERTIME' | 'ABSENT' | 'ON_LEAVE';
  }[] = [];

  for (const dateStr of datesInMonth) {
    const isFri = isFridayDate(dateStr);
    const approvedLeave = findLeaveOnDate(dateStr, employeeLeaves);
    const hasAbsence = employeeAbsences.some((a) => a.date === dateStr);

    if (isFri) {
      totalFridaysInMonth++;
      if (approvedLeave) {
        fridayLeaveDays++;
        if (approvedLeave.isPaid !== false) {
          approvedPaidLeaveDays++;
        } else {
          approvedUnpaidLeaveDays++;
        }
        fridaysDetail.push({ date: dateStr, status: 'ON_LEAVE' });
      } else if (hasAbsence) {
        fridayAbsenceDays++;
        fridaysDetail.push({ date: dateStr, status: 'ABSENT' });
      } else {
        if (fridayOvertimeEnabled) {
          fridayOvertimeDays++;
        }
        fridaysDetail.push({ date: dateStr, status: 'WORKED_OVERTIME' });
      }
    } else {
      // Regular working day (Saturday - Thursday)
      // Important Rule 12 & 13: Approved leave must NOT be counted as absence
      if (approvedLeave) {
        if (approvedLeave.isPaid !== false) {
          approvedPaidLeaveDays++;
        } else {
          approvedUnpaidLeaveDays++;
          regularUnpaidLeaveDays++;
        }
      } else if (hasAbsence) {
        regularAbsenceDays++;
      }
    }
  }

  const totalAbsenceDays = regularAbsenceDays + fridayAbsenceDays;

  // Rule 16: Regular Paid Days = Regular working days (30) - Absence days (on regular days) - Unpaid leave days (on regular days)
  const regularPaidDays = Math.max(
    0,
    standardMonthDays - regularAbsenceDays - regularUnpaidLeaveDays
  );

  // Rule 15 & 16: Total Days = Regular Paid Days + Friday Overtime
  const totalDays = regularPaidDays + fridayOvertimeDays;

  // Rule 20:
  // Regular Salary = Daily Salary * Regular Paid Days
  // Overtime Pay = Daily Salary * Friday Overtime Days
  // Gross Salary = Regular Salary + Overtime Pay + Monthly Bonus
  const exactDaily =
    employee.salaryType === 'Daily' ? basicSalary : basicSalary / standardMonthDays;

  const regularSalary = Math.round(exactDaily * regularPaidDays);
  const overtimePay = Math.round(exactDaily * fridayOvertimeDays);
  const grossSalary = regularSalary + overtimePay + Math.round(monthlyBonus);

  // Sum Advances for the selected month
  const totalAdvance = employeeAdvances
    .filter((a) => a.date.startsWith(monthPrefix))
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  // Sum Snack Purchases for the selected month
  const totalSnack = employeeSnacks
    .filter((s) => s.date.startsWith(monthPrefix))
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  // Payable Salary = Gross Salary - Total Advance - Total Snack Purchase
  const payableSalary = Math.round(grossSalary - totalAdvance - totalSnack);

  return {
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    departmentId: employee.departmentId,
    departmentName: employee.departmentName || '',
    designationName: employee.designationName || '',
    month,
    year,
    basicSalary: Math.round(basicSalary),
    dailySalary: Math.round(dailySalary * 100) / 100,
    standardRegularDays: standardMonthDays,
    regularAbsenceDays,
    fridayAbsenceDays,
    totalAbsenceDays,
    approvedPaidLeaveDays,
    approvedUnpaidLeaveDays,
    regularUnpaidLeaveDays,
    totalFridaysInMonth,
    fridayLeaveDays,
    fridayOvertimeDays,
    regularPaidDays,
    totalDays,
    regularSalary,
    overtimePay,
    monthlyBonus: Math.round(monthlyBonus),
    grossSalary,
    totalAdvance: Math.round(totalAdvance),
    totalSnack: Math.round(totalSnack),
    payableSalary,
    fridaysDetail,
  };
}

/**
 * Calculates inclusive leave days between startDate and endDate (YYYY-MM-DD)
 */
export function calculateLeaveDaysCount(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  const diffTime = e.getTime() - s.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Returns all YYYY-MM-DD dates inclusively between startDate and endDate
 */
export function getDatesBetween(startDate: string, endDate?: string): string[] {
  const effectiveEnd = endDate || startDate;
  if (!startDate || !effectiveEnd) return [];
  const sParts = startDate.split('-').map(Number);
  const eParts = effectiveEnd.split('-').map(Number);
  if (sParts.length !== 3 || eParts.length !== 3) return [];
  const cur = new Date(sParts[0], sParts[1] - 1, sParts[2]);
  const end = new Date(eParts[0], eParts[1] - 1, eParts[2]);
  if (isNaN(cur.getTime()) || isNaN(end.getTime()) || end < cur) return [];
  const result: string[] = [];
  while (cur <= end && result.length < 366) {
    result.push(formatDateYMD(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

