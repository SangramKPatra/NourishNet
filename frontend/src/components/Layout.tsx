import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f7f2] text-[#18342b]">
      <header className="sticky top-0 z-20 border-b border-[#dfe7dc] bg-[#f7f7f2]/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <NavLink to="/donor" className="flex items-center gap-3" aria-label="NourishNet home">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#d9f06d] text-xl shadow-sm">🍲</span>
            <span>
              <span className="block font-display text-xl font-bold leading-none tracking-tight">NourishNet</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-[#729082]">Rescue before it spoils</span>
            </span>
          </NavLink>
          <nav className="flex items-center gap-1 rounded-full border border-[#dfe7dc] bg-white p-1 text-sm font-semibold shadow-sm">
            <NavLink to="/donor" className={({ isActive }) => `rounded-full px-3 py-2 transition ${isActive ? 'bg-[#18342b] text-white' : 'text-[#729082] hover:text-[#18342b]'}`}>Donate</NavLink>
            <NavLink to="/dashboard" className={({ isActive }) => `rounded-full px-3 py-2 transition ${isActive ? 'bg-[#18342b] text-white' : 'text-[#729082] hover:text-[#18342b]'}`}>Dashboard</NavLink>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mx-auto max-w-6xl px-5 py-8 text-xs font-medium text-[#729082] sm:px-8">
        NourishNet · Food rescue infrastructure for everyday surplus
      </footer>
    </div>
  );
}
