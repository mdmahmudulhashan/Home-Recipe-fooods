export const BENGALI_MONTHS = [
  { value: 1, label: 'জানুয়ারি (January)' },
  { value: 2, label: 'ফেব্রুয়ারি (February)' },
  { value: 3, label: 'মার্চ (March)' },
  { value: 4, label: 'এপ্রিল (April)' },
  { value: 5, label: 'মে (May)' },
  { value: 6, label: 'জুন (June)' },
  { value: 7, label: 'জুলাই (July)' },
  { value: 8, label: 'আগস্ট (August)' },
  { value: 9, label: 'সেপ্টেম্বর (September)' },
  { value: 10, label: 'অক্টোবর (October)' },
  { value: 11, label: 'নভেম্বর (November)' },
  { value: 12, label: 'ডিসেম্বর (December)' },
];

export function getMonthLabel(month: number): string {
  return BENGALI_MONTHS.find((m) => m.value === Number(month))?.label || String(month);
}

export function formatTaka(amount: number | string | undefined): string {
  const num = Number(amount) || 0;
  return `৳ ${num.toLocaleString('en-IN')}`;
}

export function getRoleLabel(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'সুপার অ্যাডমিন (Super Admin)';
    case 'ADMIN':
      return 'অ্যাডমিন (Admin)';
    case 'MANAGER':
      return 'ম্যানেজার (Manager)';
    default:
      return role;
  }
}

export function getLeaveTypeLabel(type: string): string {
  switch (type) {
    case 'Casual':
      return 'নৈমিত্তিক ছুটি (Casual)';
    case 'Sick':
      return 'অসুস্থতাজনিত ছুটি (Sick)';
    case 'Annual':
      return 'বার্ষিক ছুটি (Annual)';
    case 'Emergency':
      return 'জরুরি ছুটি (Emergency)';
    default:
      return 'অন্যান্য (Other)';
  }
}

export function getEmploymentStatusLabel(status: string): string {
  switch (status) {
    case 'Active':
      return 'সক্রিয় (Active)';
    case 'Inactive':
      return 'নিষ্ক্রিয় (Inactive)';
    case 'Resigned':
      return 'পদত্যাগ (Resigned)';
    case 'Terminated':
      return 'চাকরিচ্যুত (Terminated)';
    default:
      return status;
  }
}
