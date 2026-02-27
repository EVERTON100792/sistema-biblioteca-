import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Book as BookIcon,
  Users,
  Library,
  Plus,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
  Trash2,
  Edit2,
  ArrowLeftRight,
  LayoutDashboard,
  ChevronRight,
  ChevronDown,
  X,
  Bell,
  Menu,
  LogOut,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, differenceInDays, isAfter, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Book, Loan, Student, LibraryData } from './types';
import { supabase } from './lib/supabase';
import * as db from './services/supabaseService';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { cn } from './utils/cn';

type Tab = 'dashboard' | 'books' | 'students' | 'loans' | 'settings';

const tabLabels: Record<Tab, string> = {
  dashboard: 'Dashboard',
  books: 'Catálogo',
  students: 'Alunos',
  loans: 'Empréstimos',
  settings: 'Backup',
};

export default function App() {
  // Auth state
  const [session, setSession] = useState<unknown>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setData({ books: [], students: [], loans: [] });
  };

  // App data
  const [data, setData] = useState<LibraryData>({ books: [], students: [], loans: [] });
  const [dataLoading, setDataLoading] = useState(false);

  const loadAllData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [books, students, loans] = await Promise.all([
        db.fetchBooks(),
        db.fetchStudents(),
        db.fetchLoans(),
      ]);
      setData({ books, students, loans });
    } catch (e) {
      console.error('Error loading data:', e);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) loadAllData();
  }, [session, loadAllData]);

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = localStorage.getItem('bibliocontrol_active_tab') as Tab | null;
    const validTabs: Tab[] = ['dashboard', 'books', 'students', 'loans', 'settings'];
    return saved && validTabs.includes(saved) ? saved : 'dashboard';
  });

  // Persist active tab across page reloads
  useEffect(() => {
    localStorage.setItem('bibliocontrol_active_tab', activeTab);
  }, [activeTab]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Close sidebar when changing tabs (mobile UX)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeTab]);

  // Form States
  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [showLoanForm, setShowLoanForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Sync selectedStudentId when editingLoan changes
  useEffect(() => {
    if (editingLoan) {
      const studentId = data.students.find(s => s.name === editingLoan.studentName && s.class === editingLoan.studentClass)?.id || '';
      setSelectedStudentId(studentId);
    } else {
      setSelectedStudentId('');
    }
  }, [editingLoan, data.students]);

  // Confirmation State
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'book' | 'student' | 'loan', id: string, message: string } | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState<{ id: string, message: string, type: 'warning' | 'info' }[]>([]);

  // Toast system
  type ToastType = 'success' | 'error' | 'info';
  const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType; emoji: string }[]>([]);
  const showToast = useCallback((message: string, type: ToastType = 'success', emoji = '✅') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type, emoji }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // Check for upcoming due dates
  useEffect(() => {
    const today = startOfDay(new Date());
    const upcoming = data.loans
      .filter(l => !l.returnDate)
      .filter(l => {
        const dueDate = parseISO(l.dueDate);
        const diff = differenceInDays(dueDate, today);
        return diff >= 0 && diff <= 2; // Due today or in the next 2 days
      })
      .map(l => ({
        id: l.id,
        message: `O livro "${l.bookTitle}" emprestado para ${l.studentName} vence em breve (${format(parseISO(l.dueDate), 'dd/MM/yyyy')})!`,
        type: 'warning' as const
      }));

    setNotifications(upcoming);
  }, [data.loans]);

  const stats = useMemo(() => {
    const activeLoans = data.loans.filter(l => !l.returnDate);
    const overdueLoans = activeLoans.filter(l => isAfter(new Date(), parseISO(l.dueDate)));
    return {
      totalBooks: data.books.length,
      totalStudents: data.students.length,
      activeLoans: activeLoans.length,
      overdueLoans: overdueLoans.length,
      totalLoans: data.loans.length
    };
  }, [data]);

  const filteredBooks = useMemo(() => {
    return data.books
      .filter(b =>
        b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.isbn.includes(searchTerm)
      )
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  }, [data.books, searchTerm]);

  const filteredStudents = useMemo(() => {
    return data.students
      .filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.class.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.class.localeCompare(b.class, 'pt-BR', { numeric: true }) || a.name.localeCompare(b.name, 'pt-BR'));
  }, [data.students, searchTerm]);

  const filteredLoans = useMemo(() => {
    return data.loans.filter(l =>
      l.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.bookTitle.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => parseISO(b.loanDate).getTime() - parseISO(a.loanDate).getTime());
  }, [data.loans, searchTerm]);

  const handleSaveBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const hasCollection = formData.get('hasCollection') === 'yes';
    const bookData = {
      title: formData.get('title') as string,
      author: formData.get('author') as string,
      year: parseInt(formData.get('year') as string),
      publisher: formData.get('publisher') as string,
      isbn: formData.get('isbn') as string,
      barcode: (formData.get('barcode') as string) || undefined,
      editionYear: parseInt(formData.get('editionYear') as string),
      location: formData.get('location') as string,
      collection: hasCollection ? (formData.get('collection') as string) || undefined : undefined,
    };
    try {
      if (editingBook) {
        await db.updateBook(editingBook.id, bookData);
        showToast('Livro atualizado com sucesso!', 'success', '📚');
      } else {
        await db.insertBook(bookData);
        showToast('Livro cadastrado com sucesso!', 'success', '📚');
      }
      await loadAllData();
    } catch (e) { console.error(e); showToast('Erro ao salvar livro.', 'error', '❌'); }
    setShowBookForm(false);
    setEditingBook(null);
  };

  const handleSaveStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const studentData = { name: formData.get('name') as string, class: formData.get('class') as string };
    try {
      if (editingStudent) {
        await db.updateStudent(editingStudent.id, studentData);
        showToast('Aluno atualizado com sucesso!', 'success', '🎓');
      } else {
        await db.insertStudent(studentData);
        showToast('Aluno cadastrado com sucesso!', 'success', '🎓');
      }
      await loadAllData();
    } catch (e) { console.error(e); showToast('Erro ao salvar aluno.', 'error', '❌'); }
    setShowStudentForm(false);
    setEditingStudent(null);
  };

  const handleSaveLoan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const bookId = formData.get('bookId') as string;
    const studentName = (formData.get('studentName') as string).trim();
    const studentClass = (formData.get('studentClass') as string).trim();
    const book = data.books.find(b => b.id === bookId);
    if (!book || !studentName || !studentClass) return;
    try {
      // Auto-create student if needed
      let student = data.students.find(
        s => s.name.toLowerCase() === studentName.toLowerCase() && s.class.toLowerCase() === studentClass.toLowerCase()
      );
      if (!student) {
        student = await db.insertStudent({ name: studentName, class: studentClass });
        showToast(`Aluno "${studentName}" cadastrado automaticamente!`, 'info', '👤');
      }
      if (editingLoan) {
        await db.updateLoan(editingLoan.id, {
          studentName: student.name, studentClass: student.class,
          bookId: book.id, bookTitle: book.title,
        });
        showToast('Empréstimo atualizado!', 'success', '📖');
      } else {
        const loanDate = new Date();
        const dueDate = addDays(loanDate, 7);
        await db.insertLoan({
          studentName: student.name, studentClass: student.class,
          bookId: book.id, bookTitle: book.title,
          loanDate: loanDate.toISOString(), dueDate: dueDate.toISOString(), returnDate: null,
        });
        showToast(`Empréstimo de "${book.title}" registrado! Devolução em 7 dias.`, 'success', '📖');
      }
      await loadAllData();
    } catch (e) { console.error(e); showToast('Erro ao registrar empréstimo.', 'error', '❌'); }
    setShowLoanForm(false);
    setEditingLoan(null);
    setSelectedStudentId('');
  };

  const handleReturnBook = async (loanId: string) => {
    try {
      await db.updateLoan(loanId, { returnDate: new Date().toISOString() });
      await loadAllData();
      showToast('Devolução registrada com sucesso!', 'success', '🏠');
    } catch (e) { console.error(e); showToast('Erro ao registrar devolução.', 'error', '❌'); }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    const labels: Record<string, string> = { book: 'Livro', student: 'Aluno', loan: 'Empréstimo' };
    try {
      if (type === 'book') await db.deleteBook(id);
      if (type === 'student') await db.deleteStudent(id);
      if (type === 'loan') await db.deleteLoan(id);
      await loadAllData();
      showToast(`${labels[type]} excluído com sucesso!`, 'info', '🗑️');
    } catch (e) { console.error(e); showToast('Erro ao excluir.', 'error', '❌'); }
    setConfirmDelete(null);
  };

  const handleExport = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bibliocontrol-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const text = await file.text();
        const importedData: LibraryData = JSON.parse(text);
        if (confirm('Isso irá substituir todos os dados atuais. Continuar?')) {
          setData(importedData);
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao importar backup');
      }
    }
  };


  // ── Auth gate ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage onAuthSuccess={() => { }} />;
  }

  return (
    <div className="min-h-screen bg-brand-surface text-slate-900 font-sans flex">
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          setShowPasswordModal(false);
          showToast('Senha alterada! Use a nova senha no próximo acesso.', 'success', '🔒');
        }}
      />
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 sidebar-gradient text-white flex flex-col shadow-2xl z-40 transition-transform duration-300 ease-in-out",
        "md:relative md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8">
          <div className="flex items-center gap-3 group cursor-default">
            <motion.div
              animate={{
                rotateY: [0, 180, 360],
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="w-12 h-12 bg-gradient-to-br from-brand-accent to-emerald-400 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-accent/40 ring-4 ring-white/10 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <BookIcon className="w-7 h-7 text-white drop-shadow-md" />
            </motion.div>
            <div className="flex flex-col">
              <span className="font-black text-2xl tracking-tighter leading-none">Biblio<span className="text-brand-accent">Control</span></span>
              <span className="text-[8px] font-bold text-white/30 uppercase tracking-[0.3em] mt-1">Premium Edition</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          <SidebarItem
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="Dashboard"
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
          />
          <SidebarItem
            icon={<BookIcon className="w-5 h-5" />}
            label="Catálogo"
            active={activeTab === 'books'}
            onClick={() => setActiveTab('books')}
          />
          <SidebarItem
            icon={<Users className="w-5 h-5" />}
            label="Alunos"
            active={activeTab === 'students'}
            onClick={() => setActiveTab('students')}
          />
          <SidebarItem
            icon={<ArrowLeftRight className="w-5 h-5" />}
            label="Empréstimos"
            active={activeTab === 'loans'}
            onClick={() => setActiveTab('loans')}
          />
        </nav>

        <div className="p-4 space-y-2">
          {/* Logged user */}
          <div className="bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Logado como</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-brand-accent rounded-full animate-pulse shrink-0" />
              <p className="text-xs text-white/80 font-medium truncate">{(session as { user?: { email?: string } })?.user?.email ?? 'Usuário'}</p>
            </div>
          </div>
          {/* Actions */}
          <div className="space-y-1">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-white/70 hover:bg-white/10 transition-all text-sm font-bold"
            >
              <Lock className="w-4 h-4" />
              Alterar Senha
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-white/50 hover:bg-rose-500/10 hover:text-rose-400 transition-all text-sm font-bold"
            >
              <LogOut className="w-4 h-4" />
              Sair do Sistema
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 md:h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between px-4 md:px-10 sticky top-0 z-10 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <div className="min-w-0">
              <h2 className="hidden md:block text-sm font-bold text-slate-400 uppercase tracking-widest mb-0.5">Visão Geral</h2>
              <h1 className="text-lg md:text-2xl font-bold text-slate-900 truncate">{tabLabels[activeTab]}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-accent transition-colors" />
              <input
                type="text"
                placeholder="Pesquisar..."
                className="pl-9 md:pl-11 pr-3 md:pr-4 py-2 md:py-2.5 bg-slate-100 border-2 border-transparent rounded-xl text-sm focus:bg-white focus:border-brand-accent/20 outline-none w-32 sm:w-52 md:w-72 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={handleLogout}
              title="Sair do sistema"
              className="p-2 md:p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 md:p-8 pb-24 md:pb-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 md:space-y-8"
              >
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                  <StatCard icon={<BookIcon />} label="Total de Livros" value={stats.totalBooks} color="blue" />
                  <StatCard icon={<Users />} label="Total de Alunos" value={stats.totalStudents} color="amber" />
                  <StatCard icon={<ArrowLeftRight />} label="Empréstimos Ativos" value={stats.activeLoans} color="emerald" />
                  <StatCard icon={<AlertCircle />} label="Atrasados" value={stats.overdueLoans} color="rose" />
                </div>

                {notifications.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Bell className="w-4 h-4 text-brand-accent" /> Alertas Críticos
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {notifications.map(n => (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={n.id}
                          className="bg-amber-50/50 border border-amber-200/50 p-5 rounded-2xl flex items-start gap-4 text-amber-900 shadow-sm"
                        >
                          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                          </div>
                          <p className="text-sm font-medium leading-relaxed">{n.message}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/60 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-lg font-bold flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Clock className="w-4 h-4 text-slate-600" />
                        </div>
                        Atividade Recente
                      </h3>
                      <button onClick={() => setActiveTab('loans')} className="text-xs font-bold text-brand-accent hover:underline">Ver todos</button>
                    </div>
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
                      {data.loans.slice(0, 15).map(loan => (
                        <div key={loan.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-brand-accent transition-colors">
                              <Users className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-sm text-slate-900">{loan.studentName}</p>
                              <p className="text-xs text-slate-500 font-medium">{loan.bookTitle}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{format(parseISO(loan.loanDate), 'dd MMM yyyy', { locale: ptBR })}</p>
                            <LoanStatusBadge loan={loan} />
                          </div>
                        </div>
                      ))}
                      {data.loans.length === 0 && (
                        <div className="py-12 text-center">
                          <p className="text-slate-400 text-sm italic">Nenhum registro de atividade.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                    <h3 className="text-lg font-bold mb-8 flex items-center gap-3 relative z-10">
                      <Plus className="w-5 h-5 text-brand-accent" />
                      Acesso Rápido
                    </h3>
                    <div className="grid grid-cols-1 gap-4 relative z-10">
                      <QuickAction
                        icon={<Plus />}
                        label="Novo Livro"
                        onClick={() => { setActiveTab('books'); setShowBookForm(true); }}
                        color="dark"
                      />
                      <QuickAction
                        icon={<ArrowLeftRight />}
                        label="Novo Empréstimo"
                        onClick={() => { setActiveTab('loans'); setShowLoanForm(true); }}
                        color="dark"
                      />
                      <QuickAction
                        icon={<Download />}
                        label="Backup"
                        onClick={handleExport}
                        color="dark"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'books' && (
              <motion.div
                key="books"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 md:space-y-8"
              >
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Catálogo de Livros</h3>
                    <p className="hidden sm:block text-sm text-slate-500 font-medium">Gerencie o acervo da biblioteca</p>
                  </div>
                  <button
                    onClick={() => setShowBookForm(true)}
                    className="bg-brand-accent text-white px-4 md:px-6 py-2.5 md:py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-xl shadow-brand-accent/20 active:scale-95 shrink-0"
                  >
                    <Plus className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden sm:inline">Adicionar</span> Livro
                  </button>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {filteredBooks.map(book => (
                    <div key={book.id} className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900">{book.title}</p>
                          <p className="text-xs text-slate-500 font-medium">{book.author}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => { setEditingBook(book); setShowBookForm(true); }} className="p-2 bg-slate-100 text-slate-400 hover:text-brand-accent hover:bg-brand-accent/10 rounded-xl transition-all">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setConfirmDelete({ type: 'book', id: book.id, message: `Tem certeza que deseja excluir o livro "${book.title}"?` })} className="p-2 bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100">{book.location}</span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">{book.year}</span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider bg-slate-100 text-slate-500">{book.isbn}</span>
                      </div>
                    </div>
                  ))}
                  {filteredBooks.length === 0 && (
                    <div className="py-16 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><Library className="w-8 h-8 text-slate-200" /></div>
                      <p className="text-slate-400 font-medium text-sm">Nenhum livro encontrado no acervo.</p>
                    </div>
                  )}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:flex flex-col bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden max-h-[calc(100vh-280px)]">
                  <div className="overflow-y-auto custom-scrollbar flex-1 relative">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Título / Autor</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">ISBN / Editora</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Localização</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Ano</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredBooks.map(book => (
                          <tr key={book.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-5"><p className="font-bold text-sm text-slate-900 group-hover:text-brand-accent transition-colors">{book.title}</p><p className="text-xs text-slate-500 font-medium">{book.author}</p></td>
                            <td className="px-8 py-5"><p className="text-xs font-bold font-mono text-slate-600">{book.isbn}</p><p className="text-xs text-slate-400 font-medium">{book.publisher}</p></td>
                            <td className="px-8 py-5"><span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100">{book.location}</span></td>
                            <td className="px-8 py-5 text-xs font-bold text-slate-600">{book.year}</td>
                            <td className="px-8 py-5 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                <button onClick={() => { setEditingBook(book); setShowBookForm(true); }} className="p-2.5 bg-slate-100 text-slate-400 hover:text-brand-accent hover:bg-brand-accent/10 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => setConfirmDelete({ type: 'book', id: book.id, message: `Tem certeza que deseja excluir o livro "${book.title}"?` })} className="p-2.5 bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredBooks.length === 0 && (
                    <div className="py-24 text-center"><div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6"><Library className="w-10 h-10 text-slate-200" /></div><p className="text-slate-400 font-medium">Nenhum livro encontrado no acervo.</p></div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'students' && (
              <motion.div
                key="students"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 md:space-y-8"
              >
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Gestão de Alunos</h3>
                    <p className="hidden sm:block text-sm text-slate-500 font-medium">Controle de membros da biblioteca</p>
                  </div>
                  <button
                    onClick={() => { setEditingStudent(null); setShowStudentForm(true); }}
                    className="bg-brand-accent text-white px-4 md:px-6 py-2.5 md:py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-xl shadow-brand-accent/20 active:scale-95 shrink-0"
                  >
                    <Plus className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden sm:inline">Cadastrar</span> Aluno
                  </button>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {filteredStudents.map(student => (
                    <div key={student.id} className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm flex items-center gap-4">
                      <div className="w-10 h-10 bg-brand-accent/10 rounded-full flex items-center justify-center text-brand-accent font-bold text-sm shrink-0">
                        {student.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-900 truncate">{student.name}</p>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 mt-1">{student.class}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { setEditingStudent(student); setShowStudentForm(true); }} className="p-2 bg-slate-100 text-slate-400 hover:text-brand-accent hover:bg-brand-accent/10 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setConfirmDelete({ type: 'student', id: student.id, message: `Tem certeza que deseja excluir o aluno "${student.name}"?` })} className="p-2 bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                  {filteredStudents.length === 0 && (
                    <div className="py-16 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><Users className="w-8 h-8 text-slate-200" /></div>
                      <p className="text-slate-400 font-medium text-sm">Nenhum aluno cadastrado.</p>
                    </div>
                  )}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:flex flex-col bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden max-h-[calc(100vh-280px)]">
                  <div className="overflow-y-auto custom-scrollbar flex-1 relative">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Nome do Aluno</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Turma / Série</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredStudents.map(student => (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-5"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-bold text-xs group-hover:bg-brand-accent group-hover:text-white transition-colors">{student.name.charAt(0)}</div><p className="font-bold text-sm text-slate-900">{student.name}</p></div></td>
                            <td className="px-8 py-5"><span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">{student.class}</span></td>
                            <td className="px-8 py-5 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                <button onClick={() => { setEditingStudent(student); setShowStudentForm(true); }} className="p-2.5 bg-slate-100 text-slate-400 hover:text-brand-accent hover:bg-brand-accent/10 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => setConfirmDelete({ type: 'student', id: student.id, message: `Tem certeza que deseja excluir o aluno "${student.name}"?` })} className="p-2.5 bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredStudents.length === 0 && (
                    <div className="py-24 text-center"><div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6"><Users className="w-10 h-10 text-slate-200" /></div><p className="text-slate-400 font-medium">Nenhum aluno cadastrado.</p></div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'loans' && (
              <motion.div
                key="loans"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 md:space-y-8"
              >
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Gestão de Empréstimos</h3>
                    <p className="hidden sm:block text-sm text-slate-500 font-medium">Acompanhamento de retiradas e devoluções</p>
                  </div>
                  <button
                    onClick={() => setShowLoanForm(true)}
                    className="bg-brand-accent text-white px-4 md:px-6 py-2.5 md:py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-xl shadow-brand-accent/20 active:scale-95 shrink-0"
                  >
                    <Plus className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden sm:inline">Novo</span> Empréstimo
                  </button>
                </div>


                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {filteredLoans.map(loan => (
                    <div key={loan.id} className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 truncate">{loan.studentName}</p>
                          <p className="text-xs text-slate-500 font-medium">{loan.studentClass}</p>
                        </div>
                        <LoanStatusBadge loan={loan} showOverdueDays />
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0"><BookIcon className="w-3.5 h-3.5" /></div>
                        <p className="text-xs font-bold text-slate-700 truncate">{loan.bookTitle}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex gap-3">
                          <span className="text-[10px] font-bold text-slate-400">Saída: {format(parseISO(loan.loanDate), 'dd/MM/yy')}</span>
                          <span className="text-[10px] font-bold text-brand-accent">Prazo: {format(parseISO(loan.dueDate), 'dd/MM/yy')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {!loan.returnDate && (
                            <button onClick={() => handleReturnBook(loan.id)} className="text-[10px] font-bold uppercase text-white bg-brand-accent hover:bg-emerald-600 px-3 py-1.5 rounded-xl transition-all">Baixa</button>
                          )}
                          <button onClick={() => { setEditingLoan(loan); setShowLoanForm(true); }} className="p-2 bg-slate-100 text-slate-400 hover:text-brand-accent hover:bg-brand-accent/10 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setConfirmDelete({ type: 'loan', id: loan.id, message: 'Tem certeza que deseja excluir este registro de empréstimo?' })} className="p-2 bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredLoans.length === 0 && (
                    <div className="py-16 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><ArrowLeftRight className="w-8 h-8 text-slate-200" /></div>
                      <p className="text-slate-400 font-medium text-sm">Nenhum registro de empréstimo.</p>
                    </div>
                  )}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:flex flex-col bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden max-h-[calc(100vh-280px)]">
                  <div className="overflow-y-auto custom-scrollbar flex-1 relative">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Aluno / Turma</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Livro Emprestado</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Cronograma</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Status</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredLoans.map(loan => (
                          <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-5"><p className="font-bold text-sm text-slate-900">{loan.studentName}</p><p className="text-xs text-slate-500 font-medium">{loan.studentClass}</p></td>
                            <td className="px-8 py-5"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400"><BookIcon className="w-4 h-4" /></div><p className="text-sm font-bold text-slate-700">{loan.bookTitle}</p></div></td>
                            <td className="px-8 py-5"><div className="flex flex-col gap-1.5"><div className="flex items-center gap-2"><span className="w-1 h-1 bg-slate-300 rounded-full" /><span className="text-[10px] uppercase font-bold text-slate-400">Saída: {format(parseISO(loan.loanDate), 'dd/MM/yyyy')}</span></div><div className="flex items-center gap-2"><span className="w-1 h-1 bg-brand-accent rounded-full" /><span className="text-[10px] uppercase font-bold text-brand-accent">Prazo: {format(parseISO(loan.dueDate), 'dd/MM/yyyy')}</span></div></div></td>
                            <td className="px-8 py-5"><LoanStatusBadge loan={loan} showOverdueDays /></td>
                            <td className="px-8 py-5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!loan.returnDate && (<button onClick={() => handleReturnBook(loan.id)} className="text-[10px] font-bold uppercase tracking-widest text-white bg-brand-accent hover:bg-emerald-600 px-4 py-2 rounded-xl transition-all shadow-lg shadow-brand-accent/10">Dar Baixa</button>)}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                  <button onClick={() => { setEditingLoan(loan); setShowLoanForm(true); }} className="p-2.5 bg-slate-100 text-slate-400 hover:text-brand-accent hover:bg-brand-accent/10 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => setConfirmDelete({ type: 'loan', id: loan.id, message: 'Tem certeza que deseja excluir este registro de empréstimo?' })} className="p-2.5 bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredLoans.length === 0 && (
                    <div className="py-24 text-center"><div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6"><ArrowLeftRight className="w-10 h-10 text-slate-200" /></div><p className="text-slate-400 font-medium">Nenhum registro de empréstimo.</p></div>
                  )}
                </div>
              </motion.div>
            )}



            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-bold tracking-tight text-slate-900">Segurança e Backup</h3>
                  <p className="text-slate-500 font-medium">Mantenha seus dados seguros exportando backups regularmente.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm flex flex-col items-center text-center space-y-6 group hover:shadow-md transition-all">
                    <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                      <Download className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-slate-900">Exportar Dados</h4>
                      <p className="text-sm text-slate-500 font-medium">Gera um arquivo .json com todos os registros.</p>
                    </div>
                    <button
                      onClick={handleExport}
                      className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                    >
                      Salvar Backup Agora
                    </button>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm flex flex-col items-center text-center space-y-6 group hover:shadow-md transition-all">
                    <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-slate-900">Restaurar Backup</h4>
                      <p className="text-sm text-slate-500 font-medium">Carrega dados de um arquivo anterior.</p>
                    </div>
                    <button
                      onClick={() => document.getElementById('import-input')?.click()}
                      className="w-full bg-white border-2 border-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                    >
                      Selecionar Arquivo
                    </button>
                    <input
                      id="import-input"
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleImport}
                    />
                  </div>
                </div>

                <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-accent/20 rounded-xl flex items-center justify-center text-brand-accent">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-lg">Dica de Segurança</h4>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed font-medium">
                    Os dados deste sistema são salvos automaticamente no seu navegador (Local Storage).
                    Se você limpar o cache do navegador ou trocar de computador, os dados serão perdidos.
                    <strong className="text-white"> Recomendamos fazer um backup diário</strong> para garantir que você nunca perca suas informações.
                  </p>
                </div>
              </motion.div>

            )}
          </AnimatePresence>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200/60 pb-safe z-40 px-6">
          <div className="flex justify-between items-center py-2 h-16">
            <button onClick={() => setActiveTab('dashboard')} className={cn("flex flex-col items-center gap-1 p-2 rounded-xl transition-all", activeTab === 'dashboard' ? "text-brand-accent" : "text-slate-400")}>
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] font-bold">Início</span>
            </button>
            <button onClick={() => setActiveTab('books')} className={cn("flex flex-col items-center gap-1 p-2 rounded-xl transition-all", activeTab === 'books' ? "text-brand-accent" : "text-slate-400")}>
              <BookIcon className="w-5 h-5" />
              <span className="text-[10px] font-bold">Livros</span>
            </button>
            <button onClick={() => setActiveTab('students')} className={cn("flex flex-col items-center gap-1 p-2 rounded-xl transition-all", activeTab === 'students' ? "text-brand-accent" : "text-slate-400")}>
              <Users className="w-5 h-5" />
              <span className="text-[10px] font-bold">Alunos</span>
            </button>
            <button onClick={() => setActiveTab('loans')} className={cn("flex flex-col items-center gap-1 p-2 rounded-xl transition-all", activeTab === 'loans' ? "text-brand-accent" : "text-slate-400")}>
              <ArrowLeftRight className="w-5 h-5" />
              <span className="text-[10px] font-bold">Locações</span>
            </button>
          </div>
        </div>
      </main>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-4 md:right-6 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-md',
                toast.type === 'success' && 'bg-emerald-50/95 border-emerald-200 text-emerald-900',
                toast.type === 'error' && 'bg-rose-50/95 border-rose-200 text-rose-900',
                toast.type === 'info' && 'bg-blue-50/95 border-blue-200 text-blue-900',
              )}
            >
              <span className="text-xl shrink-0 mt-0.5">{toast.emoji}</span>
              <div className="flex flex-col min-w-0">
                <p className="font-bold text-sm leading-snug">{toast.message}</p>
                <p className={cn(
                  'text-xs font-medium mt-0.5 opacity-60',
                )}>Salvo no Supabase</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>


      {/* Modals */}
      <Modal
        isOpen={showBookForm}
        onClose={() => { setShowBookForm(false); setEditingBook(null); }}
        title={editingBook ? "Editar Livro" : "Cadastrar Novo Livro"}
      >
        <BookForm
          editingBook={editingBook}
          onSubmit={handleSaveBook}
        />
      </Modal>

      <Modal
        isOpen={showStudentForm}
        onClose={() => { setShowStudentForm(false); setEditingStudent(null); }}
        title={editingStudent ? "Editar Aluno" : "Cadastrar Novo Aluno"}
      >
        <form onSubmit={handleSaveStudent} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
            <input name="name" defaultValue={editingStudent?.name} required className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all font-bold text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Turma / Série</label>
            <input name="class" defaultValue={editingStudent?.class} required className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all font-bold text-sm" />
          </div>
          <button type="submit" className="w-full bg-brand-accent text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-xl shadow-brand-accent/20 mt-4">
            {editingStudent ? "Salvar Alterações" : "Cadastrar Aluno"}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={showLoanForm}
        onClose={() => { setShowLoanForm(false); setEditingLoan(null); }}
        title={editingLoan ? "Editar Empréstimo" : "Registrar Empréstimo"}
      >
        <form onSubmit={handleSaveLoan} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome do Aluno</label>
              <input
                name="studentName"
                defaultValue={editingLoan?.studentName}
                required
                placeholder="Ex: João da Silva"
                className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all font-bold text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Turma / Série</label>
              <input
                name="studentClass"
                defaultValue={editingLoan?.studentClass}
                required
                placeholder="Ex: 5º Ano A"
                className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all font-bold text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Livro</label>
            <SearchableBookSelect
              books={data.books}
              defaultValue={editingLoan?.bookId}
            />
          </div>
          {!editingLoan && (
            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 space-y-2">
              <div className="flex items-center gap-2 text-blue-600">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Informação</span>
              </div>
              <p className="text-blue-700 text-xs font-medium leading-relaxed">
                O prazo de devolução será definido para <strong>7 dias</strong> a partir de hoje. Se o aluno não estiver cadastrado, ele será <strong>cadastrado automaticamente</strong> na aba Alunos.
              </p>
            </div>
          )}
          <button type="submit" className="w-full bg-brand-accent text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-xl shadow-brand-accent/20 mt-4">
            {editingLoan ? "Salvar Alterações" : "Confirmar Empréstimo"}
          </button>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={executeDelete}
        title="Confirmar Exclusão"
        message={confirmDelete?.message || ""}
      />
    </div >
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all font-bold text-sm relative group",
        active
          ? "bg-brand-accent text-white shadow-xl shadow-brand-accent/20"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      )}
    >
      <span className={cn("transition-transform duration-300 group-hover:scale-110", active ? "text-white" : "text-slate-500 group-hover:text-brand-accent")}>
        {icon}
      </span>
      {label}
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute right-2 w-1.5 h-1.5 bg-white rounded-full"
        />
      )}
    </button>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };

  return (
    <div className="bg-white p-7 rounded-[2rem] border border-slate-200/60 shadow-sm flex items-center gap-6 group hover:shadow-md transition-all">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-110", colors[color])}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-7 h-7' })}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
        <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, onClick, color }: { icon: React.ReactNode, label: string, onClick: () => void, color: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left group"
    >
      <div className="w-10 h-10 bg-brand-accent/20 rounded-xl flex items-center justify-center text-brand-accent group-hover:scale-110 transition-transform">
        {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
      </div>
      <span className="text-sm font-bold text-white/90">{label}</span>
    </button>
  );
}

function LoanStatusBadge({ loan, showOverdueDays }: { loan: Loan, showOverdueDays?: boolean }) {
  if (loan.returnDate) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
        Devolvido
      </span>
    );
  }

  const overdue = isAfter(new Date(), parseISO(loan.dueDate));
  const days = differenceInDays(new Date(), parseISO(loan.dueDate));

  if (overdue) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">
          Atrasado
        </span>
        {showOverdueDays && <span className="text-[10px] font-bold text-rose-500">{days} dias de atraso</span>}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
      Em Aberto
    </span>
  );
}

function BookForm({ editingBook, onSubmit }: { editingBook: Book | null, onSubmit: (e: React.FormEvent<HTMLFormElement>) => void }) {
  const [hasCollection, setHasCollection] = useState<boolean>(!!editingBook?.collection);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="col-span-2 space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Título do Livro</label>
          <input name="title" defaultValue={editingBook?.title} required className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all font-bold text-sm" placeholder="Ex: O Senhor dos Anéis" />
        </div>
        <div className="col-span-2 space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Autor</label>
          <input name="author" defaultValue={editingBook?.author} required className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all font-bold text-sm" placeholder="Ex: J.R.R. Tolkien" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ISBN</label>
          <input name="isbn" defaultValue={editingBook?.isbn} required className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all font-bold text-sm font-mono" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Código de Barras</label>
          <input name="barcode" defaultValue={editingBook?.barcode} placeholder="Ex: 7891234567890" className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all font-bold text-sm font-mono" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Editora</label>
          <input name="publisher" defaultValue={editingBook?.publisher} required className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all font-bold text-sm" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Lançamento</label>
          <input name="year" type="number" defaultValue={editingBook?.year} required className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all font-bold text-sm" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Edição</label>
          <input name="editionYear" type="number" defaultValue={editingBook?.editionYear} required className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all font-bold text-sm" />
        </div>
        <div className="col-span-2 space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Localização Física</label>
          <input name="location" defaultValue={editingBook?.location} required placeholder="Ex: Corredor A, Prateleira 2" className="w-full px-5 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all font-bold text-sm" />
        </div>

        {/* Collection Toggle */}
        <div className="col-span-2 space-y-3">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-transparent">
            <div>
              <p className="text-sm font-bold text-slate-700">Este livro pertence a uma coleção?</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Ex: Harry Potter, Narnia, Percy Jackson...</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input type="hidden" name="hasCollection" value={hasCollection ? 'yes' : 'no'} />
              <button
                type="button"
                onClick={() => setHasCollection(false)}
                className={cn("px-4 py-2 rounded-xl font-bold text-xs transition-all", !hasCollection ? "bg-rose-100 text-rose-600" : "bg-white text-slate-400 hover:bg-slate-100")}
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => setHasCollection(true)}
                className={cn("px-4 py-2 rounded-xl font-bold text-xs transition-all", hasCollection ? "bg-brand-accent/15 text-brand-accent" : "bg-white text-slate-400 hover:bg-slate-100")}
              >
                Sim
              </button>
            </div>
          </div>
          <AnimatePresence>
            {hasCollection && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome da Coleção</label>
                  <input name="collection" defaultValue={editingBook?.collection} required={hasCollection} placeholder="Ex: Harry Potter" className="w-full px-5 py-3.5 bg-slate-50 border-2 border-brand-accent/20 rounded-2xl focus:bg-white outline-none transition-all font-bold text-sm" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <button type="submit" className="w-full bg-brand-accent text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-xl shadow-brand-accent/20 mt-4">
        {editingBook ? "Salvar Alterações" : "Cadastrar Livro"}
      </button>
    </form>
  );
}

function SearchableBookSelect({ books, defaultValue }: { books: Book[], defaultValue?: string }) {
  const [selectedId, setSelectedId] = useState(defaultValue || '');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedBook = books.find(b => b.id === selectedId);
  const filteredBooks = useMemo(() => {
    const q = search.toLowerCase();
    return books
      .filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.isbn.includes(q) ||
        (b.barcode || '').includes(q) ||
        b.author.toLowerCase().includes(q)
      )
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  }, [books, search]);

  return (
    <div className="relative">
      <input type="hidden" name="bookId" value={selectedId} required />
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-5 py-3.5 bg-slate-50 border-2 rounded-2xl flex items-center justify-between cursor-pointer transition-all",
          isOpen ? "bg-white border-brand-accent/20 shadow-lg shadow-brand-accent/5" : "border-transparent hover:bg-slate-100/80",
          !selectedBook && "text-slate-400"
        )}
      >
        <span className="font-bold text-sm truncate">
          {selectedBook ? `${selectedBook.title}` : "Selecione um livro..."}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-300", isOpen && "rotate-180 text-brand-accent")} />
      </div>
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Pesquisar por título, ISBN ou código..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-brand-accent/40 focus:ring-2 focus:ring-brand-accent/10 outline-none transition-all"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                {filteredBooks.length > 0 ? (
                  filteredBooks.map(book => (
                    <div
                      key={book.id}
                      onClick={() => { setSelectedId(book.id); setIsOpen(false); setSearch(''); }}
                      className={cn(
                        "px-4 py-3 rounded-xl cursor-pointer transition-all flex flex-col gap-0.5",
                        selectedId === book.id ? "bg-brand-accent/10 text-brand-accent" : "hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <span className="font-bold text-sm">{book.title}</span>
                      <span className="text-xs font-medium opacity-70">{book.author} · ISBN {book.isbn}</span>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-slate-400 text-sm font-medium">Nenhum livro encontrado</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SearchableStudentSelect({
  students,
  value,
  onChange,
  error
}: {
  students: Student[],
  value: string,
  onChange: (id: string) => void,
  error?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedStudent = students.find(s => s.id === value);
  const filteredStudents = useMemo(() => {
    return students.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.class.toLowerCase().includes(search.toLowerCase())
    );
  }, [students, search]);

  return (
    <div className="relative">
      <input type="hidden" name="studentId" value={value} required />

      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-5 py-3.5 bg-slate-50 border-2 rounded-2xl flex items-center justify-between cursor-pointer transition-all",
          isOpen ? "bg-white border-brand-accent/20 shadow-lg shadow-brand-accent/5" : "border-transparent hover:bg-slate-100/80",
          error && "border-rose-300 bg-rose-50",
          !selectedStudent && "text-slate-400"
        )}
      >
        <span className="font-bold text-sm truncate">
          {selectedStudent ? `${selectedStudent.name} - ${selectedStudent.class}` : "Selecione um aluno cadastrado..."}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-300", isOpen && "rotate-180 text-brand-accent")} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Pesquisar por nome ou turma..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-brand-accent/40 focus:ring-2 focus:ring-brand-accent/10 outline-none transition-all"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map(student => (
                    <div
                      key={student.id}
                      onClick={() => {
                        onChange(student.id);
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className={cn(
                        "px-4 py-3 rounded-xl cursor-pointer transition-all flex flex-col gap-0.5",
                        value === student.id
                          ? "bg-brand-accent/10 text-brand-accent"
                          : "hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <span className="font-bold text-sm">{student.name}</span>
                      <span className="text-xs font-medium opacity-70">{student.class}</span>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-slate-400 text-sm font-medium">
                    Nenhum aluno encontrado
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white/95 backdrop-blur-2xl w-full max-w-lg rounded-[2.5rem] shadow-[0_0_40px_-10px_rgba(0,0,0,0.15)] overflow-hidden border border-white/60"
          >
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-brand-accent/5 to-transparent pointer-events-none" />
            <div className="p-8 pb-6 border-b border-slate-100/50 flex justify-between items-center relative z-10">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">{title}</h3>
              <button onClick={onClose} className="p-2.5 bg-slate-100/50 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-2xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar relative z-10">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ConfirmModal({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string, message: string }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-8">
        <div className="flex items-center gap-5 text-rose-600 bg-rose-50 p-6 rounded-3xl border border-rose-100">
          <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-2xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-6 py-4 rounded-2xl font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-xl shadow-rose-200"
          >
            Confirmar Exclusão
          </button>
        </div>
      </div>
    </Modal>
  );
}
