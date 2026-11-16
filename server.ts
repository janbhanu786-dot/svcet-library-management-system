import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import JSZip from 'jszip';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, FINE_PER_DAY_INR, initDatabase } from './src/db/database.ts';
import { PYTHON_BACKEND_CODE, SCHEMA_SQL } from './src/db/pythonExport.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

initDatabase();

const app = express();
app.use(express.json());

const ADMIN_USERNAME = 'shaik kousar bhanu';
const ADMIN_PASSWORD = process.env.ADMIN_LIBRARY_PASSWORD || 'KousarBhanu@31';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const keyBuf = Buffer.from(key, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function computeOverdueDays(dueDateStr: string, returnDateStr: string | null): number {
  const refDate = returnDateStr ? new Date(returnDateStr) : new Date(todayISO());
  const dueDate = new Date(dueDateStr);
  const diffMs = refDate.getTime() - dueDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

// Admin Login
app.post('/api/auth/admin/login', (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.json({
      authenticated: true,
      admin: {
        name: 'Shaik Kousar Bhanu',
        role: 'Library Administrator',
      },
    });
    return;
  }

  res.status(401).json({
    error: 'Invalid Admin name or password. Please verify your SVCET Librarian credentials.',
  });
});

// Student Sign Up
app.post('/api/auth/student/signup', (req, res) => {
  try {
    const rollNo = String(req.body.roll_no || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();
    const department = String(req.body.department || '').trim();
    const yearSem = String(req.body.year_sem || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');

    if (!rollNo || !name || !department || !yearSem || !email || !phone || !password) {
      res.status(400).json({ error: 'All student registration fields are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const passwordHash = hashPassword(password);

    const info = db
      .prepare(`
        INSERT INTO students (roll_no, name, department, year_sem, email, phone, password_hash, max_books, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 4, 'Active')
      `)
      .run(rollNo, name, department, yearSem, email, phone, passwordHash);

    const student = db
      .prepare(
        `SELECT id, roll_no, name, department, year_sem, email, phone, max_books, status, created_at
         FROM students WHERE id = ?`
      )
      .get(info.lastInsertRowid) as Record<string, unknown>;

    res.status(201).json({
      student: { ...student, active_issues: 0, pending_fines: 0 },
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('UNIQUE')) {
      res.status(409).json({
        error: 'A student account with this Roll Number or Email already exists. Please sign in.',
      });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

// Student Login (Roll Number or Email + Password)
app.post('/api/auth/student/login', (req, res) => {
  try {
    const identifier = String(req.body.identifier || '').trim();
    const password = String(req.body.password || '');

    if (!identifier || !password) {
      res.status(400).json({ error: 'Roll Number / Email and password are required.' });
      return;
    }

    const row = db
      .prepare(
        `SELECT * FROM students
         WHERE UPPER(roll_no) = UPPER(?) OR LOWER(email) = LOWER(?)`
      )
      .get(identifier, identifier) as Record<string, unknown> | undefined;

    if (!row || !verifyPassword(password, String(row.password_hash || ''))) {
      res.status(401).json({ error: 'Invalid Roll Number / Email or password.' });
      return;
    }

    if (row.status !== 'Active') {
      res.status(403).json({ error: 'Your library account is currently suspended. Contact Admin.' });
      return;
    }

    const { password_hash: _removed, ...safeStudent } = row;
    res.json({ student: safeStudent });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Library summary overview
app.get('/api/overview', (_req, res) => {
  try {
    const bookStats = db
      .prepare(
        `SELECT COUNT(*) AS totalTitles,
                COALESCE(SUM(total_copies), 0) AS totalCopies,
                COALESCE(SUM(available_copies), 0) AS availableCopies
         FROM books`
      )
      .get() as { totalTitles: number; totalCopies: number; availableCopies: number };

    const activeIssues = db
      .prepare(`SELECT id, due_date FROM issues WHERE status != 'Returned'`)
      .all() as { id: number; due_date: string }[];

    let overdueCount = 0;
    for (const issue of activeIssues) {
      if (computeOverdueDays(issue.due_date, null) > 0) {
        overdueCount += 1;
      }
    }

    const pendingRes = db
      .prepare(`SELECT COUNT(*) AS cnt FROM reservations WHERE status = 'Pending'`)
      .get() as { cnt: number };

    const studentCount = db
      .prepare(`SELECT COUNT(*) AS cnt FROM students`)
      .get() as { cnt: number };

    const finesCollected = db
      .prepare(`SELECT COALESCE(SUM(fine_amount), 0) AS total FROM issues WHERE status = 'Returned'`)
      .get() as { total: number };

    const departmentCounts = db
      .prepare(
        `SELECT department, COUNT(*) AS titles, COALESCE(SUM(available_copies), 0) AS available
         FROM books
         GROUP BY department
         ORDER BY department ASC`
      )
      .all();

    res.json({
      totalTitles: bookStats.totalTitles,
      totalCopies: bookStats.totalCopies,
      availableCopies: bookStats.availableCopies,
      issuedActiveCount: activeIssues.length,
      overdueCount,
      pendingReservations: pendingRes.cnt,
      totalStudents: studentCount.cnt,
      totalFinesCollected: finesCollected.total,
      departmentCounts,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// List books with search, department, and availability filters
app.get('/api/books', (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const department = String(req.query.department || 'ALL');
    const availability = String(req.query.availability || 'all');

    let sql = `SELECT * FROM books WHERE 1=1`;
    const params: unknown[] = [];

    if (department && department !== 'ALL') {
      sql += ` AND department = ?`;
      params.push(department);
    }
    if (availability === 'available') {
      sql += ` AND available_copies > 0`;
    } else if (availability === 'out') {
      sql += ` AND available_copies = 0`;
    }
    if (search) {
      sql += ` AND (title LIKE ? OR author LIKE ? OR isbn LIKE ? OR rack_location LIKE ?)`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    sql += ` ORDER BY department ASC, title ASC`;
    const books = db.prepare(sql).all(...params);
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Admin: Add new book
app.post('/api/books', (req, res) => {
  try {
    const {
      isbn,
      title,
      author,
      publisher,
      department,
      edition,
      rack_location,
      total_copies,
      cover_variant,
      description,
    } = req.body;

    if (!isbn || !title || !author || !department || !rack_location) {
      res.status(400).json({ error: 'ISBN, title, author, department, and rack location are required.' });
      return;
    }

    const total = Math.max(1, Number(total_copies) || 1);
    const stmt = db.prepare(`
      INSERT INTO books (isbn, title, author, publisher, department, edition, rack_location, total_copies, available_copies, cover_variant, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      String(isbn).trim(),
      String(title).trim(),
      String(author).trim(),
      String(publisher || 'Academic Press').trim(),
      String(department).trim(),
      String(edition || '1st Edition').trim(),
      String(rack_location).trim(),
      total,
      total,
      String(cover_variant || 'cs'),
      String(description || '').trim()
    );

    const created = db.prepare('SELECT * FROM books WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('UNIQUE')) {
      res.status(409).json({ error: 'A book with this ISBN already exists in the catalog.' });
      return;
    }
    res.status(500).json({ error: message });
  }
});

// Admin: Update book
app.put('/api/books/:id', (req, res) => {
  try {
    const bookId = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as
      | { total_copies: number; available_copies: number }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }

    const { title, author, publisher, department, edition, rack_location, total_copies, description } = req.body;
    const issuedCount = existing.total_copies - existing.available_copies;
    const nextTotal = Math.max(issuedCount, Number(total_copies) || existing.total_copies);
    const nextAvailable = nextTotal - issuedCount;

    db.prepare(`
      UPDATE books
      SET title = ?, author = ?, publisher = ?, department = ?, edition = ?, rack_location = ?, total_copies = ?, available_copies = ?, description = ?
      WHERE id = ?
    `).run(title, author, publisher, department, edition, rack_location, nextTotal, nextAvailable, description || '', bookId);

    const updated = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Admin: Delete book
app.delete('/api/books/:id', (req, res) => {
  try {
    const bookId = Number(req.params.id);
    const active = db
      .prepare(`SELECT COUNT(*) AS cnt FROM issues WHERE book_id = ? AND status != 'Returned'`)
      .get(bookId) as { cnt: number };

    if (active.cnt > 0) {
      res.status(400).json({ error: 'Cannot remove a book while copies are currently issued to students.' });
      return;
    }

    db.prepare('DELETE FROM issues WHERE book_id = ?').run(bookId);
    const result = db.prepare('DELETE FROM books WHERE id = ?').run(bookId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Students list (never expose password_hash)
app.get('/api/students', (_req, res) => {
  try {
    const students = db
      .prepare(
        `SELECT id, roll_no, name, department, year_sem, email, phone, max_books, status, created_at
         FROM students ORDER BY id DESC`
      )
      .all() as Array<Record<string, unknown>>;

    const activeIssues = db
      .prepare(`SELECT student_id, due_date FROM issues WHERE status != 'Returned'`)
      .all() as Array<{ student_id: number; due_date: string }>;

    const enriched = students.map((student) => {
      const sid = Number(student.id);
      const mine = activeIssues.filter((i) => i.student_id === sid);
      const pendingFines = mine.reduce(
        (sum, i) => sum + computeOverdueDays(i.due_date, null) * FINE_PER_DAY_INR,
        0
      );
      return {
        ...student,
        active_issues: mine.length,
        pending_fines: pendingFines,
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Admin: Register student
app.post('/api/students', (req, res) => {
  try {
    const { roll_no, name, department, year_sem, email, phone, password, max_books } = req.body;
    if (!roll_no || !name || !department || !year_sem || !email || !phone) {
      res.status(400).json({
        error: 'Roll number, full name, department, year/semester, email, and phone are required.',
      });
      return;
    }

    const rawPass = String(password || roll_no).trim();
    const passwordHash = hashPassword(rawPass);

    const info = db
      .prepare(`
        INSERT INTO students (roll_no, name, department, year_sem, email, phone, password_hash, max_books, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')
      `)
      .run(
        String(roll_no).trim().toUpperCase(),
        String(name).trim(),
        String(department).trim(),
        String(year_sem).trim(),
        String(email).trim().toLowerCase(),
        String(phone).trim(),
        passwordHash,
        Number(max_books) || 4
      );

    const created = db
      .prepare(
        `SELECT id, roll_no, name, department, year_sem, email, phone, max_books, status, created_at
         FROM students WHERE id = ?`
      )
      .get(info.lastInsertRowid) as Record<string, unknown>;
    res.status(201).json({ ...created, active_issues: 0, pending_fines: 0 });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('UNIQUE')) {
      res.status(409).json({ error: 'A student with this Roll Number or Email is already registered.' });
      return;
    }
    res.status(500).json({ error: message });
  }
});

// List circulation issues
app.get('/api/issues', (req, res) => {
  try {
    const studentId = req.query.studentId ? Number(req.query.studentId) : null;
    const statusFilter = String(req.query.status || 'all');

    let sql = `
      SELECT i.*,
             b.title AS book_title,
             b.isbn AS book_isbn,
             b.author AS book_author,
             b.department AS book_department,
             b.rack_location AS rack_location,
             s.name AS student_name,
             s.roll_no AS student_roll_no,
             s.department AS student_department
      FROM issues i
      JOIN books b ON b.id = i.book_id
      JOIN students s ON s.id = i.student_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (studentId) {
      sql += ` AND i.student_id = ?`;
      params.push(studentId);
    }

    sql += ` ORDER BY CASE WHEN i.status = 'Returned' THEN 1 ELSE 0 END ASC, i.id DESC`;

    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

    const enriched = rows
      .map((row) => {
        const isReturned = row.status === 'Returned';
        const daysOverdue = isReturned
          ? computeOverdueDays(String(row.due_date), row.return_date ? String(row.return_date) : null)
          : computeOverdueDays(String(row.due_date), null);
        const computedFine = isReturned ? Number(row.fine_amount) : daysOverdue * FINE_PER_DAY_INR;
        const effectiveStatus = isReturned ? 'Returned' : daysOverdue > 0 ? 'Overdue' : 'Issued';

        return {
          ...row,
          status: effectiveStatus,
          days_overdue: daysOverdue,
          computed_fine: computedFine,
        };
      })
      .filter((row) => {
        if (statusFilter === 'active') return row.status !== 'Returned';
        if (statusFilter === 'overdue') return row.status === 'Overdue';
        if (statusFilter === 'returned') return row.status === 'Returned';
        return true;
      });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Admin: Issue book to student (atomic SQL transaction)
app.post('/api/issues', (req, res) => {
  try {
    const bookId = Number(req.body.book_id);
    const studentId = Number(req.body.student_id);
    const loanDays = Math.min(30, Math.max(1, Number(req.body.days) || 14));
    const issuedBy = String(req.body.issued_by || 'Shaik Kousar Bhanu (Admin)');

    const performIssue = db.transaction(() => {
      const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as
        | { id: number; title: string; available_copies: number }
        | undefined;
      if (!book) throw new Error('Selected book not found.');
      if (book.available_copies <= 0) throw new Error(`No available copies left for "${book.title}".`);

      const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId) as
        | { id: number; name: string; status: string; max_books: number }
        | undefined;
      if (!student) throw new Error('Selected student not found.');
      if (student.status !== 'Active') throw new Error('Student library card is currently suspended.');

      const activeCount = db
        .prepare(`SELECT COUNT(*) AS cnt FROM issues WHERE student_id = ? AND status != 'Returned'`)
        .get(studentId) as { cnt: number };

      if (activeCount.cnt >= student.max_books) {
        throw new Error(`${student.name} already holds ${activeCount.cnt}/${student.max_books} maximum allowed books.`);
      }

      const duplicate = db
        .prepare(`SELECT id FROM issues WHERE book_id = ? AND student_id = ? AND status != 'Returned'`)
        .get(bookId, studentId);
      if (duplicate) {
        throw new Error(`${student.name} already has an active copy of "${book.title}".`);
      }

      db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(bookId);

      const info = db
        .prepare(`
          INSERT INTO issues (book_id, student_id, issue_date, due_date, fine_amount, status, issued_by)
          VALUES (?, ?, ?, ?, 0, 'Issued', ?)
        `)
        .run(bookId, studentId, todayISO(), addDaysISO(loanDays), issuedBy);

      db.prepare(
        `UPDATE reservations SET status = 'Fulfilled' WHERE book_id = ? AND student_id = ? AND status = 'Pending'`
      ).run(bookId, studentId);

      return info.lastInsertRowid;
    });

    const issueId = performIssue();
    res.status(201).json({ id: issueId, message: 'Book issued successfully.' });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Admin: Return book & compute overdue fine
app.post('/api/issues/:id/return', (req, res) => {
  try {
    const issueId = Number(req.params.id);

    const performReturn = db.transaction(() => {
      const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId) as
        | { id: number; book_id: number; due_date: string; status: string }
        | undefined;

      if (!issue) throw new Error('Issue record not found.');
      if (issue.status === 'Returned') throw new Error('This book has already been returned.');

      const overdueDays = computeOverdueDays(issue.due_date, null);
      const fineAmount = overdueDays * FINE_PER_DAY_INR;

      db.prepare(`
        UPDATE issues
        SET return_date = ?, fine_amount = ?, status = 'Returned'
        WHERE id = ?
      `).run(todayISO(), fineAmount, issueId);

      db.prepare('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?').run(issue.book_id);

      return { fineAmount, overdueDays };
    });

    const result = performReturn();
    res.json({ returned: true, ...result });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Reservations list
app.get('/api/reservations', (req, res) => {
  try {
    const studentId = req.query.studentId ? Number(req.query.studentId) : null;
    let sql = `
      SELECT r.*,
             b.title AS book_title,
             b.isbn AS book_isbn,
             b.author AS book_author,
             b.department AS book_department,
             b.available_copies AS available_copies,
             b.rack_location AS rack_location,
             s.name AS student_name,
             s.roll_no AS student_roll_no,
             s.department AS student_department
      FROM reservations r
      JOIN books b ON b.id = r.book_id
      JOIN students s ON s.id = r.student_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (studentId) {
      sql += ` AND r.student_id = ?`;
      params.push(studentId);
    }

    sql += ` ORDER BY CASE WHEN r.status = 'Pending' THEN 0 ELSE 1 END ASC, r.id DESC`;
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Student: Reserve / request a book
app.post('/api/reservations', (req, res) => {
  try {
    const bookId = Number(req.body.book_id);
    const studentId = Number(req.body.student_id);
    const notes = String(req.body.notes || '').trim();

    if (!studentId) {
      res.status(401).json({ error: 'Please sign in as a student before reserving a book.' });
      return;
    }

    const book = db.prepare('SELECT id, title FROM books WHERE id = ?').get(bookId) as
      | { id: number; title: string }
      | undefined;
    if (!book) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }

    const existingPending = db
      .prepare(`SELECT id FROM reservations WHERE book_id = ? AND student_id = ? AND status = 'Pending'`)
      .get(bookId, studentId);
    if (existingPending) {
      res.status(400).json({ error: `You already have a pending reservation for "${book.title}".` });
      return;
    }

    const info = db
      .prepare(`
        INSERT INTO reservations (book_id, student_id, requested_at, status, notes)
        VALUES (?, ?, ?, 'Pending', ?)
      `)
      .run(bookId, studentId, todayISO(), notes);

    res.status(201).json({ id: info.lastInsertRowid, message: 'Reservation submitted to SVCET Library desk.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Admin or Student: Approve (issues book immediately) or Cancel reservation
app.post('/api/reservations/:id/action', (req, res) => {
  try {
    const resId = Number(req.params.id);
    const action = String(req.body.action || '');

    const handleAction = db.transaction(() => {
      const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(resId) as
        | { id: number; book_id: number; student_id: number; status: string }
        | undefined;
      if (!reservation) throw new Error('Reservation not found.');
      if (reservation.status !== 'Pending') throw new Error('Reservation has already been processed.');

      if (action === 'cancel') {
        db.prepare(`UPDATE reservations SET status = 'Cancelled' WHERE id = ?`).run(resId);
        return { status: 'Cancelled' };
      }

      if (action === 'approve') {
        const book = db.prepare('SELECT * FROM books WHERE id = ?').get(reservation.book_id) as
          | { id: number; title: string; available_copies: number }
          | undefined;
        if (!book || book.available_copies <= 0) {
          throw new Error('Cannot approve reservation because no copies are currently available.');
        }

        const student = db.prepare('SELECT * FROM students WHERE id = ?').get(reservation.student_id) as
          | { id: number; name: string; max_books: number }
          | undefined;
        if (!student) throw new Error('Student not found.');

        const activeCount = db
          .prepare(`SELECT COUNT(*) AS cnt FROM issues WHERE student_id = ? AND status != 'Returned'`)
          .get(reservation.student_id) as { cnt: number };

        if (activeCount.cnt >= student.max_books) {
          throw new Error(`${student.name} has reached the maximum limit of ${student.max_books} active books.`);
        }

        db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(reservation.book_id);
        db.prepare(`
          INSERT INTO issues (book_id, student_id, issue_date, due_date, fine_amount, status, issued_by)
          VALUES (?, ?, ?, ?, 0, 'Issued', 'Shaik Kousar Bhanu (Admin)')
        `).run(reservation.book_id, reservation.student_id, todayISO(), addDaysISO(14));

        db.prepare(`UPDATE reservations SET status = 'Fulfilled' WHERE id = ?`).run(resId);
        return { status: 'Fulfilled' };
      }

      throw new Error('Invalid reservation action.');
    });

    const result = handleAction();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Admin: Read-only SQL Query Console against svcet_library.db
app.post('/api/sql/query', (req, res) => {
  try {
    const rawSql = String(req.body.sql || '').trim();
    if (!rawSql) {
      res.status(400).json({ error: 'SQL query cannot be empty.' });
      return;
    }

    const normalized = rawSql.toUpperCase();
    const isAllowed =
      normalized.startsWith('SELECT') ||
      normalized.startsWith('PRAGMA') ||
      normalized.startsWith('WITH') ||
      normalized.startsWith('EXPLAIN');

    const forbidden = /\b(DROP|DELETE|UPDATE|INSERT|ALTER|ATTACH|DETACH|VACUUM|REPLACE|CREATE)\b/i;
    if (!isAllowed || forbidden.test(rawSql)) {
      res.status(403).json({
        error: 'SQL Explorer permits read-only SELECT, WITH, or PRAGMA inspection queries.',
      });
      return;
    }

    const started = performance.now();
    const stmt = db.prepare(rawSql);
    const rows = stmt.all() as Record<string, unknown>[];
    const executionMs = Number((performance.now() - started).toFixed(2));
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    res.json({
      columns,
      rows: rows.slice(0, 100),
      rowCount: rows.length,
      executionMs,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Python & SQL Source Export
app.get('/api/python-export', (_req, res) => {
  res.json({
    schemaSql: SCHEMA_SQL,
    pythonCode: PYTHON_BACKEND_CODE,
    databaseFile: 'svcet_library.db',
  });
});

// Project Source Archive Export
app.get('/api/export/github-zip', async (_req, res) => {
  try {
    const zip = new JSZip();
    const ROOT_PREFIX = 'svcet-college-library';

    const assetRenameMap: Record<string, string> = {
      'svcet-logo.jpg': 'svcet-logo.jpg',
      'library-hall.jpg': 'library-hall.jpg',
      'cover-cs.jpg': 'cover-cs.jpg',
      'cover-ece.jpg': 'cover-ece.jpg',
    };

    const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.md', '.json', '.sql', '.py']);

    const ignoredDirs = new Set(['node_modules', 'dist', '__pycache__']);
    const ignoredFiles = new Set([
      'metadata.json',
      'package.json',
      'package-lock.json',
      'bun.lock',
      'svcet_college_logo_1794819278971.jpg',
      'svcet_library.db',
      'svcet_library.db-wal',
      'svcet_library.db-shm',
      'svcet-college-library.zip',
    ]);

    const addDirectoryToZip = (dirPath: string, relBase: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') || ignoredDirs.has(entry.name)) continue;
          addDirectoryToZip(path.join(dirPath, entry.name), path.posix.join(relBase, entry.name));
        } else {
          if (ignoredFiles.has(entry.name) || entry.name.endsWith('.zip') || entry.name.endsWith('.db')) {
            continue;
          }
          const fullPath = path.join(dirPath, entry.name);
          const cleanName = assetRenameMap[entry.name] || entry.name;
          const zipRelPath = relBase
            ? path.posix.join(ROOT_PREFIX, relBase, cleanName)
            : path.posix.join(ROOT_PREFIX, cleanName);

          const ext = path.extname(entry.name).toLowerCase();
          if (textExtensions.has(ext)) {
            let content = fs.readFileSync(fullPath, 'utf8');
            for (const [oldAsset, newAsset] of Object.entries(assetRenameMap)) {
              content = content.split(oldAsset).join(newAsset);
            }
            zip.file(zipRelPath, content, { createFolders: false });
          } else {
            zip.file(zipRelPath, fs.readFileSync(fullPath), { createFolders: false });
          }
        }
      }
    };

    addDirectoryToZip(process.cwd(), '');

    // Sanitize package.json so no unused template dependencies or peer conflicts remain
    const rawPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    if (rawPkg.dependencies && rawPkg.dependencies['@google/genai']) {
      delete rawPkg.dependencies['@google/genai'];
    }
    if (rawPkg.devDependencies && rawPkg.devDependencies.esbuild) {
      delete rawPkg.devDependencies.esbuild;
    }
    rawPkg.name = 'svcet-college-library';
    zip.file(
      `${ROOT_PREFIX}/package.json`,
      JSON.stringify(rawPkg, null, 2) + '\n',
      { createFolders: false }
    );

    // Add standalone Python + SQL files directly in the repository root
    zip.file(`${ROOT_PREFIX}/svcet_library.py`, PYTHON_BACKEND_CODE, { createFolders: false });
    zip.file(`${ROOT_PREFIX}/schema.sql`, SCHEMA_SQL, { createFolders: false });
    zip.file(`${ROOT_PREFIX}/requirements.txt`, 'flask>=3.0.0\n', { createFolders: false });

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      platform: 'DOS',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="svcet-college-library.zip"');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end(buffer);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

async function startServer(): Promise<void> {
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist'));

  if (isProd) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SVCET College Library server running at http://localhost:${PORT}`);
  });
}

startServer();
