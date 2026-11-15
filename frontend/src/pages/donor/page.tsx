import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { confirmBatch, listBatches, scanBatch, type Batch, type FoodItem, type ScanResponse } from '../../lib/api';

const FALLBACK_LOCATION = { lat: '37.7749', lng: '-122.4194' };

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${String(mins).padStart(2, '0')}m` : `${mins} min`;
}

function urgencyOf(remaining: number, win: number | null) {
  const w = win ?? 30;
  if (remaining <= Math.max(15, w * 0.25)) return { band: 'critical', label: 'Critical', cls: 'text-[#cf5d45]', bar: 'bg-[#cf5d45]', dot: 'bg-[#cf5d45]' };
  if (remaining <= w * 0.5) return { band: 'watch', label: 'Watch', cls: 'text-[#b17719]', bar: 'bg-[#d39a2d]', dot: 'bg-[#d39a2d]' };
  return { band: 'safe', label: 'Safe', cls: 'text-[#557c16]', bar: 'bg-[#83b31c]', dot: 'bg-[#83b31c]' };
}

export default function DonorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [location, setLocation] = useState(FALLBACK_LOCATION);
  const [donorToken, setDonorToken] = useState(searchParams.get('token') ?? 'demo-donor-token');
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [portions, setPortions] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'scanning' | 'review' | 'confirming' | 'success'>('ready');
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<Batch[]>([]);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => setLocation({ lat: coords.latitude.toFixed(5), lng: coords.longitude.toFixed(5) }),
      () => setLocation(FALLBACK_LOCATION),
      { timeout: 4000 },
    );
    void listBatches().then((b) => setRecent(b.slice(0, 4))).catch(() => undefined);
  }, []);

  const handleImageChange = (file?: File) => {
    if (!file) return;
    setError('');
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const scanImage = async () => {
    if (!imageFile) return setError('Take a photo first.');
    if (!donorToken) return setError('Add your donor token to continue.');
    setError('');
    setPhase('scanning');
    const form = new FormData();
    form.append('image', imageFile);
    form.append('lat', location.lat);
    form.append('lng', location.lng);
    form.append('donor_token', donorToken);
    try {
      const result = await scanBatch(form);
      setScan(result);
      setItems(result.items);
      setPortions(result.portions);
      setPhase('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that photo. Try again.');
      setPhase('ready');
    }
  };

  const confirm = async () => {
    if (!scan || !items.length || portions < 1) return setError('Add at least one food item and portion count.');
    setError('');
    setPhase('confirming');
    try {
      await confirmBatch(scan.draft_id, { items, portions });
      setPhase('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not dispatch this batch.');
      setPhase('review');
    }
  };

  const updateItem = (index: number, field: keyof FoodItem, value: string) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === 'approx_kg' ? Number(value) : value } : item));
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
      {phase === 'ready' || phase === 'scanning' ? (
        <section className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dfe7dc] bg-[#fffdf5] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#557c16] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#83b31c]" /> For kitchens, caterers & canteens
            </div>
            <h1 className="max-w-xl font-display text-5xl font-bold leading-[0.98] tracking-[-0.05em] sm:text-6xl">
              Turn tonight’s surplus into <span className="text-[#799d13]">someone’s dinner.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-[#4c6a5e]">One photo. A conservative safety window. A pickup alert sent to people nearby.</p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold text-[#4c6a5e]">
              <span className="rounded-full bg-[#e9f4e4] px-3 py-1">✓ No listing forms</span>
              <span className="rounded-full bg-[#d7f5ee] px-3 py-1">✓ Weather-aware</span>
              <span className="rounded-full bg-[#fff3d0] px-3 py-1">✓ Volunteer pickup</span>
            </div>

            <div className="relative mt-8">
              <div className="absolute -inset-5 -z-10 rounded-[3rem] bg-[#e7f1cf] blur-2xl" />
              <div className="overflow-hidden rounded-[2rem] border border-[#dfe7dc] bg-white p-3 shadow-[0_20px_60px_rgba(24,52,43,0.12)]">
                <div className="relative flex min-h-[430px] flex-col items-center justify-center overflow-hidden rounded-[1.5rem] bg-[#18342b] px-6 text-center text-white">
                  {preview ? <img src={preview} alt="Selected surplus food" className="absolute inset-0 h-full w-full object-cover opacity-45" /> : <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#799d13]/40 blur-3xl" />}
                  <div className="relative z-10">
                    <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-[#d9f06d] text-4xl shadow-xl">📸</div>
                    <h2 className="font-display text-3xl font-bold">{imageFile ? 'Photo ready' : 'Scan surplus food'}</h2>
                    <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-white/70">{imageFile ? imageFile.name : 'Show us what is left in the tray. We’ll do the sorting.'}</p>
                    <input ref={inputRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => handleImageChange(e.target.files?.[0])} />
                    <button onClick={() => inputRef.current?.click()} className="mt-7 rounded-full bg-white px-6 py-3 font-bold text-[#18342b] transition hover:bg-[#d9f06d]">{imageFile ? 'Retake photo' : 'Take a photo'}</button>
                    {imageFile && <button onClick={scanImage} disabled={phase === 'scanning'} className="ml-2 rounded-full bg-[#d9f06d] px-6 py-3 font-bold text-[#18342b] transition hover:bg-white disabled:opacity-60">{phase === 'scanning' ? 'Reading tray…' : 'Analyze food →'}</button>}
                  </div>
                  <div className="absolute bottom-5 left-5 right-5 flex justify-between text-xs font-semibold text-white/60"><span>⌖ {location.lat}, {location.lng}</span><span>Private by default</span></div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#dfe7dc] bg-[#d7f5ee] p-5">
              <span className="eyebrow">Safety engine</span>
              <h3 className="mt-2 font-display text-lg font-bold text-[#18342b]">Weather-aware windows</h3>
              <p className="mt-1 text-sm leading-6 text-[#0f5f56]">Base windows: high-moisture 240 min · medium 360 min · dry 480 min, minus 15 min per °C above 25. A 30-minute floor always applies.</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[['240', 'High'], ['360', 'Medium'], ['480', 'Dry']].map(([v, l]) => (
                  <div key={l} className="rounded-xl bg-white/70 px-2 py-3"><strong className="block font-display text-2xl font-bold text-[#0f766e]">{v}</strong><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4c6a5e]">{l} min</span></div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#dfe7dc] bg-[#fffdf5] p-5">
              <span className="eyebrow">What happens next</span>
              <ol className="mt-3 space-y-3">
                {[['📸', 'Scan', 'AI extracts items, weight, perishability tier.'], ['✅', 'Confirm', 'Edit the draft, one tap to dispatch.'], ['🏃', 'Pickup', 'Volunteer collects within the window.'], ['🏠', 'Deliver', 'Shelter receives food; impact is logged.']].map(([i, t, d], idx) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#edf4e5] font-display text-sm font-bold text-[#557c16]">{idx + 1}</span>
                    <div><strong className="text-sm font-bold">{i} {t}</strong><p className="text-xs text-[#4c6a5e]">{d}</p></div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-[#dfe7dc] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Recent rescue queue</span>
                <span className="teal-chip">{recent.length} live</span>
              </div>
              <div className="mt-3 space-y-2">
                {recent.length ? recent.map((b) => {
                  const u = urgencyOf(b.remaining_min, b.safe_window_min);
                  const pct = b.safe_window_min ? Math.max(0, Math.min(100, (b.remaining_min / b.safe_window_min) * 100)) : 0;
                  return (
                    <div key={b.id} className="rounded-xl border border-[#dfe7dc] bg-[#f7f7f2] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">{b.items.map((i) => i.name).join(' + ') || 'Manual entry'}</span>
                        <strong className={`font-display text-sm ${u.cls}`}>{formatMinutes(b.remaining_min)}</strong>
                      </div>
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#eef2e8]"><div className={`h-full rounded-full ${u.bar}`} style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                }) : <p className="rounded-xl border border-dashed border-[#cbd8c9] bg-[#f7f7f2] p-4 text-center text-xs text-[#4c6a5e]">No batches yet — yours will be the first.</p>}
              </div>
            </div>
          </aside>
        </section>
      ) : phase === 'review' || phase === 'confirming' ? (
        <section className="grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <button onClick={() => setPhase('ready')} className="mb-8 text-sm font-bold text-[#729082] hover:text-[#18342b]">← Retake photo</button>
            <div className="mb-8">
              <p className="eyebrow">AI draft ready</p>
              <h1 className="mt-3 font-display text-5xl font-bold tracking-[-0.04em]">Check the details, then dispatch.</h1>
              <p className="mt-4 text-[#729082]">We estimated this from your photo. Make any quick corrections before sending the pickup alert.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="metric-card sm:col-span-2">
                <span className="eyebrow">Visible food</span>
                <div className="mt-5 space-y-3">{items.map((item, index) => <div className="flex gap-2" key={`${item.name}-${index}`}><input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} className="field flex-1" /><input type="number" min="0.1" step="0.1" value={item.approx_kg} onChange={(e) => updateItem(index, 'approx_kg', e.target.value)} className="field w-24" /><span className="self-center text-xs font-bold text-[#729082]">kg</span></div>)}</div>
              </div>
              <div className="metric-card"><span className="eyebrow">Portions</span><input type="number" min="1" value={portions} onChange={(e) => setPortions(Number(e.target.value))} className="mt-5 w-full border-0 bg-transparent font-display text-5xl font-bold outline-none" /><p className="mt-2 text-sm text-[#729082]">estimated meals</p></div>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <div className="metric-card"><span className="eyebrow">Collection window</span><strong className="mt-3 block font-display text-3xl">{scan ? formatMinutes(scan.safe_window_min) : '—'}</strong><p className="mt-1 text-xs text-[#729082]">conservative estimate</p></div>
              <div className="metric-card"><span className="eyebrow">Outside now</span><strong className="mt-3 block font-display text-3xl">{scan ? `${Math.round(scan.ambient_temp_c)}°C` : '—'}</strong><p className="mt-1 text-xs text-[#729082]">{scan ? `${scan.humidity_pct}% humidity · ${scan.weather_source}` : ''}</p></div>
              <div className="metric-card"><span className="eyebrow">Perishability</span><strong className="mt-3 block font-display text-3xl capitalize">{scan ? scan.tier.replace('_', ' ').toLowerCase() : '—'}</strong><p className="mt-1 text-xs text-[#729082]">{scan ? `${scan.needs_manual_entry ? 'Manual entry may be needed' : 'AI extraction complete'}` : ''}</p></div>
            </div>
            {error && <p className="mt-5 rounded-xl bg-[#fff0ed] px-4 py-3 text-sm font-semibold text-[#b94e3a]">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button onClick={confirm} disabled={phase === 'confirming'} className="rounded-full bg-[#18342b] px-6 py-3 font-bold text-white transition hover:bg-[#799d13] disabled:opacity-60">{phase === 'confirming' ? 'Sending alert…' : 'Confirm & dispatch pickup alert'}</button>
              <button onClick={() => setPhase('ready')} className="rounded-full border border-[#dfe7dc] bg-white px-6 py-3 font-bold text-[#729082] transition hover:border-[#18342b]">Back to photo</button>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="overflow-hidden rounded-[2rem] border border-[#dfe7dc] bg-white shadow-[0_20px_60px_rgba(24,52,43,0.08)]">
              {preview ? <img src={preview} alt="Scanned surplus food" className="h-56 w-full object-cover" /> : <div className="grid h-56 place-items-center bg-[#18342b] text-5xl">🍽</div>}
              <div className="p-4"><span className="eyebrow">Scanned batch</span><p className="mt-2 text-sm font-semibold text-[#18342b]">{items.map((i) => `${i.name} (${i.approx_kg} kg)`).join(' · ') || '—'}</p><p className="mt-1 text-xs text-[#729082]">⌖ {location.lat}, {location.lng} · {portions} portions</p></div>
            </div>
            <div className="rounded-2xl border border-[#dfe7dc] bg-[#e9f4e4] p-5">
              <span className="eyebrow">Reminder</span>
              <p className="mt-2 text-sm leading-6 text-[#3d5a34]">Windows are conservative safety guidance, not a guarantee. When in doubt, choose the shorter window and keep the batch chilled until pickup.</p>
            </div>
            <div className="rounded-2xl border border-[#dfe7dc] bg-[#fdfbf3] p-5">
              <span className="eyebrow">After dispatch</span>
              <ul className="mt-2 space-y-2 text-sm text-[#4c6a5e]">
                <li>✓ Volunteers see the countdown on Telegram</li>
                <li>✓ Status moves pending → dispatched → claimed → delivered</li>
                <li>✓ Impact appears on the dashboard in real time</li>
              </ul>
            </div>
          </aside>
        </section>
      ) : (
        <section className="mx-auto max-w-2xl text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#d9f06d] text-4xl">✓</div>
          <p className="eyebrow mt-6">Pickup alert sent</p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-[-0.04em]">You kept {scan?.portions ?? 0} meals in the rescue loop.</h1>
          <p className="mx-auto mt-5 max-w-lg leading-7 text-[#729082]">Nearby volunteers have the details. The batch should be collected within the conservative window below.</p>
          <div className="mx-auto mt-8 rounded-[2rem] bg-[#18342b] p-8 text-white"><span className="text-sm font-bold uppercase tracking-[0.14em] text-[#d9f06d]">Collect within</span><strong className="mt-2 block font-display text-6xl">{scan ? formatMinutes(scan.safe_window_min) : ''}</strong></div>
          <div className="mt-6 flex justify-center gap-3"><button onClick={() => { setImageFile(null); setPreview(''); setScan(null); setPhase('ready'); }} className="rounded-full border border-[#cbd8c9] bg-white px-5 py-3 font-bold">Scan another</button><button onClick={() => navigate('/dashboard')} className="rounded-full bg-[#18342b] px-5 py-3 font-bold text-white transition hover:bg-[#0f766e]">Open dashboard →</button></div>
        </section>
      )}
      {phase !== 'review' && phase !== 'confirming' && <div className="mx-auto mt-8 max-w-xl space-y-3"><label className="block text-xs font-bold uppercase tracking-[0.14em] text-[#729082]">Donor access token</label><input value={donorToken} onChange={(e) => setDonorToken(e.target.value)} className="field" placeholder="demo-donor-token" />{error && <p className="rounded-xl bg-[#fff0ed] px-4 py-3 text-sm font-semibold text-[#b94e3a]">{error}</p>}</div>}
    </div>
  );
}