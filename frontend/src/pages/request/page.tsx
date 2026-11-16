import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBatch, pickupBatch, type Batch } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, ready } = useAuth();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!id) return;
    void getBatch(id).then(setBatch).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Request unavailable.'));
  }, [id]);

  const markPickingUp = async () => {
    if (!id || !token) return;
    setWorking(true);
    setError('');
    try {
      const result = await pickupBatch(id, token);
      setBatch(result.batch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this request.');
    } finally {
      setWorking(false);
    }
  };

  if (!ready || !batch) {
    return <div className="mx-auto max-w-3xl px-5 py-16">{error ? <p className="rounded-xl bg-[#fff0ed] p-4 text-[#b94e3a]">{error}</p> : <p className="text-[#729082]">Loading request…</p>}</div>;
  }

  const canPickUp = user?.role === 'distributor' && ['pending', 'dispatched', 'at_risk', 'claimed'].includes(batch.status);
  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
      <Link to="/dashboard" className="text-sm font-bold text-[#729082] hover:text-[#18342b]">← Back to queue</Link>
      <div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Food supply request</p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-[-0.05em]">{batch.items.map((item) => item.name).join(' + ') || 'Food pickup'}</h1>
          <p className="mt-3 text-[#729082]">{batch.portions} portions · {batch.total_kg.toFixed(1)} kg · <span className="capitalize">{batch.status.replace('_', ' ')}</span></p>
        </div>
        {canPickUp && <button onClick={() => void markPickingUp()} disabled={working} className="btn-pop btn-dark rounded-full px-6 py-3 font-bold disabled:opacity-60">{working ? 'Updating…' : 'Mark as picking up'}</button>}
      </div>
      {error && <p className="mt-5 rounded-xl bg-[#fff0ed] p-4 text-sm font-semibold text-[#b94e3a]">{error}</p>}
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-[#dfe7dc] bg-white p-6">
          <p className="eyebrow">Exact collection location</p>
          <p className="mt-3 font-display text-2xl font-bold">{batch.lat?.toFixed(5)}, {batch.lng?.toFixed(5)}</p>
          <a className="mt-4 inline-block font-bold text-[#0f766e] underline" href={`https://www.google.com/maps/search/?api=1&query=${batch.lat},${batch.lng}`} target="_blank" rel="noreferrer">Open in Maps ↗</a>
          <p className="mt-5 text-sm text-[#729082]">Please keep the food chilled and collect it before the conservative window expires.</p>
        </section>
        <section className="rounded-2xl border border-[#dfe7dc] bg-[#d7f5ee] p-6">
          <p className="eyebrow">Delivery destination</p>
          {batch.shelter ? <><h2 className="mt-3 font-display text-2xl font-bold">{batch.shelter.name}</h2><p className="mt-2 text-sm text-[#0f5f56]">{batch.shelter.lat.toFixed(5)}, {batch.shelter.lng.toFixed(5)}</p>{batch.shelter.contact && <p className="mt-2 text-sm font-semibold text-[#0f5f56]">{batch.shelter.contact}</p>}</> : <p className="mt-3 text-sm text-[#0f5f56]">A shelter is still being matched.</p>}
        </section>
        <section className="rounded-2xl border border-[#dfe7dc] bg-[#fffdf5] p-6 md:col-span-2">
          <p className="eyebrow">Supply details</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {batch.items.map((item) => <div key={item.name} className="rounded-xl bg-white p-4"><strong className="block">{item.name}</strong><span className="text-sm text-[#729082]">{item.approx_kg.toFixed(1)} kg</span></div>)}
          </div>
          <p className="mt-5 text-sm text-[#729082]">{batch.ambient_temp_c != null ? `${Math.round(batch.ambient_temp_c)}°C · ${batch.humidity_pct}% humidity` : 'Weather data unavailable'} · {batch.remaining_min} minutes remaining</p>
        </section>
      </div>
    </div>
  );
}
