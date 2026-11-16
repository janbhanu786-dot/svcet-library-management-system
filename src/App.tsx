import { useCallback, useEffect, useState } from 'react';
import { BookOpen, GraduationCap, ShieldCheck } from 'lucide-react';
import { AdminLoginPanel } from './components/AdminLoginPanel';
import { AdminPortal, type AdminSection } from './components/AdminPortal';
import { StudentAuthPanel } from './components/StudentAuthPanel';
import { StudentPortal, type StudentSection } from './components/StudentPortal';
import type {
  Book,
  BookIssue,
  CoverVariant,
  Department,
  LibraryOverview,
  Reservation,
  SqlQueryResult,
  Student,
} from './types/library';

const SVCET_LOGO = '/src/assets/images/svcet-logo.jpg';
const HERO_BANNER = '/src/assets/images/library-hall.jpg';

type WorkspaceView = 'student_portal' | 'student_auth' | 'admin_portal';

export default function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>('student_auth');
  const [studentAuthTab, setStudentAuthTab] = useState<'login' | 'signup'>('login');

  const [loggedInStudent, setLoggedInStudent] = useState<Student | null>(null);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminName, setAdminName] = useState('');

  const [studentSection, setStudentSection] = useState<StudentSection>('catalog');
  const [adminSection, setAdminSection] = useState<AdminSection>('circulation');

  const [overview, setOverview] = useState<LibraryOverview | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [issues, setIssues] = useState<BookIssue[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [pythonExport, setPythonExport] = useState<{
    schemaSql: string;
    pythonCode: string;
    databaseFile: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [logoError, setLogoError] = useState(false);

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  }, []);

  const fetchAllData = useCallback(async () => {
    try {
      const [ovRes, booksRes, stuRes, issRes, resRes] = await Promise.all([
        fetch('/api/overview'),
        fetch('/api/books'),
        fetch('/api/students'),
        fetch('/api/issues'),
        fetch('/api/reservations'),
      ]);

      const [ovData, booksData, stuData, issData, resData] = await Promise.all([
        ovRes.json(),
        booksRes.json(),
        stuRes.json(),
        issRes.json(),
        resRes.json(),
      ]);

      setOverview(ovData);
      setBooks(booksData);
      setStudents(stuData);
      setIssues(issData);
      setReservations(resData);
    } catch {
      notify('error', 'Failed to synchronize with SVCET College Library SQL database.');
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchAllData();
    fetch('/api/python-export')
      .then((r) => r.json())
      .then(setPythonExport)
      .catch(() => null);
  }, [fetchAllData]);

  const syncedStudent = loggedInStudent
    ? students.find((s) => s.id === loggedInStudent.id) || loggedInStudent
    : null;

  const apiMutate = async (url: string, options: RequestInit, successMsg: string) => {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) {
      notify('error', data.error || 'Operation failed.');
      throw new Error(data.error || 'Operation failed.');
    }
    notify('success', successMsg);
    await fetchAllData();
    return data;
  };

  const handleReserveBook = async (bookId: number, notes: string) => {
    if (!syncedStudent) {
      setActiveView('student_auth');
      return;
    }
    await apiMutate(
      '/api/reservations',
      {
        method: 'POST',
        body: JSON.stringify({ book_id: bookId, student_id: syncedStudent.id, notes }),
      },
      'Book reservation submitted to the SVCET College Library desk.'
    );
  };

  const handleCancelReservation = async (reservationId: number) => {
    await apiMutate(
      `/api/reservations/${reservationId}/action`,
      {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel' }),
      },
      'Reservation cancelled.'
    );
  };

  const handleAddBook = async (payload: {
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
  }) => {
    await apiMutate(
      '/api/books',
      { method: 'POST', body: JSON.stringify(payload) },
      `Added "${payload.title}" to SVCET Library catalog.`
    );
  };

  const handleUpdateBookCopies = async (book: Book, nextTotalCopies: number) => {
    await apiMutate(
      `/api/books/${book.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({ ...book, total_copies: nextTotalCopies }),
      },
      `Updated shelf copies for "${book.title}".`
    );
  };

  const handleDeleteBook = async (bookId: number) => {
    await apiMutate(`/api/books/${bookId}`, { method: 'DELETE' }, 'Book removed from catalog.');
  };

  const handleAddStudent = async (payload: {
    roll_no: string;
    name: string;
    department: Department;
    year_sem: string;
    email: string;
    phone: string;
    password: string;
    max_books: number;
  }) => {
    await apiMutate(
      '/api/students',
      { method: 'POST', body: JSON.stringify(payload) },
      `Registered student ${payload.roll_no.toUpperCase()}.`
    );
  };

  const handleIssueBook = async (bookId: number, studentId: number, days: number) => {
    await apiMutate(
      '/api/issues',
      {
        method: 'POST',
        body: JSON.stringify({
          book_id: bookId,
          student_id: studentId,
          days,
          issued_by: `${adminName || 'Shaik Kousar Bhanu'} (Admin)`,
        }),
      },
      'Book issued and shelf inventory updated.'
    );
  };

  const handleReturnBook = async (issueId: number) => {
    const res = await apiMutate(
      `/api/issues/${issueId}/return`,
      { method: 'POST' },
      'Book marked as returned and copy restored to shelf.'
    );
    if (res.fineAmount > 0) {
      notify('success', `Returned with ₹${res.fineAmount} overdue fine (${res.overdueDays} days late).`);
    }
  };

  const handleReservationAction = async (reservationId: number, action: 'approve' | 'cancel') => {
    await apiMutate(
      `/api/reservations/${reservationId}/action`,
      { method: 'POST', body: JSON.stringify({ action }) },
      action === 'approve' ? 'Reservation approved and book issued.' : 'Reservation declined.'
    );
  };

  const handleRunSql = async (sql: string): Promise<SqlQueryResult> => {
    const res = await fetch('/api/sql/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'SQL query error.');
    }
    return data as SqlQueryResult;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      {/* Strictly 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6 lg:px-8">
          {/* Zone 1: Single-line Brand Wordmark + SVCET Chittoor Seal */}
          <a
            href="#top"
            className="flex items-center gap-3 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            {!logoError ? (
              <img
                src={SVCET_LOGO}
                alt="SVCET College Chittoor Crest"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="h-9 w-9 rounded-full object-contain bg-white border border-slate-200 p-0.5 shrink-0"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E3A8A] text-xs font-bold text-white shrink-0">
                SV
              </span>
            )}
            <span>SVCET College Library</span>
          </a>

          {/* Zone 2: Concise Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {activeView === 'admin_portal' && adminAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => setAdminSection('circulation')}
                  className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 ${
                    adminSection === 'circulation' ? 'text-[#1E3A8A] font-semibold' : ''
                  }`}
                >
                  Circulation
                </button>
                <button
                  type="button"
                  onClick={() => setAdminSection('inventory')}
                  className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 ${
                    adminSection === 'inventory' ? 'text-[#1E3A8A] font-semibold' : ''
                  }`}
                >
                  Book Catalog
                </button>
                <button
                  type="button"
                  onClick={() => setAdminSection('students')}
                  className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 ${
                    adminSection === 'students' ? 'text-[#1E3A8A] font-semibold' : ''
                  }`}
                >
                  Students
                </button>
                <button
                  type="button"
                  onClick={() => setAdminSection('sql_python')}
                  className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 ${
                    adminSection === 'sql_python' ? 'text-[#1E3A8A] font-semibold' : ''
                  }`}
                >
                  SQL & Python
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('student_portal');
                    setStudentSection('catalog');
                  }}
                  className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 ${
                    activeView === 'student_portal' && studentSection === 'catalog'
                      ? 'text-[#1E3A8A] font-semibold'
                      : ''
                  }`}
                >
                  Available Books
                </button>
                {syncedStudent ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveView('student_portal');
                        setStudentSection('borrowings');
                      }}
                      className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 ${
                        activeView === 'student_portal' && studentSection === 'borrowings'
                          ? 'text-[#1E3A8A] font-semibold'
                          : ''
                      }`}
                    >
                      My Borrowings
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveView('student_portal');
                        setStudentSection('reservations');
                      }}
                      className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 ${
                        activeView === 'student_portal' && studentSection === 'reservations'
                          ? 'text-[#1E3A8A] font-semibold'
                          : ''
                      }`}
                    >
                      Reservations
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setStudentAuthTab('login');
                      setActiveView('student_auth');
                    }}
                    className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 ${
                      activeView === 'student_auth' ? 'text-[#1E3A8A] font-semibold' : ''
                    }`}
                  >
                    Student Login
                  </button>
                )}
              </>
            )}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            {activeView === 'admin_portal' ? (
              <button
                type="button"
                onClick={() =>
                  setActiveView(syncedStudent ? 'student_portal' : 'student_auth')
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Student Interface
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveView('admin_portal')}
                className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#172554] whitespace-nowrap shrink-0"
              >
                Admin Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Institutional Banner with Exact SVCET Chittoor Logo */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
          <img
            src={HERO_BANNER}
            alt="SVCET College Chittoor Library Reading Hall"
            referrerPolicy="no-referrer"
            className="h-52 w-full object-cover sm:h-56"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-950/78 to-slate-950/45" />

          <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 lg:flex-row lg:items-end">
            <div className="flex items-start gap-4 sm:items-center">
              {!logoError && (
                <img
                  src={SVCET_LOGO}
                  alt="SVCET College Chittoor Logo"
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-full border-2 border-amber-300/60 bg-white p-1 shadow-md object-contain shrink-0 sm:h-20 sm:w-20"
                />
              )}
              <div className="max-w-2xl">
                <p className="text-xs font-medium text-amber-300">
                  Sri Venkateswara College of Engineering & Technology · Chittoor
                </p>
                <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-3xl text-balance">
                  SVCET College Library Management System
                </h1>
                <p className="mt-1.5 text-xs text-slate-200 sm:text-sm">
                  Unified SQL library portal with separate Student and Admin authentication, live available books catalog, and circulation tracking.
                </p>
              </div>
            </div>

            {overview && (
              <div className="mt-4 flex items-center gap-5 text-xs text-slate-200 tabular-nums lg:mt-0">
                <div>
                  <span className="block text-slate-400">Available Copies</span>
                  <span className="text-base font-semibold text-white">
                    {overview.availableCopies} / {overview.totalCopies}
                  </span>
                </div>
                <div className="h-7 w-px bg-white/20" aria-hidden="true" />
                <div>
                  <span className="block text-slate-400">Departments</span>
                  <span className="text-base font-semibold text-white">
                    {overview.departmentCounts.length} Branches
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Unified Interface Role & Workspace Switcher Toolbar */}
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium text-slate-900">Active Interface:</span>
            <span>
              {activeView === 'admin_portal'
                ? adminAuthenticated
                  ? `Admin Portal (${adminName})`
                  : 'Admin Login Interface'
                : syncedStudent
                ? `Student Portal (${syncedStudent.roll_no} · ${syncedStudent.name})`
                : activeView === 'student_auth'
                ? 'Student Login & Registration'
                : 'Available Books Catalog'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setActiveView('student_portal');
                setStudentSection('catalog');
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'student_portal'
                  ? 'bg-white text-[#1E3A8A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Available Books
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveView(syncedStudent ? 'student_portal' : 'student_auth')
              }
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'student_auth'
                  ? 'bg-white text-[#1E3A8A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
              {syncedStudent ? 'My Student Account' : 'Student Login / Sign Up'}
            </button>

            <button
              type="button"
              onClick={() => setActiveView('admin_portal')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'admin_portal'
                  ? 'bg-white text-[#1E3A8A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {adminAuthenticated ? 'Admin Portal' : 'Admin Login'}
            </button>
          </div>
        </section>

        {/* Workspace Content */}
        {activeView === 'student_auth' && !syncedStudent && (
          <StudentAuthPanel
            key={studentAuthTab}
            initialMode={studentAuthTab}
            onBrowseBooks={() => {
              setActiveView('student_portal');
              setStudentSection('catalog');
            }}
            onAuthenticated={async (student) => {
              setLoggedInStudent(student);
              setActiveView('student_portal');
              setStudentSection('catalog');
              notify('success', `Welcome, ${student.name} (${student.roll_no})`);
              await fetchAllData();
            }}
          />
        )}

        {(activeView === 'student_portal' || (activeView === 'student_auth' && syncedStudent)) && (
          <StudentPortal
            activeSection={studentSection}
            onSectionChange={setStudentSection}
            books={books}
            activeStudent={syncedStudent}
            onLogout={() => {
              setLoggedInStudent(null);
              setStudentSection('catalog');
              setActiveView('student_auth');
              notify('success', 'Signed out from Student Portal.');
            }}
            onRequestLogin={() => {
              setStudentAuthTab('login');
              setActiveView('student_auth');
            }}
            issues={issues}
            reservations={reservations}
            onReserveBook={handleReserveBook}
            onCancelReservation={handleCancelReservation}
            isLoading={isLoading}
          />
        )}

        {activeView === 'admin_portal' && !adminAuthenticated && (
          <AdminLoginPanel
            onSuccess={(name) => {
              setAdminName(name);
              setAdminAuthenticated(true);
              notify('success', `Welcome, ${name}`);
            }}
          />
        )}

        {activeView === 'admin_portal' && adminAuthenticated && (
          <AdminPortal
            activeSection={adminSection}
            onSectionChange={setAdminSection}
            librarianName={adminName}
            onLogout={() => {
              setAdminAuthenticated(false);
              setAdminName('');
              notify('success', 'Signed out from Admin Portal.');
            }}
            overview={overview}
            books={books}
            students={students}
            issues={issues}
            reservations={reservations}
            pythonExport={pythonExport}
            onAddBook={handleAddBook}
            onUpdateBookCopies={handleUpdateBookCopies}
            onDeleteBook={handleDeleteBook}
            onAddStudent={handleAddStudent}
            onIssueBook={handleIssueBook}
            onReturnBook={handleReturnBook}
            onReservationAction={handleReservationAction}
            onRunSql={handleRunSql}
          />
        )}
      </main>

      {/* Clean Institutional Footer */}
      <footer className="mt-10 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>
            SVCET College Library · Sri Venkateswara College of Engineering & Technology, Chittoor
          </span>
          <span>Library Hours: Mon–Sat, 8:30 AM – 7:30 PM · Late Return Fine ₹5/day</span>
        </div>
      </footer>

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border px-4 py-3 text-xs font-medium shadow-lg ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-white text-emerald-800'
              : 'border-red-200 bg-white text-red-700'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
