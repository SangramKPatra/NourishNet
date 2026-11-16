import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStats, listBatches, type Batch, type Stats } from '../../lib/api';
import FoodBackdrop from '../../components/FoodBackdrop';

const SDGS = [
  { n: 2, label: 'Zero Hunger', color: '#e5243b', bg: '#ffe9ea' },
  { n: 11, label: 'Sustainable Cities', color: '#fd9d24', bg: '#fff3e2' },
  { n: 12, label: 'Responsible Consumption', color: '#bf8b2e', bg: '#fdf6e3' },
  { n: 13, label: 'Climate Action', color: '#3f7e44', bg: '#e9f4e4' },
];

const WHAT = [
  { icon: '📸', t: 'Scan', d: 'Photo → AI draft', bg: '#d7f5ee' },
  { icon: '🌡', t: 'Safety', d: 'Weather-aware window', bg: '#e9f4e4' },
  { icon: '🚴', t: 'Dispatch', d: 'Alert nearby volunteers', bg: '#f3f9d8' },
  { icon: '🏠', t: 'Deliver', d: 'Shelter gets food', bg: '#fff3d0' },
];

function countdown(min: number) {
  if (min <= 0) return 'Expired';
  const h = Math.floor(min / 60);
  return h ? `${h}h ${String(min % 60).padStart(2, '0')}m` : `${min} min`;
}

function urgencyOf(b: Batch) {
  const win = b.safe_window_min ?? 30;
  if (b.remaining_min <= win * 0.25) return 'critical';
  if (b.remaining_min <= win * 0.5) return 'watch';
  return 'safe';
}

const URGENCY_STYLE: Record<string, { bar: string; text: string; label: string }> = {
  safe: { bar: 'bg-[#83b31c]', text: 'text-[#557c16]', label: 'Safe' },
  watch: { bar: 'bg-[#d39a2d]', text: 'text-[#a1720f]', label: 'Watch' },
  critical: { bar: 'bg-[#cf5d45]', text: 'text-[#b23c26]', label: 'Critical' },
};

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [live, setLive] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, b] = await Promise.all([getStats(), listBatches()]);
        setStats(s);
        setBatches(b.slice(0, 4));
      } catch { setLive(false); }
    };
    load();
    const id = window.setInterval(load, 10000);
    return () => window.clearInterval(id);
  }, []);

  const demoBatches = batches.filter((b) => b.is_demo).length;
  const realBatches = batches.length - demoBatches;
  const avgWindow = batches.length
    ? Math.round(batches.reduce((a, b) => a + (b.safe_window_min ?? 0), 0) / batches.length)
    : 0;

  return (
    <div className="relative overflow-hidden bg-[#f7f7f2]">
      <FoodBackdrop opacity={0.5} />
      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#00bfa5] opacity-15 blur-3xl" />
      <div className="absolute top-1/3 -left-32 h-64 w-64 rounded-full bg-[#93c51b] opacity-10 blur-3xl" />
      <div className="absolute bottom-0 right-1/4 h-56 w-56 rounded-full bg-[#d9f06d] opacity-20 blur-3xl" />

      {/* ── Above the fold: mission, objective, SDGs, what we do ── */}
      <section className="relative mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl flex-col justify-center px-5 py-10 sm:px-8">
        <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[#0f766e]/30 bg-[#d7f5ee] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#0f766e] shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[#ffd93d]" /> Food rescue infrastructure
        </div>

        <h1 className="max-w-4xl font-display text-4xl font-bold leading-[1.02] tracking-[-0.05em] text-[#18342b] sm:text-6xl">
          Turn tonight’s surplus into <span className="grad-text">someone’s dinner.</span>
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#4c6a5e] sm:text-lg">
          Our mission: eliminate inventory friction and cold-chain delays by turning one smartphone photo of leftover trays into a verified, routed logistics dispatch within 30 seconds — so everyday institutional surplus reaches shelters before it spoils.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#0f766e]">SDGs:</span>
          {SDGS.map((s) => (
            <span key={s.n} className="rounded-full px-3 py-1 text-xs font-bold shadow-sm" style={{ backgroundColor: s.bg, color: s.color }}>
              SDG {s.n} · {s.label}
            </span>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {WHAT.map((w) => (
            <div key={w.t} className="rounded-2xl border border-[#dfe7dc] p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:-rotate-1 hover:shadow-lg" style={{ backgroundColor: w.bg }}>
              <span className="text-2xl transition-transform duration-300 hover:scale-125">{w.icon}</span>
              <h3 className="mt-2 font-display text-sm font-bold text-[#18342b]">{w.t}</h3>
              <p className="mt-0.5 text-xs text-[#4c6a5e]">{w.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/auth?mode=signup" className="btn-pop btn-dark rounded-full px-6 py-3 text-sm font-bold">Sign up to donate</Link>
          <Link to="/donor" className="btn-pop rounded-full border border-[#dfe7dc] bg-[#fffdf5] px-6 py-3 text-sm font-bold text-[#18342b] transition hover:bg-[#d9f06d]">Try demo donor</Link>
        </div>
      </section>

      {/* ── Below the fold: dashboard ── */}
      <section className="relative border-t border-[#e4eadf] bg-[#fdfbf3] py-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Command center</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.04em] text-[#18342b] sm:text-4xl">Live dashboard</h2>
              <p className="mt-1 text-sm text-[#4c6a5e]">Surplus moving from kitchens to community shelters — right now.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${live ? 'bg-[#d7f5ee] text-[#0f766e]' : 'bg-[#ffe9ea] text-[#b23c26]'}`}>
              {live ? '● Live · 10s refresh' : 'Offline — demo data'}
            </span>
          </div>

          {/* Impact counters */}
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: '🍽', v: stats ? stats.meals.toLocaleString() : '—', l: 'Meals rescued', bg: '#e9f4e4' },
              { icon: '♻', v: stats ? `${stats.kg.toFixed(1)} kg` : '—', l: 'Kg diverted', bg: '#d7f5ee' },
              { icon: '🌱', v: stats ? `${stats.co2e_kg.toFixed(1)} kg` : '—', l: 'CO₂e avoided', bg: '#f3f9d8' },
              { icon: '⌛', v: stats ? String(stats.active_batches) : '—', l: 'Active batches', bg: '#fff3d0' },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-[#efe9d8] p-5 text-center shadow-sm" style={{ backgroundColor: s.bg }}>
                <span className="text-xl">{s.icon}</span>
                <strong className="mt-2 block font-display text-3xl font-bold text-[#18342b]">{s.v}</strong>
                <span className="mt-1 block text-xs font-bold uppercase tracking-[0.1em] text-[#4c6a5e]">{s.l}</span>
              </div>
            ))}
          </div>

          {/* Breakdown + queue */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="cream-card">
              <span className="eyebrow">Queue breakdown</span>
              <div className="mt-4 space-y-3">
                {[
                  { l: 'Live batches', v: batches.length, c: '#83b31c' },
                  { l: 'Demo batches', v: demoBatches, c: '#d39a2d' },
                  { l: 'Real batches', v: realBatches, c: '#00bfa5' },
                  { l: 'Delivered (all time)', v: stats?.delivered_batches ?? 0, c: '#0f766e' },
                ].map((r) => (
                  <div key={r.l} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold text-[#4c6a5e]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.c }} />{r.l}</span>
                    <strong className="font-display text-lg text-[#18342b]">{r.v}</strong>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-[#efe9d8] pt-3 text-sm">
                  <span className="font-semibold text-[#4c6a5e]">Avg safety window</span>
                  <strong className="font-display text-lg text-[#0f766e]">{avgWindow ? `${avgWindow} min` : '—'}</strong>
                </div>
              </div>
            </div>

            <div className="cream-card lg:col-span-2">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Active rescue queue</span>
                <span className="teal-chip">{batches.length} shown</span>
              </div>
              <div className="mt-4 space-y-3">
                {batches.length ? batches.map((b) => {
                  const u = urgencyOf(b);
                  const st = URGENCY_STYLE[u];
                  const pct = b.safe_window_min ? Math.max(0, Math.min(100, (b.remaining_min / b.safe_window_min) * 100)) : 0;
                  return (
                    <article key={b.id} className="rounded-xl border border-[#dfe7dc] bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`status-dot ${u}`} />
                            <span className="status-chip">{b.status.replace('_', ' ')}</span>
                            <span className="tier-chip">{b.tier.replace('_', ' ')}</span>
                            {b.is_demo && <span className="demo-chip">Demo</span>}
                          </div>
                          <h3 className="mt-2 font-display text-base font-bold text-[#18342b]">{b.items.map((i) => i.name).join(' + ') || 'Manual entry needed'}</h3>
                          <p className="mt-1 text-xs text-[#4c6a5e]">
                            {b.portions} portions · {b.total_kg.toFixed(1)} kg
                            {b.ambient_temp_c != null && ` · ${Math.round(b.ambient_temp_c)}°C / ${b.humidity_pct}% humidity`}
                            {b.weather_source && ` · ${b.weather_source}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="eyebrow">Window</span>
                          <strong className={`mt-0.5 block font-display text-2xl ${st.text}`}>{countdown(b.remaining_min)}</strong>
                          <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${st.text}`}>{st.label}</span>
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#eef2e8]">
                        <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aafa3]">
                        {pct.toFixed(0)}% of safety window remaining
                      </p>
                    </article>
                  );
                }) : (
                  <div className="rounded-[2rem] border border-dashed border-[#cbd8c9] bg-[#fffdf5] p-10 text-center">
                    <div className="text-3xl">🥕</div>
                    <h3 className="mt-3 font-display text-xl font-bold text-[#18342b]">The queue is clear</h3>
                    <p className="mt-1 text-sm text-[#4c6a5e]">Newly scanned food will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link to="/dashboard" className="btn-pop btn-dark rounded-full px-6 py-3 text-sm font-bold">Open full dashboard →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}