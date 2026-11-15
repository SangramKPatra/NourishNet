import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-[#f7f7f2] text-[#18342b]">
      <header className="sticky top-0 z-20 border-b border-[#dfe7dc] bg-[#fdfbf3]/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="NourishNet home">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#d9f06d] to-[#00bfa5] text-xl shadow-sm">🍲</span>
            <span>
              <span className="block font-display text-xl font-bold leading-none tracking-tight">NourishNet</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-[#0f766e]">Rescue before it spoils</span>
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden max-w-[200px] truncate rounded-full bg-[#edf4e5] px-3 py-2 text-xs font-bold text-[#557c16] sm:block">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-[#dfe7dc] bg-white px-4 py-2 text-sm font-bold text-[#729082] transition hover:border-[#cf5d45] hover:text-[#cf5d45]"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="rounded-full border border-[#0f766e]/30 bg-white px-4 py-2 text-sm font-bold text-[#0f766e] transition hover:bg-[#d7f5ee]"
                >
                  Sign in
                </Link>
                <Link
                  to="/auth"
                  className="rounded-full bg-[#18342b] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0f766e]"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-[#e4eadf] bg-[#fdfbf3]">
        <div className="mx-auto max-w-6xl px-5 py-8 text-xs font-medium text-[#729082] sm:px-8">
          NourishNet · Food rescue infrastructure for everyday surplus
        </div>
      </footer>
    </div>
  );
}