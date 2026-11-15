import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';

const FALLBACK_LOCATION = { lat: '37.7749', lng: '-122.4194' };

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'supplier' | 'distributor'>('supplier');
  const [location, setLocation] = useState(FALLBACK_LOCATION);
  const [radius, setRadius] = useState(10);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleGeolocate = () => {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => setLocation({ lat: coords.latitude.toFixed(5), lng: coords.longitude.toFixed(5) }),
      () => setLocation(FALLBACK_LOCATION),
      { timeout: 4000 },
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Email and password are required.');
    if (mode === 'signup' && !name) return setError('Name is required.');
    if (mode === 'signup' && !organization) return setError('Organization is required.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (mode === 'signup' && radius <= 0) return setError('Radius must be greater than 0.');

    setLoading(true);
    try {
      const user = mode === 'signup'
        ? await signUp({ email, password, role, lat: location.lat, lng: location.lng, radius_km: radius })
        : await signIn(email, password);
      navigate(user.role === 'supplier' ? '/donor' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-6xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="hidden lg:block">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#18342b] p-8 text-white shadow-[0_20px_60px_rgba(24,52,43,0.2)]">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#00bfa5]/20 blur-2xl" />
          <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-[#d9f06d]/20 blur-2xl" />
          <p className="eyebrow text-[#d9f06d]">{mode === 'signup' ? 'Join the rescue network' : 'Welcome back'}</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-[-0.04em]">
            {mode === 'signup' ? 'One photo. One tap. Meals saved.' : 'Your queue missed you.'}
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
            {mode === 'signup'
              ? 'Sign up as a food supplier or distributor. Suppliers list surplus in seconds; distributors see enlistments and rate donated items.'
              : 'Sign in to continue rescuing food. Your batches, countdowns, and impact metrics are waiting.'}
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            {[['15s', 'to list food'], ['30s', 'to dispatch'], ['2.5kg', 'CO₂e per kg']].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-white/10 px-2 py-4">
                <strong className="block font-display text-2xl font-bold text-[#d9f06d]">{v}</strong>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">{l}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-4 text-xs leading-5 text-white/60">
            Conservative safety windows, weather-aware countdowns, and Telegram alerts keep every batch moving before it spoils.
          </div>
        </div>
      </aside>

      <div className="rounded-[2rem] border border-[#dfe7dc] bg-[#fffdf5] p-6 shadow-[0_20px_60px_rgba(24,52,43,0.08)] sm:p-8">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {mode === 'signup' ? 'Join NourishNet' : 'Welcome back'}
            </h1>
            <p className="mt-2 text-sm text-[#729082]">
              {mode === 'signup' ? 'Sign up as a food supplier or distributor.' : 'Sign in to continue rescuing food.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }}
            className="shrink-0 rounded-full border border-[#dfe7dc] bg-white px-4 py-2 text-sm font-bold text-[#557267] hover:border-[#18342b]"
          >
            {mode === 'signup' ? 'Sign in' : 'Sign up'}
          </button>
        </div>

        <form onSubmit={submit} className="mt-8 grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow">Name</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="field mt-2" required />
            </label>
            <label className="block">
              <span className="eyebrow">Organization</span>
              <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Your organization" className="field mt-2" required />
            </label>
          </div>

          <label className="block">
            <span className="eyebrow">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="field mt-2" required />
          </label>

          <label className="block">
            <span className="eyebrow">Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="field mt-2" required />
          </label>

          <div>
            <span className="eyebrow">Role</span>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setRole('supplier')} className={`rounded-2xl border px-5 py-4 text-left transition ${role === 'supplier' ? 'border-[#799d13] bg-[#edf4e5]' : 'border-[#dfe7dc] bg-white'}`}>
                <span className="font-display text-lg font-bold">Food supplier</span>
                <p className="mt-1 text-xs text-[#729082]">Donate surplus food from your kitchen.</p>
              </button>
              <button type="button" onClick={() => setRole('distributor')} className={`rounded-2xl border px-5 py-4 text-left transition ${role === 'distributor' ? 'border-[#799d13] bg-[#edf4e5]' : 'border-[#dfe7dc] bg-white'}`}>
                <span className="font-display text-lg font-bold">Distributor</span>
                <p className="mt-1 text-xs text-[#729082]">Pick up, deliver, and rate donations.</p>
              </button>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="metric-card">
              <span className="eyebrow">Location (lat, lng)</span>
              <div className="mt-2 flex items-center gap-2">
                <input type="text" value={location.lat} onChange={(e) => setLocation({ ...location, lat: e.target.value })} className="field w-full" placeholder="37.7749" />
                <input type="text" value={location.lng} onChange={(e) => setLocation({ ...location, lng: e.target.value })} className="field w-full" placeholder="-122.4194" />
              </div>
              <button type="button" onClick={handleGeolocate} className="mt-3 text-xs font-semibold text-[#799d13] hover:underline">Use my current location</button>
            </div>
            <div className="metric-card">
              <span className="eyebrow">Radius of operations (km)</span>
              <input type="number" min={0.1} step={0.1} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-[#dfe7dc] bg-white px-4 py-3 text-sm font-medium text-[#18342b] outline-none transition placeholder:text-[#9aafa3] focus:border-[#799d13] focus:ring-4 focus:ring-[#d9f06d]/40" />
              <p className="mt-2 text-xs text-[#729082]">How far you are willing to travel to rescue food.</p>
            </div>
          </div>

          {error && <p className="rounded-xl bg-[#fff0ed] px-4 py-3 text-sm font-semibold text-[#b94e3a]">{error}</p>}

          <button type="submit" disabled={loading} className="mt-2 rounded-full bg-[#18342b] px-6 py-3 font-bold text-white transition hover:bg-[#0f766e] disabled:opacity-60">
            {loading ? 'Processing…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}