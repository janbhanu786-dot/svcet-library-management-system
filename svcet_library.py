"""
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
