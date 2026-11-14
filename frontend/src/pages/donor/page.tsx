import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { confirmBatch, scanBatch, type FoodItem, type ScanResponse } from '../../lib/api';

const FALLBACK_LOCATION = { lat: '37.7749', lng: '-122.4194' };

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${String(mins).padStart(2, '0')}m` : `${mins} min`;
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

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => setLocation({ lat: coords.latitude.toFixed(5), lng: coords.longitude.toFixed(5) }),
      () => setLocation(FALLBACK_LOCATION),
      { timeout: 4000 },
    );
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
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
      {phase === 'ready' || phase === 'scanning' ? (
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dfe7dc] bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#729082] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#93c51b]" /> For kitchens, caterers & canteens
            </div>
            <h1 className="max-w-xl font-display text-5xl font-bold leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Turn tonight’s surplus into <span className="text-[#799d13]">someone’s dinner.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-[#729082]">One photo. A conservative safety window. A pickup alert sent to people nearby.</p>
            <div className="mt-9 flex flex-wrap gap-4 text-sm font-semibold text-[#557267]">
              <span>✓ No listing forms</span><span>✓ Weather-aware</span><span>✓ Volunteer pickup</span>
            </div>
          </div>
          <div className="relative">
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
        </section>
      ) : phase === 'review' || phase === 'confirming' ? (
        <ReviewPanel scan={scan!} items={items} portions={portions} error={error} setPortions={setPortions} updateItem={updateItem} onConfirm={confirm} onBack={() => setPhase('ready')} confirming={phase === 'confirming'} />
      ) : (
        <SuccessPanel scan={scan!} onDashboard={() => navigate('/dashboard')} onNew={() => { setImageFile(null); setPreview(''); setScan(null); setPhase('ready'); }} />
      )}
      {phase !== 'review' && phase !== 'confirming' && <div className="mx-auto mt-8 max-w-xl space-y-3"><label className="block text-xs font-bold uppercase tracking-[0.14em] text-[#729082]">Donor access token</label><input value={donorToken} onChange={(e) => setDonorToken(e.target.value)} className="field" placeholder="demo-donor-token" />{error && <p className="rounded-xl bg-[#fff0ed] px-4 py-3 text-sm font-semibold text-[#b94e3a]">{error}</p>}</div>}
    </div>
  );
}

function ReviewPanel({ scan, items, portions, error, setPortions, updateItem, onConfirm, onBack, confirming }: { scan: ScanResponse; items: FoodItem[]; portions: number; error: string; setPortions: (value: number) => void; updateItem: (index: number, field: keyof FoodItem, value: string) => void; onConfirm: () => void; onBack: () => void; confirming: boolean }) {
  return <section className="mx-auto max-w-3xl"><button onClick={onBack} className="mb-8 text-sm font-bold text-[#729082] hover:text-[#18342b]">← Retake photo</button><div className="mb-8"><p className="eyebrow">AI draft ready</p><h1 className="mt-3 font-display text-5xl font-bold tracking-[-0.04em]">Check the details, then dispatch.</h1><p className="mt-4 text-[#729082]">We estimated this from your photo. Make any quick corrections before sending the pickup alert.</p></div><div className="grid gap-5 sm:grid-cols-3"><div className="metric-card sm:col-span-2"><span className="eyebrow">Visible food</span><div className="mt-5 space-y-3">{items.map((item, index) => <div className="flex gap-2" key={`${item.name}-${index}`}><input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} className="field flex-1" /><input type="number" min="0.1" step="0.1" value={item.approx_kg} onChange={(e) => updateItem(index, 'approx_kg', e.target.value)} className="field w-24" /><span className="self-center text-xs font-bold text-[#729082]">kg</span></div>)}</div></div><div className="metric-card"><span className="eyebrow">Portions</span><input type="number" min="1" value={portions} onChange={(e) => setPortions(Number(e.target.value))} className="mt-5 w-full border-0 bg-transparent font-display text-5xl font-bold outline-none" /><p className="mt-2 text-sm text-[#729082]">estimated meals</p></div></div><div className="mt-5 grid gap-5 sm:grid-cols-3"><div className="metric-card"><span className="eyebrow">Collection window</span><strong className="mt-3 block font-display text-3xl">{formatMinutes(scan.safe_window_min)}</strong><p className="mt-1 text-xs text-[#729082]">conservative estimate</p></div><div className="metric-card"><span className="eyebrow">Outside now</span><strong className="mt-3 block font-display text-3xl">{Math.round(scan.ambient_temp_c)}°C</strong><p className="mt-1 text-xs text-[#729082]">{scan.humidity_pct}% humidity · {scan.weather_source}</p></div><div className="metric-card"><span className="eyebrow">Perishability</span><strong className="mt-3 block font-display text-xl text-[#a76e16]">{scan.tier.replace('_', ' ')}</strong><p className="mt-1 text-xs text-[#729082]">shorter is safer</p></div></div><div className="mt-6 rounded-2xl border border-[#ead9aa] bg-[#fff9e8] p-4 text-sm leading-6 text-[#7e642b]">Safety window is a conservative guide, not a food-safety guarantee. Confirm the food is suitable for donation.</div>{error && <p className="mt-4 rounded-xl bg-[#fff0ed] px-4 py-3 text-sm font-semibold text-[#b94e3a]">{error}</p>}<button onClick={onConfirm} disabled={confirming} className="mt-6 w-full rounded-2xl bg-[#18342b] px-6 py-4 text-base font-bold text-white shadow-lg transition hover:bg-[#2c5547] disabled:opacity-60">{confirming ? 'Sending pickup alert…' : 'Confirm & dispatch pickup →'}</button></section>;
}

function SuccessPanel({ scan, onDashboard, onNew }: { scan: ScanResponse; onDashboard: () => void; onNew: () => void }) {
  return <section className="mx-auto max-w-2xl text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#d9f06d] text-4xl">✓</div><p className="eyebrow mt-6">Pickup alert sent</p><h1 className="mt-3 font-display text-5xl font-bold tracking-[-0.04em]">You kept {scan.portions} meals in the rescue loop.</h1><p className="mx-auto mt-5 max-w-lg leading-7 text-[#729082]">Nearby volunteers have the details. The batch should be collected within the conservative window below.</p><div className="mx-auto mt-8 rounded-[2rem] bg-[#18342b] p-8 text-white"><span className="text-sm font-bold uppercase tracking-[0.14em] text-[#d9f06d]">Collect within</span><strong className="mt-2 block font-display text-6xl">{formatMinutes(scan.safe_window_min)}</strong></div><div className="mt-6 flex justify-center gap-3"><button onClick={onNew} className="rounded-full border border-[#cbd8c9] bg-white px-5 py-3 font-bold">Scan another</button><button onClick={onDashboard} className="rounded-full bg-[#18342b] px-5 py-3 font-bold text-white">Open dashboard →</button></div></section>;
}
