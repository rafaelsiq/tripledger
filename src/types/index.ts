export type TripPhase = 'planning' | 'in_progress' | 'closed';
export type MemberRole = 'admin' | 'member';
export type ExpenseKind = 'planned' | 'actual' | 'income';
export type ExpenseCategory =
  | 'lodging'
  | 'transport'
  | 'food'
  | 'activities'
  | 'other';
export type PaymentStatus = 'pending' | 'confirmed' | 'rejected';
export type SplitStatus = 'pending' | 'partial' | 'paid';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: number;
}

export interface Trip {
  id: string;
  name: string;
  destination?: string;
  description?: string;
  coverUrl?: string;
  startDate: string;
  endDate: string;
  phase: TripPhase;
  adminUid: string;
  financeLeadUid: string;
  inviteCode: string;
  budgetTotal: number;
  categoryBudgets: Partial<Record<ExpenseCategory, number>>;
  currency: string;
  createdAt: number;
  updatedAt: number;
}

export interface TripMember {
  uid: string;
  displayName: string;
  email: string;
  role: MemberRole;
  joinedAt: number;
  photoURL?: string;
  /** Placeholder member (no app login) managed by admin until linked to a real user. */
  isDummy?: boolean;
  createdByUid?: string;
}

export interface ExpenseSplit {
  uid: string;
  amount: number;
  paidAmount: number;
  status: SplitStatus;
  /** How many installments this debtor should use (informational; see installments[]). */
  installmentCount?: number;
}

export interface ExpenseInstallment {
  id: string;
  uid: string;
  index: number;
  amount: number;
  paidAmount: number;
  status: SplitStatus;
  dueDate?: string;
}

export interface Expense {
  id: string;
  tripId: string;
  kind: ExpenseKind;
  title: string;
  category: ExpenseCategory;
  amount: number;
  paidByUid: string;
  splits: ExpenseSplit[];
  /** Planned repayment schedule per debtor (optional for legacy expenses). */
  installments?: ExpenseInstallment[];
  note?: string;
  receiptUrl?: string;
  dueDate?: string;
  createdByUid: string;
  createdAt: number;
  updatedAt: number;
}

export interface Payment {
  id: string;
  tripId: string;
  expenseId: string;
  fromUid: string;
  toUid: string;
  amount: number;
  /** Which planned installment this payment targets, when applicable. */
  installmentId?: string;
  proofUrl?: string;
  paidAt: number;
  status: PaymentStatus;
  note?: string;
  confirmedByUid?: string;
  confirmedAt?: number;
}

export interface ConsolidationRequest {
  id: string;
  tripId: string;
  paymentId: string;
  fromUid: string;
  toUid: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  resolvedAt?: number;
  resolvedByUid?: string;
}

export interface ItineraryDay {
  id: string;
  tripId: string;
  date: string;
  title?: string;
  order: number;
}

export interface ItineraryItem {
  id: string;
  dayId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  time?: string;
  location?: string;
  mapUrl?: string;
  order: number;
  done: boolean;
  attendees: string[];
  createdByUid: string;
  createdAt: number;
}

export interface FeedPost {
  id: string;
  tripId: string;
  authorUid: string;
  authorName: string;
  caption?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  dayId?: string;
  likes: string[];
  createdAt: number;
}

export interface FeedComment {
  id: string;
  authorUid: string;
  authorName: string;
  text: string;
  createdAt: number;
}

export interface Settlement {
  id: string;
  tripId: string;
  fromUid: string;
  toUid: string;
  amount: number;
  status: 'open' | 'settled';
  proofUrl?: string;
  createdAt: number;
  settledAt?: number;
}

export interface AppNotification {
  id: string;
  tripId: string;
  toUid: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
  type: string;
}

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  lodging: 'Hospedagem',
  transport: 'Transporte',
  food: 'Alimentação',
  activities: 'Atividades',
  other: 'Outros',
};

export const PHASE_LABELS: Record<TripPhase, string> = {
  planning: 'Planejamento',
  in_progress: 'Em progresso',
  closed: 'Concluída',
};

/** All selectable phases for admin status changes. */
export const TRIP_PHASES: TripPhase[] = ['planning', 'in_progress', 'closed'];
