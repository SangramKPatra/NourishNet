import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import FoodBackdrop from '../../components/FoodBackdrop';

const FALLBACK_LOCATION = { lat: '37.7749', lng: '-122.4194' };

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup'>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin',
  );
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'supplier' | 'distributor'>('supplier');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup') {
      if (!name || !organization) return setError('Name and organization are required.');
      if (password.length < 8) return setError('Password must be at least 8 characters.');
    }
    setLoading(true);
    try {
      const user = mode === 'signup'
        ? await signUp({
            email: email,
            password: password,
            role: role,
            lat: FALLBACK_LOCATION.lat,
            lng: FALLBACK_LOCATION.lng,
            radius_km: 10,
          })
        : await signIn(email, password);
      navigate(user.role === 'supplier' ? '/donor' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0f766e] via-[#0d9488] to-[#18342b] px-4 py-6 text-[#18342b]">
      <FoodBackdrop opacity={0.45} />
      <div className="relative w-full max-w-xl rounded-2xl bg-gradient-to-br from-[#fdfbf3] to-[#f7f7f2] p-6 shadow-xl sm:p-8">
        <div className="inline-flex rounded-full border border-[#dfe7dc] bg-white p-1 shadow-sm">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-5 py-1.5 text-xs font-bold transition ${mode === m ? 'btn-dark' : 'text-[#729082] hover:text-[#18342b]'}`}
            >
              {m === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-[#18342b]">
          {mode === 'signup' ? 'Join NourishNet' : 'Welcome back'}
        </h1>
        <p className="mt-1 text-xs text-[#729082]">
          {mode === 'signup'
            ? 'Sign up as a food supplier or distributor.'
            : 'Sign in to continue rescuing food.'}
        </p>

        <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-2.5">
          {mode === 'signup' && (
            <>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow">Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="field-compact mt-1"
                    required
                  />
                </label>
                <label className="block">
                  <span className="eyebrow">Organization</span>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Your organization name"
                    className="field-compact mt-1"
                    required
                  />
                </label>
              </div>
              <div>
                <span className="eyebrow">Role</span>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setRole('supplier')}
                    className={`rounded-xl border-2 px-4 py-2 text-left transition ${role === 'supplier' ? 'border-[#799d13] bg-[#edf4e5] shadow-md' : 'border-[#dfe7dc] bg-white'}`}
                  >
                    <span className="font-display text-sm font-bold">Food supplier</span>
                    <p className="text-[10px] leading-4 text-[#729082]">Donate surplus food from your kitchen.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('distributor')}
                    className={`rounded-xl border-2 px-4 py-2 text-left transition ${role === 'distributor' ? 'border-[#799d13] bg-[#edf4e5] shadow-md' : 'border-[#dfe7dc] bg-white'}`}
                  >
                    <span className="font-display text-sm font-bold">Distributor</span>
                    <p className="text-[10px] leading-4 text-[#729082]">Pick up and deliver to shelters.</p>
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="field-compact mt-1"
                required
              />
            </label>
            <label className="block">
              <span className="eyebrow">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="field-compact mt-1"
                required
              />
            </label>
          </div>

          {error && <p className="rounded-lg bg-[#fff0ed] px-3 py-2 text-xs font-semibold text-[#b94e3a]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-pop btn-dark mt-1 rounded-full px-6 py-2.5 text-sm font-bold"
          >
            {loading ? 'Processing…' : mode === 'signup' ? 'Sign up' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
