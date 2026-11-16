import { useCallback, useEffect, useState } from 'react';
import { getStats, listBatches, pickupBatch, type Batch, type Stats } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import SupplierDashboard from '../supplier/page';
import FoodBackdrop from '../../components/FoodBackdrop';

function countdown(minutes: number) {
  if (minutes <= 0) return 'Expired';
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes} min`;
}

function statusLabel(status: string) {
  return status.replace('_', ' ');
}

function urgencyOf(batch: Batch) {
  const win = batch.safe_window_min ?? 30;
  if (batch.remaining_min <= Math.max(15, win * 0.25)) return 'critical';
  if (batch.remaining_min <= win * 0.5) return 'watch';
  return 'safe';
}

const URGENCY = {
  safe: { bar: 'bg-[#83b31c]', text: 'text-[#557c16]', chip: 'bg-[#edf4e5] text-[#557c16]', label: 'Safe' },
  watch: { bar: 'bg-[#d39a2d]', text: 'text-[#a1720f]', chip: 'bg-[#fff3d0] text-[#a76e16]', label: 'Watch' },
  critical: { bar: 'bg-[#cf5d45]', text: 'text-[#b23c26]', chip: 'bg-[#ffe9ea] text-[#b23c26]', label: 'Critical' },
} as const;

function BatchCard({ batch, onOpen }: { batch: Batch; onOpen: (batch: Batch) => void }) {
  const [remaining, setRemaining] = useState(batch.remaining_min);
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const urgency = urgencyOf({ ...batch, remaining_min: remaining });
  const st = URGENCY[urgency];
  const pct = batch.safe_window_min ? Math.max(0, Math.min(100, (remaining / batch.safe_window_min) * 100)) : 0;
  return (
    <article className="rounded-2xl border border-[#dfe7dc] border-l-4 bg-white p-5 shadow-[0_8px_24px_rgba(24,52,43,0.04)]" style={{ borderLeftColor: urgency === 'critical' ? '#cf5d45' : urgency === 'watch' ? '#d39a2d' : '#83b31c' }}>
      <div className="flex items-start justify-between gap-4">
        {batch.image_url && <img src={batch.image_url} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${st.bar}`} />
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${st.chip}`}>{statusLabel(batch.status)}</span>
            <span className="rounded-full bg-[#d7f5ee] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0f766e]">{batch.tier.replace('_', ' ')}</span>
            {batch.is_demo && <span className="rounded-full bg-[#fff3d0] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#a76e16]">Demo</span>}
          </div>
          <button type="button" onClick={() => onOpen(batch)} className="mt-4 block text-left font-display text-2xl font-bold hover:text-[#0f766e]">{batch.items.map((item) => item.name).join(' + ') || 'Manual entry needed'}</button>
          <p className="mt-1 text-sm text-[#729082]">{batch.portions} portions · {batch.total_kg.toFixed(1)} kg · {batch.tier.replace('_', ' ')}</p>
          <p className="mt-1 text-xs text-[#9aafa3]">{batch.ambient_temp_c != null ? `${Math.round(batch.ambient_temp_c)}°C · ${batch.humidity_pct}% humidity · ${batch.weather_source ?? 'unknown'}` : 'Weather data unavailable'}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="eyebrow">Pickup window</span>
          <strong className={`mt-1 block font-display text-3xl ${st.text}`}>{countdown(remaining)}</strong>
          <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${st.text}`}>{st.label}</span>
        </div>
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#eef2e8]">
        <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e4eadf] pt-4 text-xs font-semibold text-[#729082]">
        <span>Weather {batch.ambient_temp_c ? `${Math.round(batch.ambient_temp_c)}°C` : '—'} · {batch.weather_source ?? 'unknown'}</span>
        <span>{batch.shelter ? `Shelter: ${batch.shelter.name}` : 'Finding a shelter…'}</span>
        <span>{pct.toFixed(0)}% window left</span>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const { user, ready } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const [nextBatches, nextStats] = await Promise.all([listBatches(), getStats()]);
      setBatches(nextBatches);
      setStats(nextStats);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dashboard is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 5000); return () => window.clearInterval(timer); }, [load]);

  if (ready && user?.role === 'supplier') return <SupplierDashboard />;

  const filtered = filter ? batches.filter((b) => b.status === filter) : batches;
  const counts = batches.reduce<Record<string, number>>((acc, b) => { acc[b.status] = (acc[b.status] ?? 0) + 1; return acc; }, {});

  return (
    <div className="relative overflow-hidden">
      <FoodBackdrop opacity={0.3} />
      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Command center</p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-[-0.05em]">Food in <span className="grad-text">motion.</span></h1>
          <p className="mt-3 text-[#729082]">Live view of surplus moving from kitchens to community shelters.</p>
        </div>
        <button onClick={() => void load()} className="btn-pop self-start rounded-full border border-[#cbd8c9] bg-white px-4 py-2 text-sm font-bold text-[#557267] hover:border-[#18342b]">↻ Refresh</button>
      </div>

      {stats && (
        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Meals rescued" value={stats.meals.toLocaleString()} icon="🍽" bg="#e9f4e4" />
          <Stat label="Kg diverted" value={stats.kg.toFixed(1)} icon="♻" bg="#d7f5ee" />
          <Stat label="CO₂e avoided" value={`${stats.co2e_kg.toFixed(1)} kg`} icon="🌱" bg="#f3f9d8" />
          <Stat label="Active batches" value={stats.active_batches.toString()} icon="⌛" bg="#fff3d0" />
        </div>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#dfe7dc] bg-[#fffdf5] p-5">
            <span className="eyebrow">Filter queue</span>
            <div className="mt-3 flex flex-wrap gap-2">
              {['', 'pending', 'dispatched', 'claimed', 'picked_up', 'delivered', 'expired', 'at_risk'].map((s) => (
                <button key={s || 'all'} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === s ? 'bg-[#18342b] text-white' : 'border border-[#dfe7dc] bg-white text-[#4c6a5e] hover:border-[#18342b]'}`}>
                  {s || 'All'}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-[#efe9d8] pt-4">
              {Object.entries(counts).map(([s, c]) => (
                <div key={s} className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[#4c6a5e] capitalize">{statusLabel(s)}</span>
                  <strong className="font-display">{c}</strong>
                </div>
              ))}
              {Object.keys(counts).length === 0 && <p className="text-xs text-[#9aafa3]">No batches yet.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-[#dfe7dc] bg-[#d7f5ee] p-5">
            <span className="eyebrow">How urgency works</span>
            <p className="mt-2 text-sm leading-6 text-[#0f5f56]">Green = over 50% of the safety window left · Amber = 25–50% · Red = under 25%. High-urgency batches get escalated Telegram alerts.</p>
          </div>

          <div className="rounded-2xl border border-[#dfe7dc] bg-[#e9f4e4] p-5">
            <span className="eyebrow">Impact split</span>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="font-semibold text-[#4c6a5e]">Demo meals</span><strong>{stats?.demo.meals.toLocaleString() ?? '—'}</strong></div>
              <div className="flex justify-between"><span className="font-semibold text-[#4c6a5e]">Real meals</span><strong>{stats?.real.meals.toLocaleString() ?? '—'}</strong></div>
              <div className="flex justify-between border-t border-[#cfe3c4] pt-2"><span className="font-semibold text-[#4c6a5e]">Delivered batches</span><strong>{stats?.delivered_batches ?? '—'}</strong></div>
            </div>
          </div>
        </aside>

        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Live dispatches</p>
              <h2 className="mt-2 font-display text-3xl font-bold">Today’s rescue queue</h2>
            </div>
            <span className="text-xs font-semibold text-[#729082]">Auto-refresh · 5 sec</span>
          </div>
          {error && <div className="mt-6 rounded-2xl bg-[#fff0ed] px-5 py-4 text-sm font-semibold text-[#b94e3a]">{error}<button onClick={() => void load()} className="ml-3 underline">Retry</button></div>}
          {loading ? (
            <div className="mt-6 grid gap-4"><div className="skeleton h-48" /><div className="skeleton h-48" /></div>
          ) : filtered.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">{filtered.map((batch) => <BatchCard key={batch.id} batch={batch} onOpen={setSelected} />)}</div>
          ) : (
            <div className="mt-6 rounded-[2rem] border border-dashed border-[#cbd8c9] bg-white p-12 text-center">
              <div className="text-4xl">🥕</div>
              <h3 className="mt-4 font-display text-2xl font-bold">The queue is clear</h3>
              <p className="mt-2 text-sm text-[#729082]">Newly scanned food will appear here.</p>
            </div>
          )}
        </div>
        {selected && <BatchDetailsModal batch={selected} onClose={() => setSelected(null)} onUpdated={(next) => { setSelected(next); void load(); }} />}
      </div>
      </div>
    </div>
  );
}

function BatchDetailsModal({ batch, onClose, onUpdated }: { batch: Batch; onClose: () => void; onUpdated: (batch: Batch) => void }) {
  const { user, token } = useAuth();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const canPickUp = user?.role === 'distributor' && ['pending', 'dispatched', 'at_risk', 'claimed'].includes(batch.status);

  const markPickingUp = async () => {
    if (!token) return;
    setWorking(true);
    setError('');
    try {
      const result = await pickupBatch(batch.id, token);
      onUpdated(result.batch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this request.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Food supply request" className="fixed inset-0 z-50 grid place-items-center bg-[#18342b]/55 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-[#fdfbf3] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[#e4eadf] p-6">
          <div><p className="eyebrow">Food supply request</p><h2 className="mt-2 font-display text-3xl font-bold">{batch.items.map((item) => item.name).join(' + ') || 'Food pickup'}</h2><p className="mt-1 text-sm capitalize text-[#729082]">{batch.status.replace('_', ' ')} · {batch.portions} portions · {batch.total_kg.toFixed(1)} kg</p></div>
          <button type="button" onClick={onClose} aria-label="Close request" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-xl font-bold text-[#729082]">×</button>
        </div>
        {batch.image_url ? <img src={batch.image_url} alt="Donated food" className="h-64 w-full object-cover" /> : <div className="grid h-40 place-items-center bg-[#e9f4e4] text-sm font-semibold text-[#557267]">Image unavailable</div>}
        {error && <p className="mx-6 mt-5 rounded-xl bg-[#fff0ed] p-4 text-sm font-semibold text-[#b94e3a]">{error}</p>}
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-5"><p className="eyebrow">Exact collection location</p><p className="mt-2 font-display text-xl font-bold">{batch.lat?.toFixed(5)}, {batch.lng?.toFixed(5)}</p><a className="mt-3 inline-block font-bold text-[#0f766e] underline" href={`https://www.google.com/maps/search/?api=1&query=${batch.lat},${batch.lng}`} target="_blank" rel="noreferrer">Open in Maps ↗</a></section>
          <section className="rounded-2xl bg-[#d7f5ee] p-5"><p className="eyebrow">Destination</p>{batch.shelter ? <><h3 className="mt-2 font-display text-xl font-bold">{batch.shelter.name}</h3><p className="mt-1 text-sm text-[#0f5f56]">{batch.shelter.lat.toFixed(5)}, {batch.shelter.lng.toFixed(5)}</p>{batch.shelter.contact && <p className="mt-1 text-sm font-semibold text-[#0f5f56]">{batch.shelter.contact}</p>}</> : <p className="mt-2 text-sm text-[#0f5f56]">Shelter matching in progress.</p>}</section>
          <section className="rounded-2xl bg-white p-5 md:col-span-2"><p className="eyebrow">Pickup details</p><div className="mt-3 flex flex-wrap gap-2">{batch.items.map((item) => <span key={item.name} className="rounded-full bg-[#edf4e5] px-3 py-2 text-sm font-semibold">{item.name} · {item.approx_kg.toFixed(1)} kg</span>)}</div><p className="mt-4 text-sm text-[#729082]">{batch.ambient_temp_c != null ? `${Math.round(batch.ambient_temp_c)}°C · ${batch.humidity_pct}% humidity` : 'Weather data unavailable'} · {batch.remaining_min} minutes remaining</p></section>
        </div>
        <div className="flex justify-end gap-3 border-t border-[#e4eadf] p-6">{canPickUp && <button type="button" onClick={() => void markPickingUp()} disabled={working} className="btn-pop btn-dark rounded-full px-6 py-3 font-bold disabled:opacity-60">{working ? 'Updating…' : 'Mark as picking up'}</button>}<button type="button" onClick={onClose} className="rounded-full border border-[#cbd8c9] bg-white px-6 py-3 font-bold text-[#557267]">Close</button></div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, bg }: { label: string; value: string; icon: string; bg: string }) {
  return (
    <div className="rounded-2xl border border-[#efe9d8] p-5 text-center shadow-sm" style={{ backgroundColor: bg }}>
      <span className="text-xl">{icon}</span>
      <strong className="mt-3 block font-display text-3xl font-bold">{value}</strong>
      <span className="mt-1 block text-xs font-bold uppercase tracking-[0.1em] text-[#729082]">{label}</span>
    </div>
  );
}