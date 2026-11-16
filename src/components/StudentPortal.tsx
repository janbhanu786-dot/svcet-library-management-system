import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  LogOut,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import type { Book, BookIssue, Department, Reservation, Student } from '../types/library';
import { BookCover } from './BookCover';

const DEPARTMENTS: ('ALL' | Department)[] = [
  'ALL',
  'CSE',
  'AI & DS',
  'ECE',
  'EEE',
  'MECH',
  'CIVIL',
  'MBA',
];

export type StudentSection = 'catalog' | 'borrowings' | 'reservations';

interface StudentPortalProps {
  activeSection: StudentSection;
  onSectionChange: (section: StudentSection) => void;
  books: Book[];
  activeStudent: Student | null;
  onLogout: () => void;
  onRequestLogin: () => void;
  issues: BookIssue[];
  reservations: Reservation[];
  onReserveBook: (bookId: number, notes: string) => Promise<void>;
  onCancelReservation: (reservationId: number) => Promise<void>;
  isLoading: boolean;
}

export function StudentPortal({
  activeSection,
  onSectionChange,
  books,
  activeStudent,
  onLogout,
  onRequestLogin,
  issues,
  reservations,
  onReserveBook,
  onCancelReservation,
  isLoading,
}: StudentPortalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<'ALL' | Department>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'out'>('all');
  const [reserveModalBook, setReserveModalBook] = useState<Book | null>(null);
  const [reserveNotes, setReserveNotes] = useState('');
  const [submittingReserve, setSubmittingReserve] = useState(false);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((book) => {
      if (departmentFilter !== 'ALL' && book.department !== departmentFilter) return false;
      if (availabilityFilter === 'available' && book.available_copies <= 0) return false;
      if (availabilityFilter === 'out' && book.available_copies > 0) return false;
      if (!q) return true;
      return (
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.isbn.toLowerCase().includes(q) ||
        book.rack_location.toLowerCase().includes(q)
      );
    });
  }, [books, searchQuery, departmentFilter, availabilityFilter]);

  const myIssues = useMemo(
    () => (activeStudent ? issues.filter((i) => i.student_id === activeStudent.id) : []),
    [issues, activeStudent]
  );

  const myActiveIssues = useMemo(
    () => myIssues.filter((i) => i.status !== 'Returned'),
    [myIssues]
  );

  const myReturnedIssues = useMemo(
    () => myIssues.filter((i) => i.status === 'Returned'),
    [myIssues]
  );

  const myReservations = useMemo(
    () => (activeStudent ? reservations.filter((r) => r.student_id === activeStudent.id) : []),
    [reservations, activeStudent]
  );

  const totalPendingFine = useMemo(
    () => myActiveIssues.reduce((sum, item) => sum + item.computed_fine, 0),
    [myActiveIssues]
  );

  const handleConfirmReserve = async () => {
    if (!reserveModalBook) return;
    setSubmittingReserve(true);
    try {
      await onReserveBook(reserveModalBook.id, reserveNotes);
      setReserveModalBook(null);
      setReserveNotes('');
    } finally {
      setSubmittingReserve(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Student Identity & Sub-navigation Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit overflow-x-auto">
          <button
            type="button"
            onClick={() => onSectionChange('catalog')}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'catalog'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Available Books ({books.filter((b) => b.available_copies > 0).length})
          </button>
          {activeStudent && (
            <>
              <button
                type="button"
                onClick={() => onSectionChange('borrowings')}
                className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeSection === 'borrowings'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Borrowings ({myActiveIssues.length})
              </button>
              <button
                type="button"
                onClick={() => onSectionChange('reservations')}
                className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeSection === 'reservations'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Reservations ({myReservations.filter((r) => r.status === 'Pending').length})
              </button>
            </>
          )}
        </div>

        {activeStudent ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-xs text-slate-600 tabular-nums">
              <span className="font-semibold text-slate-900">{activeStudent.name}</span>
              <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
              <span className="font-mono text-[#1E3A8A]">{activeStudent.roll_no}</span>
              <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
              <span>{activeStudent.department}</span>
              <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
              <span>
                Quota <strong className="text-slate-900">{myActiveIssues.length}/{activeStudent.max_books}</strong>
              </span>
              <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
              <span>
                Fine{' '}
                <strong className={totalPendingFine > 0 ? 'text-red-600' : 'text-emerald-700'}>
                  ₹{totalPendingFine}
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Sign in or create a student account to reserve books
            </span>
            <button
              type="button"
              onClick={onRequestLogin}
              className="rounded-lg bg-[#1E3A8A] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#172554] whitespace-nowrap shrink-0"
            >
              Student Login / Sign Up
            </button>
          </div>
        )}
      </div>

      {/* SECTION 1: AVAILABLE BOOKS CATALOG */}
      {activeSection === 'catalog' && (
        <section id="available-books" className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 max-w-xl">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by book title, author, ISBN, or rack location..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
                />
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start md:self-auto">
                {(['all', 'available', 'out'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setAvailabilityFilter(status)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      availabilityFilter === status
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {status === 'all' ? 'All Titles' : status === 'available' ? 'Available Now' : 'Checked Out'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {DEPARTMENTS.map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setDepartmentFilter(dept)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    departmentFilter === dept
                      ? 'bg-[#1E3A8A] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {dept === 'ALL' ? 'All Departments' : dept}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white p-4"
                />
              ))}
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <BookOpen className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-slate-900">
                No matching books found
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Try clearing your department filter or searching with a different keyword or ISBN.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDepartmentFilter('ALL');
                  setAvailabilityFilter('all');
                }}
                className="mt-4 rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-medium text-white hover:bg-[#172554]"
              >
                Reset Catalog Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredBooks.map((book) => {
                const isAvailable = book.available_copies > 0;
                const alreadyBorrowed = myActiveIssues.some((i) => i.book_id === book.id);
                const alreadyReserved = myReservations.some(
                  (r) => r.book_id === book.id && r.status === 'Pending'
                );

                return (
                  <article
                    key={book.id}
                    className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
                  >
                    <BookCover
                      title={book.title}
                      department={book.department}
                      variant={book.cover_variant}
                      className="h-40 w-28 shrink-0"
                    />

                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">{book.department}</span>
                          <span aria-hidden="true">·</span>
                          <span>{book.edition}</span>
                        </div>

                        <h3 className="mt-1 text-base font-semibold leading-snug text-slate-900 line-clamp-2">
                          {book.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-600 truncate">
                          {book.author}
                        </p>

                        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                          <span className="truncate">{book.rack_location}</span>
                        </div>
                        <div className="mt-1 text-[11px] font-mono text-slate-400 tabular-nums">
                          ISBN {book.isbn}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium tabular-nums">
                          {isAvailable ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                              <span className="text-emerald-700">
                                {book.available_copies}/{book.total_copies} Available
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" aria-hidden="true" />
                              <span className="text-red-700">0/{book.total_copies} Out</span>
                            </>
                          )}
                        </div>

                        {alreadyBorrowed ? (
                          <span className="text-xs font-medium text-[#1E3A8A] whitespace-nowrap">
                            Issued to you
                          </span>
                        ) : alreadyReserved ? (
                          <span className="text-xs font-medium text-amber-700 whitespace-nowrap">
                            Hold Pending
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => {
                              if (!activeStudent) {
                                onRequestLogin();
                                return;
                              }
                              setReserveModalBook(book);
                            }}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                              isAvailable
                                ? 'bg-[#1E3A8A] text-white hover:bg-[#172554]'
                                : 'cursor-not-allowed bg-slate-100 text-slate-400'
                            }`}
                          >
                            {activeStudent ? 'Reserve Copy' : 'Sign In to Reserve'}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SECTION 2: MY BORROWINGS & FINES */}
      {activeSection === 'borrowings' && activeStudent && (
        <section id="my-borrowings" className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Active Borrowed Books
                </h2>
                <p className="text-xs text-slate-500">
                  Standard lending period is 14 days. Overdue fine is ₹5 per day.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {myActiveIssues.length} active
              </span>
            </div>

            {myActiveIssues.length === 0 ? (
              <div className="p-10 text-center">
                <CalendarClock className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-slate-800">
                  No books currently borrowed
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Explore the Available Books catalog to reserve a textbook for pickup.
                </p>
                <button
                  type="button"
                  onClick={() => onSectionChange('catalog')}
                  className="mt-4 rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-medium text-white hover:bg-[#172554]"
                >
                  Browse Catalog
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Book Title & Rack</th>
                      <th className="px-4 py-3">Issued On</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Accrued Fine</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myActiveIssues.map((issue) => (
                      <tr key={issue.id} className="hover:bg-slate-50/80">
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-900">{issue.book_title}</div>
                          <div className="text-xs text-slate-500">
                            {issue.book_department} · {issue.rack_location}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-600 tabular-nums">
                          {issue.issue_date}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-900 tabular-nums">
                          {issue.due_date}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-medium">
                          {issue.status === 'Overdue' ? (
                            <span className="inline-flex items-center gap-1.5 text-red-700">
                              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                              Overdue ({issue.days_overdue}d)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              On Time
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold tabular-nums">
                          <span className={issue.computed_fine > 0 ? 'text-red-600' : 'text-slate-700'}>
                            ₹{issue.computed_fine}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {myReturnedIssues.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-3.5">
                <h3 className="text-sm font-semibold text-slate-900">Return History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5">Book Title</th>
                      <th className="px-4 py-2.5">Issued</th>
                      <th className="px-4 py-2.5">Returned</th>
                      <th className="px-5 py-2.5 text-right">Fine Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myReturnedIssues.map((issue) => (
                      <tr key={issue.id}>
                        <td className="px-5 py-3 font-medium text-slate-800">{issue.book_title}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums">
                          {issue.issue_date}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums">
                          {issue.return_date}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                          ₹{issue.fine_amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* SECTION 3: STUDENT RESERVATIONS */}
      {activeSection === 'reservations' && activeStudent && (
        <section id="my-reservations" className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Book Pickup Reservations</h2>
              <p className="text-xs text-slate-500">
                Pending holds are reviewed by the SVCET College Library circulation desk.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {myReservations.length} total
            </span>
          </div>

          {myReservations.length === 0 ? (
            <div className="p-10 text-center">
              <BookmarkCheck className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-slate-800">No reservations yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Reserve any available book from the catalog to hold it for counter pickup.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Book Title</th>
                    <th className="px-4 py-3">Requested</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myReservations.map((res) => (
                    <tr key={res.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900">{res.book_title}</div>
                        <div className="text-xs text-slate-500">
                          {res.book_department} · {res.rack_location}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600 tabular-nums">
                        {res.requested_at}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 max-w-xs truncate">
                        {res.notes || 'Standard counter pickup'}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium">
                        {res.status === 'Pending' && (
                          <span className="text-amber-700">Pending Desk Approval</span>
                        )}
                        {res.status === 'Fulfilled' && (
                          <span className="text-emerald-700">Issued & Fulfilled</span>
                        )}
                        {res.status === 'Cancelled' && (
                          <span className="text-slate-500">Cancelled</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {res.status === 'Pending' ? (
                          <button
                            type="button"
                            onClick={() => onCancelReservation(res.id)}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                          >
                            Cancel Hold
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Reserve Book Modal */}
      {reserveModalBook && activeStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reserve-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="reserve-modal-title" className="text-base font-semibold text-slate-900">
                  Reserve Copy for Pickup
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Requesting as {activeStudent.name} ({activeStudent.roll_no})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReserveModalBook(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-sm font-semibold text-slate-900">{reserveModalBook.title}</div>
              <div className="mt-1 text-xs text-slate-600">
                {reserveModalBook.author} · {reserveModalBook.rack_location}
              </div>
              <div className="mt-1.5 text-xs font-medium text-emerald-700 tabular-nums">
                {reserveModalBook.available_copies} copies currently on shelf
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="reserve-note" className="block text-xs font-medium text-slate-700">
                Pickup Note (Optional)
              </label>
              <textarea
                id="reserve-note"
                rows={2}
                value={reserveNotes}
                onChange={(e) => setReserveNotes(e.target.value)}
                placeholder="e.g., Collecting after afternoon lab at 3:30 PM"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setReserveModalBook(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingReserve}
                onClick={handleConfirmReserve}
                className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-medium text-white hover:bg-[#172554] disabled:opacity-60"
              >
                {submittingReserve ? 'Submitting...' : 'Confirm Reservation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
