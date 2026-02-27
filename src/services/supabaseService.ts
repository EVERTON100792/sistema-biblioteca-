import { supabase } from '../lib/supabase';
import { Book, Student, Loan } from '../types';

// ─── Books ─────────────────────────────────────────────────────────────

export async function fetchBooks(): Promise<Book[]> {
    const { data, error } = await supabase
        .from('books')
        .select('*')
        .order('title');
    if (error) throw error;
    return (data ?? []).map(rowToBook);
}

export async function insertBook(book: Omit<Book, 'id'>): Promise<Book> {
    const { data, error } = await supabase
        .from('books')
        .insert(bookToRow(book)) // user_id is set by DB default (auth.uid())
        .select()
        .single();
    if (error) throw error;
    return rowToBook(data);
}

export async function updateBook(id: string, book: Partial<Book>): Promise<void> {
    const { error } = await supabase.from('books').update(bookToRow(book)).eq('id', id);
    if (error) throw error;
}

export async function deleteBook(id: string): Promise<void> {
    const { error } = await supabase.from('books').delete().eq('id', id);
    if (error) throw error;
}

// ─── Students ──────────────────────────────────────────────────────────

export async function fetchStudents(): Promise<Student[]> {
    const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('class')
        .order('name');
    if (error) throw error;
    return (data ?? []).map(rowToStudent);
}

export async function insertStudent(student: Omit<Student, 'id'>): Promise<Student> {
    const { data, error } = await supabase
        .from('students')
        .insert({ name: student.name, class: student.class }) // user_id set by DB default
        .select()
        .single();
    if (error) throw error;
    return rowToStudent(data);
}

export async function updateStudent(id: string, student: Partial<Student>): Promise<void> {
    const { error } = await supabase
        .from('students')
        .update({ name: student.name, class: student.class })
        .eq('id', id);
    if (error) throw error;
}

export async function deleteStudent(id: string): Promise<void> {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;
}

// ─── Loans ─────────────────────────────────────────────────────────────

export async function fetchLoans(): Promise<Loan[]> {
    const { data, error } = await supabase
        .from('loans')
        .select('*')
        .order('loan_date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToLoan);
}

export async function insertLoan(loan: Omit<Loan, 'id'>): Promise<Loan> {
    const { data, error } = await supabase
        .from('loans')
        .insert(loanToRow(loan)) // user_id set by DB default
        .select()
        .single();
    if (error) throw error;
    return rowToLoan(data);
}

export async function updateLoan(id: string, loan: Partial<Loan>): Promise<void> {
    const { error } = await supabase.from('loans').update(loanToRow(loan)).eq('id', id);
    if (error) throw error;
}

export async function deleteLoan(id: string): Promise<void> {
    const { error } = await supabase.from('loans').delete().eq('id', id);
    if (error) throw error;
}

// ─── Row ↔ Type mappers ────────────────────────────────────────────────

function rowToBook(row: Record<string, unknown>): Book {
    return {
        id: row.id as string,
        title: row.title as string,
        author: row.author as string,
        year: row.year as number,
        publisher: row.publisher as string,
        isbn: row.isbn as string,
        barcode: row.barcode as string | undefined,
        editionYear: row.edition_year as number,
        location: row.location as string,
        collection: row.collection as string | undefined,
    };
}

function bookToRow(book: Partial<Book>): Record<string, unknown> {
    return {
        title: book.title,
        author: book.author,
        year: book.year,
        publisher: book.publisher,
        isbn: book.isbn,
        barcode: book.barcode ?? null,
        edition_year: book.editionYear,
        location: book.location,
        collection: book.collection ?? null,
    };
}

function rowToStudent(row: Record<string, unknown>): Student {
    return {
        id: row.id as string,
        name: row.name as string,
        class: row.class as string,
    };
}

function rowToLoan(row: Record<string, unknown>): Loan {
    return {
        id: row.id as string,
        studentName: row.student_name as string,
        studentClass: row.student_class as string,
        bookId: row.book_id as string,
        bookTitle: row.book_title as string,
        loanDate: row.loan_date as string,
        dueDate: row.due_date as string,
        returnDate: row.return_date as string | null,
    };
}

function loanToRow(loan: Partial<Loan>): Record<string, unknown> {
    return {
        student_name: loan.studentName,
        student_class: loan.studentClass,
        book_id: loan.bookId ?? null,
        book_title: loan.bookTitle,
        loan_date: loan.loanDate,
        due_date: loan.dueDate,
        return_date: loan.returnDate ?? null,
    };
}
