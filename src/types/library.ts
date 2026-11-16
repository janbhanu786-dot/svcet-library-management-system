export type Department =
  | 'CSE'
  | 'AI & DS'
  | 'ECE'
  | 'EEE'
  | 'MECH'
  | 'CIVIL'
  | 'MBA';

export type CoverVariant = 'cs' | 'ece' | 'navy' | 'emerald' | 'slate';

export interface Book {
  id: number;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  department: Department;
  edition: string;
  rack_location: string;
  total_copies: number;
  available_copies: number;
  cover_variant: CoverVariant;
  description: string;
  created_at: string;
}

export interface Student {
  id: number;
  roll_no: string;
  name: string;
  department: Department;
  year_sem: string;
  email: string;
  phone: string;
  max_books: number;
  status: 'Active' | 'Suspended';
  created_at?: string;
  active_issues?: number;
  pending_fines?: number;
}

export interface BookIssue {
  id: number;
  book_id: number;
  student_id: number;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  fine_amount: number;
  computed_fine: number;
  days_overdue: number;
  status: 'Issued' | 'Returned' | 'Overdue';
  issued_by: string;
  book_title: string;
  book_isbn: string;
  book_author: string;
  book_department: Department;
  rack_location: string;
  student_name: string;
  student_roll_no: string;
  student_department: Department;
}

export interface Reservation {
  id: number;
  book_id: number;
  student_id: number;
  requested_at: string;
  status: 'Pending' | 'Approved' | 'Cancelled' | 'Fulfilled';
  notes: string;
  book_title: string;
  book_isbn: string;
  book_author: string;
  book_department: Department;
  available_copies: number;
  rack_location: string;
  student_name: string;
  student_roll_no: string;
  student_department: Department;
}

export interface LibraryOverview {
  totalTitles: number;
  totalCopies: number;
  availableCopies: number;
  issuedActiveCount: number;
  overdueCount: number;
  pendingReservations: number;
  totalStudents: number;
  totalFinesCollected: number;
  departmentCounts: { department: string; titles: number; available: number }[];
}

export interface SqlQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionMs: number;
}
