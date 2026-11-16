import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FoodBackdrop from '../../components/FoodBackdrop';
import { getStats, listBatches, type Batch, type Stats } from '../../lib/api';

function statusLabel(status: string) {
  return status.replace('_', ' ');
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-[#f3f9d8] text-[#557c16]',
  pending: 'bg-[#fff3d0] text-[#a1720f]',
  dispatched: 'bg-[#d7f5ee] text-[#0f766e]',
  claimed: 'bg-[#e9f4e4] text-[#557c16]',
  picked_up: 'bg-[#d7f5ee] text-[#0f766e]',
  delivered: 'bg-[#e9f4e4] text-[#557c16]',
  expired: 'bg-[#ffe9ea] text-[#b23c26]',
  at_risk: 'bg-[#ffe9ea] text-[#b23c26]',
};

export default function SupplierDashboard() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [nextBatches, nextStats] = await Promise.all([listBatches(), getStats()]);
      setBatches(nextBatches);
      setStats(nextStats);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Supply activity is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const active = batches.filter((batch) => !['delivered', 'expired'].includes(batch.status));
  const rescued = batches.filter((batch) => ['delivered', 'picked_up'].includes(batch.status));

  return (
    <div className="relative overflow-hidden">
      <FoodBackdrop opacity={0.25} />
      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <section className="grid items-end gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <p className="eyebrow">Supplier workspace</p>
            <h1 className="mt-3 max-w-3xl font-display text-5xl font-bold leading-[0.98] tracking-[-0.05em] sm:text-6xl">
              Move surplus out of your kitchen.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#4c6a5e]">
              Scan a tray, review the safety window, and keep an eye on the handoff until a distributor collects it.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/donor" className="btn-pop btn-dark rounded-full px-6 py-3 font-bold">Create food request →</Link>
              <button type="button" onClick={() => void load()} className="rounded-full border border-[#cbd8c9] bg-white px-5 py-3 text-sm font-bold text-[#557267]">Refresh activity</button>
            </div>
          </div>
          <div className="rounded-[2rem] bg-[#18342b] p-6 text-white shadow-[0_20px_50px_rgba(24,52,43,0.16)]">
            <span className="eyebrow text-[#d9f06d]">Supplier promise</span>
            <p className="mt-3 font-display text-3xl font-bold leading-tight">One photo in. A safer handoff out.</p>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/15 pt-5 text-center">
              <div><strong className="block font-display text-2xl">{active.length}</strong><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">Active</span></div>
              <div><strong className="block font-display text-2xl">{rescued.length}</strong><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">Collected</span></div>
              <div><strong className="block font-display text-2xl">{stats?.meals ?? 0}</strong><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">Meals</span></div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Meals rescued" value={stats?.meals.toLocaleString() ?? '—'} icon="🍽" bg="#e9f4e4" />
          <Metric label="Food diverted" value={stats ? `${stats.kg.toFixed(1)} kg` : '—'} icon="♻" bg="#d7f5ee" />
          <Metric label="Live handoffs" value={active.length.toString()} icon="↗" bg="#fff3d0" />
          <Metric label="Delivered batches" value={stats?.delivered_batches.toString() ?? '—'} icon="✓" bg="#f3f9d8" />
        </section>

        {error && <div className="mt-6 rounded-2xl bg-[#fff0ed] px-5 py-4 text-sm font-semibold text-[#b94e3a]">{error}<button type="button" onClick={() => void load()} className="ml-3 underline">Retry</button></div>}

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.5fr_0.8fr]">
          <div className="rounded-[2rem] border border-[#dfe7dc] bg-white p-6">
            <div className="flex items-end justify-between gap-4">
              <div><p className="eyebrow">Handoff activity</p><h2 className="mt-2 font-display text-3xl font-bold">Where your food is now</h2></div>
              <span className="text-xs font-semibold text-[#9aafa3]">Auto-refresh · 10 sec</span>
            </div>
            {loading ? <div className="mt-6 space-y-3"><div className="skeleton h-20" /><div className="skeleton h-20" /></div> : batches.length ? (
              <div className="mt-6 space-y-3">
                {batches.slice(0, 8).map((batch) => (
                  <Link key={batch.id} to={`/requests/${batch.id}`} className="flex items-center gap-4 rounded-2xl border border-[#e4eadf] bg-[#fffdf5] p-4 transition hover:-translate-y-0.5 hover:border-[#9ebc45]">
                    {batch.image_url ? <img src={batch.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#e9f4e4] text-xl">🍲</div>}
                    <div className="min-w-0 flex-1"><strong className="block truncate font-display text-lg">{batch.items.map((item) => item.name).join(' + ') || 'Food details needed'}</strong><span className="text-xs text-[#729082]">{batch.portions} portions · {batch.total_kg.toFixed(1)} kg · {batch.remaining_min} min left</span></div>
                    <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] ${STATUS_STYLE[batch.status] ?? 'bg-[#edf4e5] text-[#557c16]'}`}>{statusLabel(batch.status)}</span>
                  </Link>
                ))}
              </div>
            ) : <div className="mt-6 rounded-2xl border border-dashed border-[#cbd8c9] p-10 text-center"><div className="text-3xl">🥕</div><h3 className="mt-3 font-display text-xl font-bold">No food requests yet</h3><p className="mt-1 text-sm text-[#729082]">Start with one photo from your kitchen.</p></div>}
          </div>

          <aside className="space-y-5">
            <div className="rounded-[2rem] bg-[#d7f5ee] p-6">
              <p className="eyebrow">Before you send</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-[#18342b]">A clean handoff checklist</h2>
              <ul className="mt-5 space-y-4 text-sm leading-6 text-[#0f5f56]">
                <li><span className="mr-2 font-bold">01</span> Keep the food covered and chilled.</li>
                <li><span className="mr-2 font-bold">02</span> Add a clear food name if the scan needs help.</li>
                <li><span className="mr-2 font-bold">03</span> Watch for the distributor pickup status.</li>
              </ul>
            </div>
            <div className="rounded-[2rem] border border-[#dfe7dc] bg-[#fffdf5] p-6">
              <p className="eyebrow">Need to move quickly?</p>
              <p className="mt-2 text-sm leading-6 text-[#4c6a5e]">The scanner estimates a conservative safety window from the food type and local weather. When in doubt, use the shorter window.</p>
              <Link to="/donor" className="mt-4 inline-block text-sm font-bold text-[#0f766e] underline">Open scanner →</Link>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, icon, bg }: { label: string; value: string; icon: string; bg: string }) {
  return <div className="rounded-2xl border border-[#efe9d8] p-5 text-center shadow-sm" style={{ backgroundColor: bg }}><span className="text-xl">{icon}</span><strong className="mt-2 block font-display text-3xl font-bold">{value}</strong><span className="mt-1 block text-xs font-bold uppercase tracking-[0.1em] text-[#729082]">{label}</span></div>;
}
