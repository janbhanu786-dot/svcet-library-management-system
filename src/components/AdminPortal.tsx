import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  Download,
  LogOut,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  Book,
  BookIssue,
  CoverVariant,
  Department,
  LibraryOverview,
  Reservation,
  SqlQueryResult,
  Student,
} from '../types/library';

export type AdminSection = 'circulation' | 'inventory' | 'students' | 'sql_python';

const DEPARTMENTS: Department[] = ['CSE', 'AI & DS', 'ECE', 'EEE', 'MECH', 'CIVIL', 'MBA'];

const PRESET_SQL_QUERIES = [
  {
    label: 'Available Books by Dept',
    sql: `SELECT department, COUNT(*) AS titles, SUM(total_copies) AS total_copies, SUM(available_copies) AS available_now\nFROM books\nGROUP BY department\nORDER BY available_now DESC;`,
  },
  {
    label: 'Active & Overdue Borrowings',
    sql: `SELECT s.roll_no, s.name, b.title, i.issue_date, i.due_date,\n       MAX(0, CAST(julianday('now') - julianday(i.due_date) AS INTEGER)) * 5 AS fine_inr\nFROM issues i\nJOIN students s ON s.id = i.student_id\nJOIN books b ON b.id = i.book_id\nWHERE i.status != 'Returned'\nORDER BY fine_inr DESC;`,
  },
  {
    label: 'Registered Students',
    sql: `SELECT roll_no, name, department, year_sem, email, phone, status, created_at\nFROM students\nORDER BY id DESC;`,
  },
  {
    label: 'SQLite Schema Metadata',
    sql: `SELECT type, name, tbl_name FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY type, name;`,
  },
];

interface AdminPortalProps {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  librarianName: string;
  onLogout: () => void;
  overview: LibraryOverview | null;
  books: Book[];
  students: Student[];
  issues: BookIssue[];
  reservations: Reservation[];
  pythonExport: { schemaSql: string; pythonCode: string; databaseFile: string } | null;
  onAddBook: (payload: {
    isbn: string;
    title: string;
    author: string;
    publisher: string;
    department: Department;
    edition: string;
    rack_location: string;
    total_copies: number;
    cover_variant: CoverVariant;
    description: string;
  }) => Promise<void>;
  onUpdateBookCopies: (book: Book, nextTotalCopies: number) => Promise<void>;
  onDeleteBook: (bookId: number) => Promise<void>;
  onAddStudent: (payload: {
    roll_no: string;
    name: string;
    department: Department;
    year_sem: string;
    email: string;
    phone: string;
    password: string;
    max_books: number;
  }) => Promise<void>;
  onIssueBook: (bookId: number, studentId: number, days: number) => Promise<void>;
  onReturnBook: (issueId: number) => Promise<void>;
  onReservationAction: (reservationId: number, action: 'approve' | 'cancel') => Promise<void>;
  onRunSql: (sql: string) => Promise<SqlQueryResult>;
}

export function AdminPortal({
  activeSection,
  onSectionChange,
  librarianName,
  onLogout,
  overview,
  books,
  students,
  issues,
  reservations,
  pythonExport,
  onAddBook,
  onUpdateBookCopies,
  onDeleteBook,
  onAddStudent,
  onIssueBook,
  onReturnBook,
  onReservationAction,
  onRunSql,
}: AdminPortalProps) {
  const availableBooks = useMemo(
    () => books.filter((b) => b.available_copies > 0),
    [books]
  );

  // Circulation form state
  const [issueStudentId, setIssueStudentId] = useState<number>(students[0]?.id || 0);
  const [issueBookId, setIssueBookId] = useState<number>(availableBooks[0]?.id || 0);
  const [issueDays, setIssueDays] = useState<number>(14);
  const [issueFilter, setIssueFilter] = useState<'all' | 'active' | 'overdue' | 'returned'>('all');
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    if (students.length > 0 && !students.some((s) => s.id === issueStudentId)) {
      setIssueStudentId(students[0].id);
    }
    if (students.length === 0) {
      setIssueStudentId(0);
    }
  }, [students, issueStudentId]);

  useEffect(() => {
    if (availableBooks.length > 0 && !availableBooks.some((b) => b.id === issueBookId)) {
      setIssueBookId(availableBooks[0].id);
    }
  }, [availableBooks, issueBookId]);

  // Inventory state
  const [inventorySearch, setInventorySearch] = useState('');
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [newBook, setNewBook] = useState({
    isbn: '',
    title: '',
    author: '',
    publisher: '',
    department: 'CSE' as Department,
    edition: '1st Edition',
    rack_location: 'Rack CS-07 · Shelf 1',
    total_copies: 5,
    cover_variant: 'cs' as CoverVariant,
    description: '',
  });

  // Students state
  const [studentSearch, setStudentSearch] = useState('');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStudent, setNewStudent] = useState({
    roll_no: '',
    name: '',
    department: 'CSE' as Department,
    year_sem: 'II B.Tech · Sem 2',
    email: '',
    phone: '',
    password: '',
    max_books: 4,
  });

  // SQL & Python state
  const [sqlText, setSqlText] = useState(PRESET_SQL_QUERIES[0].sql);
  const [sqlResult, setSqlResult] = useState<SqlQueryResult | null>(null);
  const [sqlError, setSqlError] = useState('');
  const [runningSql, setRunningSql] = useState(false);
  const [codeTab, setCodeTab] = useState<'python' | 'schema'>('python');
  const [copiedCode, setCopiedCode] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipError, setZipError] = useState('');

  const pendingReservations = useMemo(
    () => reservations.filter((r) => r.status === 'Pending'),
    [reservations]
  );

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (issueFilter === 'active') return issue.status !== 'Returned';
      if (issueFilter === 'overdue') return issue.status === 'Overdue';
      if (issueFilter === 'returned') return issue.status === 'Returned';
      return true;
    });
  }, [issues, issueFilter]);

  const filteredInventory = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.department.toLowerCase().includes(q)
    );
  }, [books, inventorySearch]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.roll_no.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const handleIssueSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!issueBookId || !issueStudentId) return;
    setIssuing(true);
    try {
      await onIssueBook(issueBookId, issueStudentId, issueDays);
    } finally {
      setIssuing(false);
    }
  };

  const handleCreateBook = async (e: FormEvent) => {
    e.preventDefault();
    await onAddBook(newBook);
    setShowAddBookModal(false);
    setNewBook({
      isbn: '',
      title: '',
      author: '',
      publisher: '',
      department: 'CSE',
      edition: '1st Edition',
      rack_location: 'Rack CS-07 · Shelf 1',
      total_copies: 5,
      cover_variant: 'cs',
      description: '',
    });
  };

  const handleCreateStudent = async (e: FormEvent) => {
    e.preventDefault();
    await onAddStudent(newStudent);
    setShowAddStudentModal(false);
    setNewStudent({
      roll_no: '',
      name: '',
      department: 'CSE',
      year_sem: 'II B.Tech · Sem 2',
      email: '',
      phone: '',
      password: '',
      max_books: 4,
    });
  };

  const handleExecuteSql = async (queryToRun?: string) => {
    const target = queryToRun ?? sqlText;
    setRunningSql(true);
    setSqlError('');
    try {
      const res = await onRunSql(target);
      setSqlResult(res);
    } catch (err) {
      setSqlError((err as Error).message);
      setSqlResult(null);
    } finally {
      setRunningSql(false);
    }
  };

  const handleCopyCode = async () => {
    if (!pythonExport) return;
    const text = codeTab === 'python' ? pythonExport.pythonCode : pythonExport.schemaSql;
    await navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleDownloadCode = () => {
    if (!pythonExport) return;
    const content = codeTab === 'python' ? pythonExport.pythonCode : pythonExport.schemaSql;
    const filename = codeTab === 'python' ? 'svcet_library.py' : 'schema.sql';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadZip = async () => {
    setZipError('');
    setDownloadingZip(true);
    try {
      const response = await fetch('/api/export/github-zip', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }
      const arrayBuf = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
        throw new Error('Server did not return a valid ZIP archive.');
      }
      const blob = new Blob([arrayBuf], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'svcet-college-library.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      setZipError((err as Error).message || 'Could not download ZIP archive.');
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Sub-navigation Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onSectionChange('circulation')}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'circulation'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Circulation & Desk
          </button>
          <button
            type="button"
            onClick={() => onSectionChange('inventory')}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'inventory'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Book Catalog ({books.length})
          </button>
          <button
            type="button"
            onClick={() => onSectionChange('students')}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'students'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Students ({students.length})
          </button>
          <button
            type="button"
            onClick={() => onSectionChange('sql_python')}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'sql_python'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            SQL Explorer & Python
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600 whitespace-nowrap">
            Admin: <strong className="text-slate-900">{librarianName}</strong>
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </div>

      {/* 4-Column KPI Summary Strip */}
      {overview && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">Catalog Volume</div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
              {overview.totalCopies} copies
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">
              Across {overview.totalTitles} engineering titles
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">Available on Shelves</div>
            <div className="mt-1.5 text-2xl font-bold text-emerald-700 tabular-nums">
              {overview.availableCopies} ready
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">
              {overview.issuedActiveCount} currently in circulation
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">Registered Students</div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
              {overview.totalStudents} accounts
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">
              {overview.overdueCount} overdue loans
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">Pickup Requests & Fines</div>
            <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
              {overview.pendingReservations} pending
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">
              ₹{overview.totalFinesCollected} fines collected
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: CIRCULATION & ISSUE DESK */}
      {activeSection === 'circulation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            {/* Issue Book Form */}
            <form
              onSubmit={handleIssueSubmit}
              className="xl:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div>
                <h2 className="text-base font-semibold text-slate-900">Issue Book to Student</h2>
                <p className="text-xs text-slate-500">
                  Decrements SQL shelf inventory atomically and sets a due date.
                </p>
              </div>

              {students.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-2">
                  <p className="font-medium text-slate-800">No students registered yet.</p>
                  <p>
                    Students appear here automatically after signing up on the Student Interface, or you can register a student manually.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddStudentModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#172554]"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Register Student
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="issue-student" className="block text-xs font-medium text-slate-700">
                      Select Registered Student
                    </label>
                    <select
                      id="issue-student"
                      value={issueStudentId}
                      onChange={(e) => setIssueStudentId(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                    >
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.roll_no} — {s.name} ({s.active_issues ?? 0}/{s.max_books} active)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="issue-book" className="block text-xs font-medium text-slate-700">
                      Select Available Book
                    </label>
                    <select
                      id="issue-book"
                      value={issueBookId}
                      onChange={(e) => setIssueBookId(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                    >
                      {availableBooks.map((b) => (
                        <option key={b.id} value={b.id}>
                          [{b.department}] {b.title} ({b.available_copies} left)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="issue-days" className="block text-xs font-medium text-slate-700">
                      Loan Period
                    </label>
                    <select
                      id="issue-days"
                      value={issueDays}
                      onChange={(e) => setIssueDays(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                    >
                      <option value={7}>7 Days (Reference / Lab)</option>
                      <option value={14}>14 Days (Standard Semester)</option>
                      <option value={21}>21 Days (Extended Project)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={issuing || availableBooks.length === 0 || !issueStudentId}
                    className="w-full rounded-lg bg-[#1E3A8A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#172554] disabled:opacity-60"
                  >
                    {issuing ? 'Recording Transaction...' : 'Issue Book'}
                  </button>
                </>
              )}
            </form>

            {/* Pending Reservations Queue */}
            <div className="xl:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
              <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Pending Student Reservations
                  </h2>
                  <p className="text-xs text-slate-500">
                    Approve to issue immediately at the circulation desk.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {pendingReservations.length} awaiting
                </span>
              </div>

              {pendingReservations.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-10 text-center">
                  <div>
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/60" aria-hidden="true" />
                    <p className="mt-2 text-sm font-medium text-slate-800">No pending requests</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Student book reservation holds will appear here for approval.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingReservations.map((res) => (
                    <div
                      key={res.id}
                      className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {res.book_title}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          {res.student_roll_no} · {res.student_name} ({res.student_department})
                        </div>
                        {res.notes && (
                          <div className="mt-1 text-xs text-slate-500 truncate">
                            Note: {res.notes}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onReservationAction(res.id, 'approve')}
                          className="rounded-lg bg-[#1E3A8A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#172554] whitespace-nowrap"
                        >
                          Approve & Issue
                        </button>
                        <button
                          type="button"
                          onClick={() => onReservationAction(res.id, 'cancel')}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Circulation Ledger Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Circulation & Return Ledger</h2>
                <p className="text-xs text-slate-500">
                  Live SQL records with automatic ₹5/day overdue fine calculation.
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start sm:self-auto">
                {(['all', 'active', 'overdue', 'returned'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setIssueFilter(status)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                      issueFilter === status
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {filteredIssues.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                No circulation records match the selected filter yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-4 py-3">Book Title</th>
                      <th className="px-4 py-3">Issued</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Fine</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredIssues.map((issue) => (
                      <tr key={issue.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-900">{issue.student_name}</div>
                          <div className="font-mono text-xs text-slate-500">
                            {issue.student_roll_no} · {issue.student_department}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{issue.book_title}</div>
                          <div className="text-xs text-slate-500">{issue.rack_location}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums">
                          {issue.issue_date}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-900 tabular-nums">
                          {issue.due_date}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium">
                          {issue.status === 'Overdue' && (
                            <span className="inline-flex items-center gap-1.5 text-red-700">
                              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                              Overdue ({issue.days_overdue}d)
                            </span>
                          )}
                          {issue.status === 'Issued' && (
                            <span className="text-[#1E3A8A]">Active Loan</span>
                          )}
                          {issue.status === 'Returned' && (
                            <span className="text-emerald-700">
                              Returned ({issue.return_date})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums">
                          <span className={issue.computed_fine > 0 ? 'text-red-600' : 'text-slate-700'}>
                            ₹{issue.computed_fine}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {issue.status !== 'Returned' ? (
                            <button
                              type="button"
                              onClick={() => onReturnBook(issue.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              Mark Returned
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Closed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BOOK INVENTORY MANAGEMENT */}
      {activeSection === 'inventory' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                placeholder="Filter inventory by title, ISBN, or department..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAddBookModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-medium text-white hover:bg-[#172554] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Textbook
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">ISBN & Title</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Rack Location</th>
                  <th className="px-4 py-3 text-right">Available / Total</th>
                  <th className="px-5 py-3 text-right">Inventory Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventory.map((book) => (
                  <tr key={book.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">{book.title}</div>
                      <div className="text-xs text-slate-500">
                        {book.author} · <span className="font-mono">{book.isbn}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-700">
                      {book.department}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {book.rack_location}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                      <span
                        className={`font-semibold ${
                          book.available_copies > 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {book.available_copies}
                      </span>
                      <span className="text-slate-400"> / {book.total_copies}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onUpdateBookCopies(book, book.total_copies + 1)}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                        >
                          +1 Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteBook(book.id)}
                          aria-label={`Delete ${book.title}`}
                          className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STUDENTS DIRECTORY */}
      {activeSection === 'students' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by Roll No, student name, or department..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAddStudentModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-medium text-white hover:bg-[#172554] whitespace-nowrap shrink-0"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Register Student
            </button>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                No registered students yet
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Students who sign up through the Student Portal will appear here automatically.
              </p>
              <button
                type="button"
                onClick={() => setShowAddStudentModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-medium text-white hover:bg-[#172554]"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Register First Student
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Roll Number</th>
                    <th className="px-4 py-3">Student Name & Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Department & Year</th>
                    <th className="px-4 py-3 text-right">Active Loans</th>
                    <th className="px-5 py-3 text-right">Accrued Fines</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#1E3A8A]">
                        {st.roll_no}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900">{st.name}</div>
                        <div className="text-xs text-slate-500">{st.email}</div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600 tabular-nums">
                        {st.phone}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        {st.department} · {st.year_sem}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-800 tabular-nums">
                        {st.active_issues ?? 0} / {st.max_books}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold tabular-nums">
                        <span className={(st.pending_fines ?? 0) > 0 ? 'text-red-600' : 'text-emerald-700'}>
                          ₹{st.pending_fines ?? 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LIVE SQL EXPLORER & PYTHON SOURCE EXPORT */}
      {activeSection === 'sql_python' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-6 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-[#1E3A8A]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  Live SQL Query Explorer
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500">svcet_library.db</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESET_SQL_QUERIES.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setSqlText(preset.sql);
                    handleExecuteSql(preset.sql);
                  }}
                  className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <textarea
              rows={5}
              value={sqlText}
              onChange={(e) => setSqlText(e.target.value)}
              spellCheck={false}
              className="w-full rounded-lg border border-slate-300 bg-slate-950 p-3.5 font-mono text-xs leading-relaxed text-emerald-300 focus:border-[#1E3A8A] focus:outline-none"
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Read-only SELECT / PRAGMA queries against live SQLite tables.
              </span>
              <button
                type="button"
                disabled={runningSql}
                onClick={() => handleExecuteSql()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-medium text-white hover:bg-[#172554] disabled:opacity-60 whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                {runningSql ? 'Executing...' : 'Run SQL Query'}
              </button>
            </div>

            {sqlError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                {sqlError}
              </div>
            )}

            {sqlResult && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600 tabular-nums">
                  <span>{sqlResult.rowCount} rows returned</span>
                  <span className="font-mono">{sqlResult.executionMs} ms</span>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-white font-mono text-slate-500">
                      <tr>
                        {sqlResult.columns.map((col) => (
                          <th key={col} className="px-3 py-2 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {sqlResult.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          {sqlResult.columns.map((col) => (
                            <td key={col} className="px-3 py-2 text-slate-800 whitespace-nowrap">
                              {row[col] === null ? 'NULL' : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="xl:col-span-6 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-[#1E3A8A]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  Python & SQL Source Package
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCode ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCode}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download {codeTab === 'python' ? '.py' : '.sql'}
                </button>
                <button
                  type="button"
                  disabled={downloadingZip}
                  onClick={handleDownloadZip}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#172554] disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloadingZip ? 'Preparing ZIP...' : 'GitHub Project (.zip)'}
                </button>
              </div>
            </div>

            {zipError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {zipError}
              </div>
            )}

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
              <button
                type="button"
                onClick={() => setCodeTab('python')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  codeTab === 'python'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                svcet_library.py (Python + sqlite3)
              </button>
              <button
                type="button"
                onClick={() => setCodeTab('schema')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  codeTab === 'schema'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                schema.sql
              </button>
            </div>

            <pre className="max-h-[420px] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
              {pythonExport
                ? codeTab === 'python'
                  ? pythonExport.pythonCode
                  : pythonExport.schemaSql
                : 'Loading Python & SQL source...'}
            </pre>
          </div>
        </div>
      )}

      {/* ADD BOOK MODAL */}
      {showAddBookModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-book-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 id="add-book-title" className="text-base font-semibold text-slate-900">
                Add New Textbook to SVCET Catalog
              </h3>
              <button
                type="button"
                onClick={() => setShowAddBookModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBook} className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700">Book Title</label>
                <input
                  type="text"
                  required
                  value={newBook.title}
                  onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                  placeholder="e.g., Compiler Design Principles"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">ISBN</label>
                <input
                  type="text"
                  required
                  value={newBook.isbn}
                  onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
                  placeholder="978-0321486813"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Author(s)</label>
                <input
                  type="text"
                  required
                  value={newBook.author}
                  onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                  placeholder="Alfred V. Aho"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Department</label>
                <select
                  value={newBook.department}
                  onChange={(e) =>
                    setNewBook({ ...newBook, department: e.target.value as Department })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Total Copies</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={newBook.total_copies}
                  onChange={(e) =>
                    setNewBook({ ...newBook, total_copies: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Rack Location</label>
                <input
                  type="text"
                  required
                  value={newBook.rack_location}
                  onChange={(e) => setNewBook({ ...newBook, rack_location: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Publisher</label>
                <input
                  type="text"
                  value={newBook.publisher}
                  onChange={(e) => setNewBook({ ...newBook, publisher: e.target.value })}
                  placeholder="Pearson Education"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBookModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-medium text-white hover:bg-[#172554]"
                >
                  Save Textbook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {showAddStudentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-student-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 id="add-student-title" className="text-base font-semibold text-slate-900">
                Register SVCET Student
              </h3>
              <button
                type="button"
                onClick={() => setShowAddStudentModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700">Roll Number</label>
                <input
                  type="text"
                  required
                  value={newStudent.roll_no}
                  onChange={(e) => setNewStudent({ ...newStudent, roll_no: e.target.value })}
                  placeholder="23781A0501"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  placeholder="Student full name"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Department</label>
                  <select
                    value={newStudent.department}
                    onChange={(e) =>
                      setNewStudent({ ...newStudent, department: e.target.value as Department })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Year & Sem</label>
                  <input
                    type="text"
                    required
                    value={newStudent.year_sem}
                    onChange={(e) => setNewStudent({ ...newStudent, year_sem: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">College Email</label>
                <input
                  type="email"
                  required
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  placeholder="student@svcet.edu.in"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Phone</label>
                  <input
                    type="tel"
                    required
                    value={newStudent.phone}
                    onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Initial Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newStudent.password}
                    onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                    placeholder="Min. 6 chars"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-medium text-white hover:bg-[#172554]"
                >
                  Register Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
