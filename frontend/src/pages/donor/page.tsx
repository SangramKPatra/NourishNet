import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { confirmBatch, listBatches, scanBatch, type Batch, type FoodItem, type ScanResponse } from '../../lib/api';
import FoodBackdrop from '../../components/FoodBackdrop';

const FALLBACK_LOCATION = { lat: '37.7749', lng: '-122.4194' };
const TIERS = [
  { value: 'HIGH_MOISTURE', label: 'High moisture', hint: 'Curries, rice, dal, soups' },
  { value: 'MEDIUM_MOISTURE', label: 'Medium moisture', hint: 'Vegetables, roasted meats, fried items' },
  { value: 'DRY', label: 'Dry', hint: 'Bread, roti, baked goods, dry snacks' },
];

type FormItem = { id: number; name: string; kg: string };

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${String(mins).padStart(2, '0')}m` : `${mins} min`;
}

function urgencyOf(remaining: number, win: number | null) {
  const w = win ?? 30;
  if (remaining <= Math.max(15, w * 0.25)) return { cls: 'text-[#cf5d45]', bar: 'bg-[#cf5d45]' };
  if (remaining <= w * 0.5) return { cls: 'text-[#b17719]', bar: 'bg-[#d39a2d]' };
  return { cls: 'text-[#557c16]', bar: 'bg-[#83b31c]' };
}

export default function DonorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [location, setLocation] = useState(FALLBACK_LOCATION);
  const [donorToken, setDonorToken] = useState(searchParams.get('token') ?? 'demo-donor-token');
  const [items, setItems] = useState<FormItem[]>([{ id: 0, name: '', kg: '1' }]);
  const [portions, setPortions] = useState('');
  const [tier, setTier] = useState('HIGH_MOISTURE');
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
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
    if (preview) URL.revokeObjectURL(preview);
    setError('');
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const updateItem = (id: number, field: 'name' | 'kg', value: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!imageFile) return setError('Attach a photo of the food.');
    if (!donorToken.trim()) return setError('Add your donor token.');

    const parsed: FoodItem[] = items.map((item) => ({ name: item.name.trim(), approx_kg: Number(item.kg) }));
    if (parsed.some((item) => !item.name || !Number.isFinite(item.approx_kg) || item.approx_kg <= 0 || item.approx_kg > 100)) {
      return setError('Give every item a name and a weight between 0 and 100 kg.');
    }
    const mealCount = Number(portions);
    if (!Number.isInteger(mealCount) || mealCount < 1) return setError('Enter the number of portions.');

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('image', imageFile);
      form.append('lat', location.lat);
      form.append('lng', location.lng);
      form.append('donor_token', donorToken);
      const draft = await scanBatch(form);
      await confirmBatch(draft.draft_id, { items: parsed, portions: mealCount, tier });
      setScan(draft);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enlist this batch. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setImageFile(null);
    setPreview('');
    setItems([{ id: 0, name: '', kg: '1' }]);
    nextId.current = 1;
    setPortions('');
    setTier('HIGH_MOISTURE');
    setScan(null);
    setError('');
    setSuccess(false);
  };

  return (
    <div className="relative overflow-hidden">
      <FoodBackdrop opacity={0.35} />
      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <div className="mb-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dfe7dc] bg-[#fffdf5] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#557c16] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#83b31c]" /> For kitchens, caterers & canteens
          </div>
          <h1 className="max-w-2xl font-display text-5xl font-bold leading-[0.98] tracking-[-0.05em] sm:text-6xl">
            Turn tonight’s surplus into <span className="text-[#799d13]">someone’s dinner.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#4c6a5e]">Add a photo and the food details below. We work out a conservative pickup window and alert nearby volunteers.</p>
        </div>

        {success ? (
          <section className="mx-auto max-w-2xl rounded-[2rem] border border-[#dfe7dc] bg-white p-10 text-center shadow-sm">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#d9f06d] text-4xl">✓</div>
            <p className="eyebrow mt-6">Pickup alert sent</p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.04em]">You kept {portions} meals in the rescue loop.</h2>
            <p className="mx-auto mt-4 max-w-lg leading-7 text-[#729082]">Nearby volunteers have the details. Collect within the window below.</p>
            <div className="mx-auto mt-8 rounded-[2rem] bg-[#18342b] p-8 text-white"><span className="text-sm font-bold uppercase tracking-[0.14em] text-[#d9f06d]">Collect within</span><strong className="mt-2 block font-display text-6xl">{scan ? formatMinutes(scan.safe_window_min) : '—'}</strong></div>
            <div className="mt-6 flex justify-center gap-3"><button onClick={reset} className="rounded-full border border-[#cbd8c9] bg-white px-5 py-3 font-bold">List another batch</button><button onClick={() => navigate('/dashboard')} className="btn-pop btn-dark rounded-full px-5 py-3 font-bold">Open dashboard →</button></div>
          </section>
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <form onSubmit={submit} className="rounded-[2rem] border border-[#dfe7dc] bg-white p-6 shadow-[0_20px_60px_rgba(24,52,43,0.08)] sm:p-8">
              <p className="eyebrow">New food listing</p>
              <h2 className="mt-2 font-display text-3xl font-bold">What are you sending tonight?</h2>
              <p className="mt-2 text-sm text-[#729082]">Photo and details are both required. AI suggestions never replace what you enter here.</p>

              {error && <p role="alert" className="mt-5 rounded-xl bg-[#fff0ed] px-4 py-3 text-sm font-semibold text-[#b94e3a]">{error}</p>}

              <div className="mt-7">
                <label className="eyebrow">Photo <span className="text-[#cf5d45]">*</span></label>
                <div className="mt-3 flex items-center gap-4 rounded-2xl border border-dashed border-[#cbd8c9] bg-[#f7f7f2] p-4">
                  {preview ? <img src={preview} alt="Selected surplus food" className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-[#edf4e5] text-3xl">📷</div>}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#18342b]">{imageFile ? imageFile.name : 'No photo attached yet'}</p>
                    <input ref={fileRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => handleImageChange(e.target.files?.[0])} />
                    <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 rounded-full border border-[#dfe7dc] bg-white px-4 py-2 text-sm font-bold text-[#557c16] transition hover:border-[#18342b]">{imageFile ? 'Replace photo' : 'Choose photo'}</button>
                  </div>
                </div>
              </div>

              <div className="mt-7">
                <label className="eyebrow">Food items <span className="text-[#cf5d45]">*</span></label>
                <div className="mt-3 space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-2">
                      <input aria-label="Food name" placeholder="Food name (e.g. cooked rice)" value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} className="field flex-1" />
                      <input aria-label="Weight in kg" type="number" min="0.1" max="100" step="0.1" value={item.kg} onChange={(e) => updateItem(item.id, 'kg', e.target.value)} className="field w-24" />
                      <span className="self-center text-xs font-bold text-[#729082]">kg</span>
                      <button type="button" aria-label="Remove item" onClick={() => setItems((current) => current.length === 1 ? current : current.filter((entry) => entry.id !== item.id))} disabled={items.length === 1} className="self-center px-1 text-lg font-bold text-[#b94e3a] disabled:opacity-30">×</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setItems((current) => [...current, { id: nextId.current++, name: '', kg: '1' }])} className="mt-3 text-sm font-bold text-[#557c16] hover:text-[#18342b]">+ Add another food item</button>
              </div>

              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <div><label htmlFor="portions" className="eyebrow">Portions <span className="text-[#cf5d45]">*</span></label><input id="portions" type="number" min="1" step="1" placeholder="e.g. 20" value={portions} onChange={(e) => setPortions(e.target.value)} className="field mt-3" /><p className="mt-1 text-xs text-[#729082]">estimated meals</p></div>
                <div><label htmlFor="tier" className="eyebrow">Perishability</label><select id="tier" value={tier} onChange={(e) => setTier(e.target.value)} className="field mt-3"><option value="HIGH_MOISTURE">High moisture</option><option value="MEDIUM_MOISTURE">Medium moisture</option><option value="DRY">Dry</option></select><p className="mt-1 text-xs text-[#729082]">{TIERS.find((t) => t.value === tier)?.hint}</p></div>
              </div>

              <div className="mt-7">
                <label htmlFor="token" className="eyebrow">Donor access token <span className="text-[#cf5d45]">*</span></label>
                <input id="token" value={donorToken} onChange={(e) => setDonorToken(e.target.value)} className="field mt-3" placeholder="demo-donor-token" />
              </div>

              <button type="submit" disabled={submitting} className="btn-pop btn-dark mt-8 w-full rounded-full px-6 py-4 font-bold disabled:opacity-60">{submitting ? 'Uploading & enlisting…' : 'Enlist food & dispatch pickup alert'}</button>
            </form>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-[#dfe7dc] bg-[#d7f5ee] p-5">
                <span className="eyebrow">Safety engine</span>
                <h3 className="mt-2 font-display text-lg font-bold text-[#18342b]">Weather-aware windows</h3>
                <p className="mt-1 text-sm leading-6 text-[#0f5f56]">High moisture 240 min · medium 360 min · dry 480 min, minus 15 min per °C above 25. A 30-minute floor always applies.</p>
              </div>
              <div className="rounded-2xl border border-[#dfe7dc] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><span className="eyebrow">Recent rescue queue</span><span className="teal-chip">{recent.length} live</span></div>
                <div className="mt-3 space-y-2">
                  {recent.length ? recent.map((b) => {
                    const u = urgencyOf(b.remaining_min, b.safe_window_min);
                    const pct = b.safe_window_min ? Math.max(0, Math.min(100, (b.remaining_min / b.safe_window_min) * 100)) : 0;
                    return (
                      <div key={b.id} className="rounded-xl border border-[#dfe7dc] bg-[#f7f7f2] p-3">
                        <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold">{b.items.map((i) => i.name).join(' + ') || 'Manual entry'}</span><strong className={`font-display text-sm ${u.cls}`}>{formatMinutes(b.remaining_min)}</strong></div>
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#eef2e8]"><div className={`h-full rounded-full ${u.bar}`} style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  }) : <p className="rounded-xl border border-dashed border-[#cbd8c9] bg-[#f7f7f2] p-4 text-center text-xs text-[#4c6a5e]">No batches yet — yours will be the first.</p>}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
