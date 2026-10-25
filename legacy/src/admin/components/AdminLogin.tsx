import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fn = mode === 'login'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });
    const { error: err } = await fn;
    setLoading(false);
    if (err) setError(err.message);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-600 mb-4">
            <Lock size={22} className="text-white" />
          </div>
          <h1 className="text-white font-bold text-2xl mb-1">UltraPet CMS</h1>
          <p className="text-slate-400 text-sm">{mode === 'login' ? 'Sign in to manage your website' : 'Create an admin account'}</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 text-red-300 text-sm px-4 py-3 mb-5 rounded">
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs font-semibold tracking-widest uppercase mb-2">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="admin@example.com"
                className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-600 text-sm px-4 py-3 ps-10 focus:outline-none focus:border-red-600 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-semibold tracking-widest uppercase mb-2">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-600 text-sm px-4 py-3 ps-10 pe-10 focus:outline-none focus:border-red-600 transition-colors"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm py-3 transition-colors flex items-center justify-center gap-2">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</> : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-6">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="text-red-400 hover:text-red-300 transition-colors">
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
