export const SCHEMA_SQL = `-- SVCET College Library Management System (Chittoor)
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
`;

export const PYTHON_BACKEND_CODE = `"""
SVCET College Library Management System (Chittoor)
Python + SQLite3 Backend Reference Implementation
Connects directly to the exact same svcet_library.db schema.
Run: pip install flask && python svcet_library.py
"""

import hashlib
import sqlite3
from datetime import date, timedelta
from flask import Flask, jsonify, request

DB_PATH = "svcet_library.db"
FINE_PER_DAY = 5

app = Flask(__name__)


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@app.post("/api/auth/student/signup")
def student_signup():
    data = request.get_json(force=True)
    pwd_hash = hashlib.sha256(data["password"].encode()).hexdigest()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO students (roll_no, name, department, year_sem, email, phone, password_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data["roll_no"].strip().upper(),
                data["name"].strip(),
                data["department"].strip(),
                data["year_sem"].strip(),
                data["email"].strip().lower(),
                data["phone"].strip(),
                pwd_hash,
            ),
        )
        conn.commit()
    return jsonify({"message": "Student registered successfully"}), 201


@app.get("/api/books")
def list_available_books():
    dept = request.args.get("department", "ALL")
    query = request.args.get("search", "").strip()
    sql = "SELECT * FROM books WHERE 1=1"
    params = []

    if dept != "ALL":
        sql += " AND department = ?"
        params.append(dept)
    if query:
        sql += " AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)"
        like = f"%{query}%"
        params.extend([like, like, like])

    sql += " ORDER BY department, title"
    with get_connection() as conn:
        rows = conn.execute(sql, params).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/issues")
def issue_book():
    payload = request.get_json(force=True)
    book_id = payload["book_id"]
    student_id = payload["student_id"]
    days = int(payload.get("days", 14))

    with get_connection() as conn:
        book = conn.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
        if not book or book["available_copies"] <= 0:
            return jsonify({"error": "Book unavailable"}), 400

        student = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
        if not student or student["status"] != "Active":
            return jsonify({"error": "Student account is not active"}), 400

        active_count = conn.execute(
            "SELECT COUNT(*) AS cnt FROM issues WHERE student_id = ? AND status != 'Returned'",
            (student_id,),
        ).fetchone()["cnt"]
        if active_count >= student["max_books"]:
            return jsonify({"error": "Maximum borrowing limit reached"}), 400

        issue_dt = date.today()
        due_dt = issue_dt + timedelta(days=days)

        conn.execute(
            "UPDATE books SET available_copies = available_copies - 1 WHERE id = ?",
            (book_id,),
        )
        conn.execute(
            """
            INSERT INTO issues (book_id, student_id, issue_date, due_date, status, issued_by)
            VALUES (?, ?, ?, ?, 'Issued', 'Shaik Kousar Bhanu (Admin)')
            """,
            (book_id, student_id, issue_dt.isoformat(), due_dt.isoformat()),
        )
        conn.commit()
    return jsonify({"message": "Book issued successfully"}), 201


@app.post("/api/issues/<int:issue_id>/return")
def return_book(issue_id: int):
    with get_connection() as conn:
        issue = conn.execute("SELECT * FROM issues WHERE id = ?", (issue_id,)).fetchone()
        if not issue or issue["status"] == "Returned":
            return jsonify({"error": "Active issue not found"}), 404

        due_dt = date.fromisoformat(issue["due_date"])
        today = date.today()
        overdue_days = max(0, (today - due_dt).days)
        fine = overdue_days * FINE_PER_DAY

        conn.execute(
            """
            UPDATE issues
            SET return_date = ?, fine_amount = ?, status = 'Returned'
            WHERE id = ?
            """,
            (today.isoformat(), fine, issue_id),
        )
        conn.execute(
            "UPDATE books SET available_copies = available_copies + 1 WHERE id = ?",
            (issue["book_id"],),
        )
        conn.commit()
    return jsonify({"message": "Book returned", "fine_inr": fine})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
`;
