import { ComplaintCategory, UrgencyLevel, ComplaintStatus } from './types';

export const COMPLAINT_CATEGORIES: { value: ComplaintCategory; label: string; description: string }[] = [
  {
    value: 'infrastructure',
    label: 'Infrastructure',
    description: 'Building damage, broken facilities, electrical issues, water supply',
  },
  {
    value: 'academics',
    label: 'Academics',
    description: 'Teaching quality, curriculum issues, exam problems, resource availability',
  },
  {
    value: 'safety',
    label: 'Safety',
    description: 'Security concerns, harassment, bullying, unsafe conditions',
  },
  {
    value: 'hygiene',
    label: 'Hygiene',
    description: 'Cleanliness issues, sanitation, pest control, food quality',
  },
  {
    value: 'admin',
    label: 'Administration',
    description: 'Fee issues, admission problems, documentation, staff behavior',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Issues not covered in other categories',
  },
];

export const URGENCY_LEVELS: { value: UrgencyLevel; label: string; color: string }[] = [
  { value: 'low', label: 'Low Priority', color: 'slate' },
  { value: 'medium', label: 'Medium Priority', color: 'amber' },
  { value: 'high', label: 'High Priority', color: 'orange' },
  { value: 'critical', label: 'Critical', color: 'rose' },
];

export const COMPLAINT_STATUSES: { value: ComplaintStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: 'slate' },
  { value: 'submitted', label: 'Submitted', color: 'blue' },
  { value: 'ai-checked', label: 'AI Verified', color: 'purple' },
  { value: 'confirmed', label: 'Confirmed', color: 'indigo' },
  { value: 'notified', label: 'Institute Notified', color: 'cyan' },
  { value: 'under-review', label: 'Under Review', color: 'amber' },
  { value: 'in-progress', label: 'In Progress', color: 'yellow' },
  { value: 'resolved', label: 'Resolved', color: 'emerald' },
  { value: 'closed', label: 'Closed', color: 'slate' },
  { value: 'rejected', label: 'Rejected', color: 'rose' },
];

export const SLA_TIMES = {
  ACKNOWLEDGE: 24, // hours
  RESPOND: 72, // hours
  RESOLVE_LOW: 168, // 7 days
  RESOLVE_MEDIUM: 120, // 5 days
  RESOLVE_HIGH: 72, // 3 days
  RESOLVE_CRITICAL: 24, // 1 day
};

export const APP_NAME = 'EduWatch';
export const APP_DESCRIPTION = 'Student complaint, verification, and accountability system';
export const SUPPORT_EMAIL = 'support@eduwatch.gov';
export const MAX_IMAGE_UPLOADS = 5;
export const MAX_IMAGE_SIZE_MB = 5;
