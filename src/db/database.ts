import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'svcet_library.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const FINE_PER_DAY_INR = 5;

export function initDatabase(): void {
  db.exec(`
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
      password_hash TEXT NOT NULL DEFAULT '',
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

    CREATE INDEX IF NOT EXISTS idx_books_dept ON books(department);
    CREATE INDEX IF NOT EXISTS idx_issues_student ON issues(student_id);
    CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
    CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
  `);

  // Ensure password_hash and created_at exist if upgrading an older DB file
  const studentCols = db.prepare(`PRAGMA table_info(students)`).all() as Array<{ name: string }>;
  const hasPasswordHash = studentCols.some((c) => c.name === 'password_hash');
  if (!hasPasswordHash) {
    db.exec(`ALTER TABLE students ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''`);
  }
  const hasCreatedAt = studentCols.some((c) => c.name === 'created_at');
  if (!hasCreatedAt) {
    db.exec(`ALTER TABLE students ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`);
  }

  const bookCount = db.prepare('SELECT COUNT(*) AS count FROM books').get() as { count: number };
  if (bookCount.count === 0) {
    seedBooksCatalog();
  }
}

function seedBooksCatalog(): void {
  const insertBook = db.prepare(`
    INSERT INTO books (isbn, title, author, publisher, department, edition, rack_location, total_copies, available_copies, cover_variant, description)
    VALUES (@isbn, @title, @author, @publisher, @department, @edition, @rack_location, @total_copies, @available_copies, @cover_variant, @description)
  `);

  const books = [
    {
      isbn: '978-0262046305',
      title: 'Introduction to Algorithms',
      author: 'Thomas H. Cormen, Charles E. Leiserson',
      publisher: 'MIT Press',
      department: 'CSE',
      edition: '4th Edition',
      rack_location: 'Rack CS-01 · Shelf 2',
      total_copies: 12,
      available_copies: 12,
      cover_variant: 'cs',
      description: 'Comprehensive textbook covering data structures, graph algorithms, dynamic programming, and NP-completeness.',
    },
    {
      isbn: '978-1119800361',
      title: 'Operating System Concepts',
      author: 'Abraham Silberschatz, Peter B. Galvin',
      publisher: 'Wiley',
      department: 'CSE',
      edition: '10th Edition',
      rack_location: 'Rack CS-02 · Shelf 1',
      total_copies: 10,
      available_copies: 10,
      cover_variant: 'navy',
      description: 'Core operating systems reference covering process scheduling, concurrency, virtual memory, and file systems.',
    },
    {
      isbn: '978-0136780876',
      title: 'Database System Concepts',
      author: 'Henry F. Korth, S. Sudarshan',
      publisher: 'McGraw-Hill Education',
      department: 'CSE',
      edition: '7th Edition',
      rack_location: 'Rack CS-03 · Shelf 4',
      total_copies: 14,
      available_copies: 14,
      cover_variant: 'cs',
      description: 'Relational algebra, SQL optimization, transaction management, indexing, and distributed databases.',
    },
    {
      isbn: '978-0135404676',
      title: 'Computer Networks',
      author: 'Andrew S. Tanenbaum, David J. Wetherall',
      publisher: 'Pearson',
      department: 'CSE',
      edition: '6th Edition',
      rack_location: 'Rack CS-04 · Shelf 2',
      total_copies: 8,
      available_copies: 8,
      cover_variant: 'slate',
      description: 'Layered network protocols, TCP/IP architecture, wireless networking, and network security principles.',
    },
    {
      isbn: '978-0134610993',
      title: 'Artificial Intelligence: A Modern Approach',
      author: 'Stuart Russell, Peter Norvig',
      publisher: 'Pearson',
      department: 'AI & DS',
      edition: '4th Edition',
      rack_location: 'Rack AI-01 · Shelf 1',
      total_copies: 10,
      available_copies: 10,
      cover_variant: 'cs',
      description: 'Foundational guide to intelligent agents, heuristic search, probabilistic reasoning, and machine learning.',
    },
    {
      isbn: '978-0262035613',
      title: 'Deep Learning',
      author: 'Ian Goodfellow, Yoshua Bengio, Aaron Courville',
      publisher: 'MIT Press',
      department: 'AI & DS',
      edition: '1st Edition',
      rack_location: 'Rack AI-02 · Shelf 3',
      total_copies: 6,
      available_copies: 6,
      cover_variant: 'navy',
      description: 'Mathematical foundations of neural networks, backpropagation, CNNs, sequence modeling, and generative models.',
    },
    {
      isbn: '978-1492032649',
      title: 'Hands-On Machine Learning with Scikit-Learn',
      author: 'Aurelien Geron',
      publisher: "O'Reilly Media",
      department: 'AI & DS',
      edition: '3rd Edition',
      rack_location: 'Rack AI-03 · Shelf 2',
      total_copies: 9,
      available_copies: 9,
      cover_variant: 'slate',
      description: 'Practical Python machine learning workflows, ensemble methods, and neural architectures.',
    },
    {
      isbn: '978-0190853464',
      title: 'Microelectronic Circuits',
      author: 'Adel S. Sedra, Kenneth C. Smith',
      publisher: 'Oxford University Press',
      department: 'ECE',
      edition: '8th Edition',
      rack_location: 'Rack EC-01 · Shelf 1',
      total_copies: 11,
      available_copies: 11,
      cover_variant: 'ece',
      description: 'MOSFET and BJT amplifier design, analog integrated circuits, frequency response, and digital logic.',
    },
    {
      isbn: '978-0138147570',
      title: 'Signals and Systems',
      author: 'Alan V. Oppenheim, Alan S. Willsky',
      publisher: 'Pearson',
      department: 'ECE',
      edition: '2nd Edition',
      rack_location: 'Rack EC-02 · Shelf 3',
      total_copies: 9,
      available_copies: 9,
      cover_variant: 'emerald',
      description: 'Continuous and discrete-time LTI systems, Fourier transforms, Laplace transforms, and sampling theory.',
    },
    {
      isbn: '978-0073380476',
      title: 'CMOS VLSI Design: A Circuits and Systems Perspective',
      author: 'Neil H. E. Weste, David Harris',
      publisher: 'Pearson',
      department: 'ECE',
      edition: '4th Edition',
      rack_location: 'Rack EC-04 · Shelf 2',
      total_copies: 7,
      available_copies: 7,
      cover_variant: 'ece',
      description: 'CMOS logic design, physical layout, timing verification, memory subsystems, and low-power design.',
    },
    {
      isbn: '978-0073380575',
      title: 'Electric Machinery Fundamentals',
      author: 'Stephen J. Chapman',
      publisher: 'McGraw-Hill',
      department: 'EEE',
      edition: '5th Edition',
      rack_location: 'Rack EE-01 · Shelf 1',
      total_copies: 8,
      available_copies: 8,
      cover_variant: 'emerald',
      description: 'Transformers, DC machines, synchronous generators, induction motors, and power electronics.',
    },
    {
      isbn: '978-9352606795',
      title: 'Power System Analysis',
      author: 'Hadi Saadat',
      publisher: 'McGraw-Hill India',
      department: 'EEE',
      edition: '3rd Edition',
      rack_location: 'Rack EE-03 · Shelf 2',
      total_copies: 10,
      available_copies: 10,
      cover_variant: 'ece',
      description: 'Transmission line modeling, load flow analysis, fault studies, and power system stability.',
    },
    {
      isbn: '978-9354600500',
      title: "Shigley's Mechanical Engineering Design",
      author: 'Richard G. Budynas, J. Keith Nisbett',
      publisher: 'McGraw-Hill',
      department: 'MECH',
      edition: '11th Edition',
      rack_location: 'Rack ME-01 · Shelf 1',
      total_copies: 10,
      available_copies: 10,
      cover_variant: 'slate',
      description: 'Failure prevention, fatigue analysis, shafts, gears, bearings, and welded mechanical joints.',
    },
    {
      isbn: '978-1260565652',
      title: 'Thermodynamics: An Engineering Approach',
      author: 'Yunus A. Cengel, Michael A. Boles',
      publisher: 'McGraw-Hill',
      department: 'MECH',
      edition: '9th Edition',
      rack_location: 'Rack ME-02 · Shelf 4',
      total_copies: 12,
      available_copies: 12,
      cover_variant: 'navy',
      description: 'Laws of thermodynamics, entropy, gas power cycles, refrigeration, and thermodynamic property relations.',
    },
    {
      isbn: '978-8131808221',
      title: 'Soil Mechanics and Foundations',
      author: 'B. C. Punmia, Ashok Kumar Jain',
      publisher: 'Laxmi Publications',
      department: 'CIVIL',
      edition: '16th Edition',
      rack_location: 'Rack CV-01 · Shelf 2',
      total_copies: 9,
      available_copies: 9,
      cover_variant: 'emerald',
      description: 'Geotechnical soil classification, shear strength, consolidation, slope stability, and foundation design.',
    },
    {
      isbn: '978-8120348868',
      title: 'Design of Reinforced Concrete Structures',
      author: 'S. Unnikrishna Pillai, Devdas Menon',
      publisher: 'McGraw-Hill',
      department: 'CIVIL',
      edition: '3rd Edition',
      rack_location: 'Rack CV-03 · Shelf 1',
      total_copies: 8,
      available_copies: 8,
      cover_variant: 'slate',
      description: 'Limit state design of beams, slabs, columns, footings, and retaining walls per IS 456.',
    },
    {
      isbn: '978-0135642573',
      title: 'Marketing Management',
      author: 'Philip Kotler, Kevin Lane Keller',
      publisher: 'Pearson',
      department: 'MBA',
      edition: '16th Edition',
      rack_location: 'Rack MB-01 · Shelf 3',
      total_copies: 7,
      available_copies: 7,
      cover_variant: 'navy',
      description: 'Strategic marketing frameworks, brand equity, digital channels, and global market positioning.',
    },
    {
      isbn: '978-1260013900',
      title: 'Python Data Science Handbook',
      author: 'Jake VanderPlas',
      publisher: "O'Reilly Media",
      department: 'CSE',
      edition: '2nd Edition',
      rack_location: 'Rack CS-06 · Shelf 2',
      total_copies: 10,
      available_copies: 10,
      cover_variant: 'cs',
      description: 'NumPy, Pandas, Matplotlib, and Scikit-Learn techniques for scientific computing and analytics.',
    },
  ];

  const transaction = db.transaction(() => {
    for (const book of books) {
      insertBook.run(book);
    }
  });

  transaction();
}
