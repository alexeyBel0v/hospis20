import type { CatheterType, Patient } from '../types.ts';

/** «Петров Николай Сергеевич» → «Петров Н. С.» */
export const shortName = (fullName: string): string => {
  const [last = '', first = '', middle = ''] = fullName.trim().split(/\s+/);
  return [last, first && `${first[0]}.`, middle && `${middle[0]}.`].filter(Boolean).join(' ');
};

export const CATHETER_TYPES: Array<{ value: CatheterType; label: string }> = [
  { value: 'none', label: 'Нет' },
  { value: 'urinary', label: 'Мочевой' },
  { value: 'cysto', label: 'Цистостома' },
  { value: 'other', label: 'Другой' },
];

export const CATHETER_SIZES = [14, 16, 18, 20, 22, 24, 26, 28];

/** «Мочевой Ch 16» */
export const catheterLabel = (patient: Patient): string => {
  const type = CATHETER_TYPES.find((item) => item.value === patient.catheter.type);
  if (!type || patient.catheter.type === 'none') return '';
  return patient.catheter.size ? `${type.label} Ch ${patient.catheter.size}` : type.label;
};

export const policyLine = (patient: Patient): string => (patient.policy ? patient.policy : 'полис не указан');
