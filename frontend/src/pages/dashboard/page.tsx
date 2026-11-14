import { useCallback, useEffect, useState } from 'react';
import { getStats, listBatches, type Batch, type Stats } from '../../lib/api';

function countdown(minutes: number) {
  if (minutes <= 0) return 'Expired';
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes} min`;
}

function statusLabel(status: string) {
  return status.replace('_', ' ');
}

function BatchCard({ batch }: { batch: Batch }) {
  const [remaining, setRemaining] = useState(batch.remaining_min);
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const urgency = remaining <= Math.max(15, (batch.safe_window_min ?? 30) * 0.25) ? 'critical' : remaining <= (batch.safe_window_min ?? 30) * 0.5 ? 'watch' : 'safe';
  return <article className={`batch-card ${urgency}`}><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className={`status-dot ${urgency}`} /><span className="status-chip">{statusLabel(batch.status)}</span>{batch.is_demo && <span className="demo-chip">Demo</span>}</div><h3 className="mt-4 font-display text-2xl font-bold">{batch.items.map((item) => item.name).join(' + ') || 'Manual entry needed'}</h3><p className="mt-1 text-sm text-[#729082]">{batch.portions} portions · {batch.total_kg.toFixed(1)} kg · {batch.tier.replace('_', ' ')}</p></div><div className="text-right"><span className="eyebrow">Pickup window</span><strong className={`mt-1 block font-display text-3xl ${urgency === 'critical' ? 'text-[#c6513a]' : urgency === 'watch' ? 'text-[#b17719]' : 'text-[#557c16]'}`}>{countdown(remaining)}</strong></div></div><div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#e4eadf] pt-4 text-xs font-semibold text-[#729082]"><span>Weather {batch.ambient_temp_c ? `${Math.round(batch.ambient_temp_c)}°C` : '—'} · {batch.weather_source ?? 'unknown'}</span><span>{batch.shelter_id ? 'Shelter matched' : 'Finding a shelter…'}</span></div></article>;
}

export default function DashboardPage() {
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
      setError(err instanceof Error ? err.message : 'Dashboard is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 5000); return () => window.clearInterval(timer); }, [load]);
  return <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-16"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="eyebrow">Command center</p><h1 className="mt-3 font-display text-5xl font-bold tracking-[-0.05em]">Food in motion.</h1><p className="mt-3 text-[#729082]">Live view of surplus moving from kitchens to community shelters.</p></div><button onClick={() => void load()} className="self-start rounded-full border border-[#cbd8c9] bg-white px-4 py-2 text-sm font-bold text-[#557267] hover:border-[#18342b]">↻ Refresh</button></div>{stats && <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Meals rescued" value={stats.meals.toLocaleString()} icon="🍽" /><Stat label="Kg diverted" value={stats.kg.toFixed(1)} icon="♻" /><Stat label="CO₂e avoided" value={`${stats.co2e_kg.toFixed(1)} kg`} icon="🌱" /><Stat label="Active batches" value={stats.active_batches.toString()} icon="⌛" /></div>}<div className="mt-12 flex items-center justify-between"><div><p className="eyebrow">Live dispatches</p><h2 className="mt-2 font-display text-3xl font-bold">Today’s rescue queue</h2></div><span className="text-xs font-semibold text-[#729082]">Auto-refresh · 5 sec</span></div>{error && <div className="mt-6 rounded-2xl bg-[#fff0ed] px-5 py-4 text-sm font-semibold text-[#b94e3a]">{error}<button onClick={() => void load()} className="ml-3 underline">Retry</button></div>}{loading ? <div className="mt-6 grid gap-4"><div className="skeleton h-48" /><div className="skeleton h-48" /></div> : batches.length ? <div className="mt-6 grid gap-4 lg:grid-cols-2">{batches.map((batch) => <BatchCard key={batch.id} batch={batch} />)}</div> : <div className="mt-6 rounded-[2rem] border border-dashed border-[#cbd8c9] bg-white p-12 text-center"><div className="text-4xl">🥕</div><h3 className="mt-4 font-display text-2xl font-bold">The queue is clear</h3><p className="mt-2 text-sm text-[#729082]">Newly scanned food will appear here.</p></div>}<p className="mt-8 text-xs leading-5 text-[#729082]">Impact is calculated from delivered batches only. CO₂e uses the configurable 2.5 kg factor. Demo data is labelled.</p></div>;
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) { return <div className="metric-card"><span className="text-xl">{icon}</span><strong className="mt-3 block font-display text-3xl font-bold">{value}</strong><span className="mt-1 block text-xs font-bold uppercase tracking-[0.1em] text-[#729082]">{label}</span></div>; }
