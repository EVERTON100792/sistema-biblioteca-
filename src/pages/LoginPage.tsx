import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Library, Mail, Lock, Eye, EyeOff, AlertCircle, BookOpen } from 'lucide-react';

type AuthMode = 'login' | 'signup';

interface LoginPageProps {
    onAuthSuccess: () => void;
}

export function LoginPage({ onAuthSuccess }: LoginPageProps) {
    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);
        setLoading(true);

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onAuthSuccess();
            } else {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setSuccessMsg('Conta criada! Verifique seu email para confirmar o cadastro.');
                setMode('login');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido';
            if (msg.includes('Invalid login credentials')) {
                setError('Email ou senha incorretos.');
            } else if (msg.includes('already registered')) {
                setError('Este email já está cadastrado. Faça login.');
                setMode('login');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient blobs */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-900/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="relative w-full max-w-md">
                {/* Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden">

                    {/* Header gradient strip */}
                    <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500" />

                    <div className="p-10">
                        {/* Logo */}
                        <div className="flex flex-col items-center gap-4 mb-10">
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-400/30 rounded-2xl blur-xl" />
                                <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl">
                                    <BookOpen className="w-8 h-8 text-white" />
                                </div>
                            </div>
                            <div className="text-center">
                                <h1 className="text-2xl font-bold text-white tracking-tight">BiblioControl</h1>
                                <p className="text-emerald-400/70 text-sm font-medium mt-0.5">Gestão Inteligente de Biblioteca</p>
                            </div>
                        </div>

                        {/* Tab toggle */}
                        <div className="flex bg-white/5 rounded-2xl p-1 mb-8 border border-white/10">
                            {(['login', 'signup'] as AuthMode[]).map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => { setMode(m); setError(null); setSuccessMsg(null); }}
                                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${mode === m
                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20'
                                            : 'text-white/40 hover:text-white/70'
                                        }`}
                                >
                                    {m === 'login' ? 'Entrar' : 'Criar Conta'}
                                </button>
                            ))}
                        </div>

                        {/* Error / Success */}
                        {error && (
                            <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-2xl mb-6 text-sm font-medium">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-2xl mb-6 text-sm font-medium">
                                <Library className="w-4 h-4 shrink-0" />
                                {successMsg}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Email */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        placeholder="seu@email.com"
                                        className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 font-medium text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Senha</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        placeholder="Mínimo 6 caracteres"
                                        className="w-full pl-11 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 font-medium text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-2 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:from-emerald-400 hover:to-teal-400 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Aguarde...
                                    </span>
                                ) : mode === 'login' ? 'Entrar no Sistema' : 'Criar Minha Conta'}
                            </button>
                        </form>
                    </div>
                </div>

                <p className="text-center text-white/20 text-xs font-medium mt-6">
                    Dados protegidos com criptografia Supabase
                </p>
            </div>
        </div>
    );
}
