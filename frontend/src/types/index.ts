export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  createdAt?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface HealthProfile {
  id?: string;
  userId?: string;
  age?: number | null;
  gender?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  bloodGroup?: string | null;
  allergies: string[];
  conditions: string[];
  medications: string[];
  activityLevel?: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  flagged?: boolean;
  createdAt?: string;
}

export interface RedFlag {
  triggered: boolean;
  severity: string;
  matched_rules: string[];
  labels: string[];
  advice: string;
  emergency_numbers: Record<string, string>;
}

export interface ChatResponse {
  conversationId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  redFlag: RedFlag;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  messageCount: number;
  preview?: string | null;
}

export interface SymptomCheck {
  id: string;
  symptoms: string[];
  duration?: string | null;
  severity?: string | null;
  possibleCauses: string[];
  selfCare: string[];
  whenToSeeDoctor?: string | null;
  urgency: string;
  redFlag: boolean;
  summary?: string | null;
  createdAt?: string;
}

export interface WellnessLog {
  id: string;
  logDate: string;
  waterGlasses?: number | null;
  sleepHours?: number | null;
  steps?: number | null;
  exerciseMinutes?: number | null;
  mood?: string | null;
  weightKg?: number | null;
  note?: string | null;
}

export interface WellnessSummary {
  range: string;
  totals: Record<string, number>;
  averages: Record<string, number>;
  series: Array<Record<string, number | string | null>>;
  logCount: number;
}

export interface Goal {
  id: string;
  type: string;
  title: string;
  target: number;
  unit: string;
  frequency: string;
  progress: number;
  streak: number;
  isActive: boolean;
}

export interface Reminder {
  id: string;
  title: string;
  type: string;
  time: string;
  frequency: string;
  days: string[];
  isActive: boolean;
  lastTriggeredAt?: string | null;
}

export interface WellnessTips {
  headline: string;
  tips: Array<{ area: string; tip: string }>;
  focus_area: string;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalSymptomChecks: number;
  flaggedChats: number;
  topTopics: Array<{ topic: string; count: number }>;
  dailyChats: Array<{ date: string; count: number }>;
  userGrowth: Array<{ date: string; count: number }>;
}

export interface FlaggedChat {
  id: string;
  userId?: string | null;
  content: string;
  matchedRules: string[];
  severity: string;
  source: string;
  reviewed: boolean;
  createdAt: string;
}

export interface AdminSetting {
  id: string;
  key: string;
  value: unknown;
  updatedBy?: string | null;
}
