// Core Types for EduWatch

export type UserRole = 'student' | 'institute_admin' | 'government_official' | 'platform_admin';

export type ComplaintStatus = 
  | 'draft' 
  | 'submitted' 
  | 'ai-checked' 
  | 'confirmed' 
  | 'notified' 
  | 'under-review' 
  | 'in-progress' 
  | 'resolved' 
  | 'closed' 
  | 'rejected';

export type ComplaintCategory = 
  | 'infrastructure' 
  | 'academics' 
  | 'safety' 
  | 'hygiene' 
  | 'admin' 
  | 'other';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  instituteId?: string;
  districtId?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface Institute {
  id: string;
  name: string;
  type: 'school' | 'college' | 'university';
  address: string;
  district: string;
  state: string;
  verified: boolean;
  trustScore: number; // 0-100
  responseRate: number; // percentage
  avgResolutionTime: number; // in hours
  totalComplaints: number;
  resolvedComplaints: number;
  adminIds: string[];
  createdAt: string;
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  urgency: UrgencyLevel;
  status: ComplaintStatus;
  studentId: string;
  studentName?: string; // null if anonymous
  isAnonymous: boolean;
  instituteId: string;
  instituteName: string;
  location?: string;
  department?: string;
  images: string[];
  aiAnalysis?: AIAnalysis;
  confirmations: number;
  viewCount: number;
  escalated: boolean;
  escalatedAt?: string;
  escalationReason?: string;
  instituteResponse?: InstituteResponse;
  timeline: TimelineEvent[];
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface AIAnalysis {
  confidence: number; // 0-100
  category: ComplaintCategory;
  urgency: UrgencyLevel;
  sentiment: 'negative' | 'neutral' | 'positive';
  keywords: string[];
  duplicateOf?: string; // complaint ID if duplicate detected
  flagged: boolean;
  flagReason?: string;
  analyzedAt: string;
}

export interface InstituteResponse {
  message: string;
  status: 'acknowledged' | 'in-progress' | 'resolved' | 'rejected';
  proofImages?: string[];
  respondedBy: string;
  respondedAt: string;
}

export interface TimelineEvent {
  id: string;
  complaintId: string;
  type: 'status_change' | 'comment' | 'escalation' | 'response' | 'confirmation';
  title: string;
  description: string;
  actor: string;
  actorRole: UserRole;
  createdAt: string;
}

export interface Comment {
  id: string;
  complaintId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  content: string;
  isOfficial: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'status_update' | 'response' | 'escalation' | 'confirmation' | 'comment' | 'system';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalReports: number;
  pending: number;
  inProgress: number;
  resolved: number;
  rejectedOrClosed: number;
  responseRate?: number;
  avgResolutionTime?: number;
  trustScore?: number;
}

export interface FilterOptions {
  category?: ComplaintCategory;
  status?: ComplaintStatus;
  urgency?: UrgencyLevel;
  dateFrom?: string;
  dateTo?: string;
  instituteId?: string;
  district?: string;
  searchQuery?: string;
}
