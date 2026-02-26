export interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
  publisher: string;
  isbn: string;
  editionYear: number;
  location: string; // Genre or Subject
}

export interface Loan {
  id: string;
  studentName: string;
  studentClass: string;
  bookId: string;
  bookTitle: string;
  loanDate: string; // ISO string
  dueDate: string; // ISO string
  returnDate: string | null; // ISO string or null if not returned
}

export interface Student {
  id: string;
  name: string;
  class: string;
}

export interface LibraryData {
  books: Book[];
  loans: Loan[];
  students: Student[];
}
