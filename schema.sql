-- SVCET College Library Management System (Chittoor)
-- Relational SQLite / PostgreSQL Compatible Schema

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  isbn TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  publisher TEXT NOT NULL,
  department TEXT NOT NULL,
  edition TEXT NOT NULL,
  rack_location TEXT NOT NULL,
  total_copies INTEGER NOT NULL CHECK (total_copies >= 0),
  available_copies INTEGER NOT NULL CHECK (available_copies >= 0),
  cover_variant TEXT NOT NULL DEFAULT 'cs',
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  year_sem TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  max_books INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  return_date TEXT,
  fine_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Issued' CHECK (status IN ('Issued', 'Returned', 'Overdue')),
  issued_by TEXT NOT NULL DEFAULT 'Shaik Kousar Bhanu (Admin)',
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  requested_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Cancelled', 'Fulfilled')),
  notes TEXT DEFAULT '',
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Useful Analytical Queries
SELECT department, COUNT(*) AS total_titles, SUM(available_copies) AS available_books
FROM books
GROUP BY department
ORDER BY available_books DESC;

SELECT s.roll_no, s.name, b.title, i.issue_date, i.due_date,
       MAX(0, CAST(julianday('now') - julianday(i.due_date) AS INTEGER)) * 5 AS live_fine_inr
FROM issues i
JOIN students s ON s.id = i.student_id
JOIN books b ON b.id = i.book_id
WHERE i.status != 'Returned';
