import type { ReactNode } from 'react';

const Leaf = (
  <svg viewBox="0 0 64 64" width="100%" height="100%">
    <path d="M12 52 Q10 16 54 10 Q56 44 20 54 Q14 55 12 52 Z" fill="#14b8a6" />
    <path d="M17 49 Q32 34 49 17" stroke="#0f766e" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

const Pizza = (
  <svg viewBox="0 0 64 64" width="100%" height="100%">
    <path d="M32 62 L8 14 Q32 2 56 14 Z" fill="#ffd93d" stroke="#e8a33d" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M8 14 Q32 2 56 14" fill="none" stroke="#e8a33d" strokeWidth="7" strokeLinecap="round" />
    <circle cx="24" cy="26" r="4" fill="#cf5d45" />
    <circle cx="38" cy="30" r="4" fill="#cf5d45" />
    <circle cx="30" cy="44" r="3.5" fill="#cf5d45" />
    <circle cx="40" cy="20" r="3" fill="#557c16" />
    <circle cx="20" cy="38" r="3" fill="#557c16" />
  </svg>
);

const Donut = (
  <svg viewBox="0 0 64 64" width="100%" height="100%">
    <circle cx="32" cy="32" r="24" fill="#f2b544" />
    <circle cx="32" cy="32" r="19" fill="#14b8a6" />
    <circle cx="32" cy="32" r="8" fill="#fdfbf3" />
    <rect x="18" y="22" width="6" height="2.5" rx="1.2" fill="#d9f06d" transform="rotate(30 21 23)" />
    <rect x="40" y="20" width="6" height="2.5" rx="1.2" fill="#fdfbf3" transform="rotate(-20 43 21)" />
    <rect x="42" y="38" width="6" height="2.5" rx="1.2" fill="#d9f06d" transform="rotate(45 45 39)" />
    <rect x="17" y="38" width="6" height="2.5" rx="1.2" fill="#ffffff" transform="rotate(-35 20 39)" />
  </svg>
);

const Avocado = (
  <svg viewBox="0 0 64 64" width="100%" height="100%">
    <path d="M32 4 C45 4 51 17 51 34 C51 49 43 60 32 60 C21 60 13 49 13 34 C13 17 19 4 32 4 Z" fill="#557c16" />
    <path d="M32 10 C42 10 46 20 46 34 C46 46 40 55 32 55 C24 55 18 46 18 34 C18 20 22 10 32 10 Z" fill="#d9f06d" />
    <circle cx="32" cy="36" r="9" fill="#a76e16" />
  </svg>
);

const Broccoli = (
  <svg viewBox="0 0 64 64" width="100%" height="100%">
    <path d="M27 34 h10 v18 q-5 4 -10 0 Z" fill="#d9f06d" />
    <circle cx="22" cy="26" r="11" fill="#557c16" />
    <circle cx="42" cy="24" r="10" fill="#557c16" />
    <circle cx="32" cy="18" r="11" fill="#557c16" />
    <circle cx="26" cy="16" r="2.5" fill="#83b31c" />
    <circle cx="38" cy="22" r="2.5" fill="#83b31c" />
    <circle cx="22" cy="28" r="2.5" fill="#83b31c" />
  </svg>
);

const Lemon = (
  <svg viewBox="0 0 64 64" width="100%" height="100%">
    <circle cx="32" cy="32" r="23" fill="#ffd93d" />
    <circle cx="32" cy="32" r="18" fill="#fff3c4" />
    <g stroke="#ffd93d" strokeWidth="3" strokeLinecap="round">
      <path d="M32 16 V48" />
      <path d="M16 32 H48" />
      <path d="M21 21 L43 43" />
      <path d="M43 21 L21 43" />
    </g>
  </svg>
);

const Watermelon = (
  <svg viewBox="0 0 64 64" width="100%" height="100%">
    <path d="M6 42 A26 26 0 0 1 58 42 Z" fill="#ffd93d" />
    <path d="M6 42 A26 26 0 0 1 58 42" fill="none" stroke="#fdfbf3" strokeWidth="5" />
    <path d="M6 42 A26 26 0 0 1 58 42" fill="none" stroke="#557c16" strokeWidth="8" strokeLinecap="round" />
    <circle cx="24" cy="30" r="2.2" fill="#18342b" />
    <circle cx="36" cy="26" r="2.2" fill="#18342b" />
    <circle cx="32" cy="36" r="2.2" fill="#18342b" />
  </svg>
);

const Coffee = (
  <svg viewBox="0 0 64 64" width="100%" height="100%">
    <g stroke="#0f766e" strokeWidth="2.5" fill="none" strokeLinecap="round">
      <path d="M24 18 q3 -4 0 -9" />
      <path d="M32 18 q3 -4 0 -9" />
    </g>
    <path d="M12 26 h30 v10 a15 11 0 0 1 -30 0 Z" fill="#14b8a6" />
    <path d="M42 28 h5 a6 6 0 0 1 0 12 h-8" fill="none" stroke="#14b8a6" strokeWidth="3.5" />
    <path d="M10 52 h34" stroke="#0f766e" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

const Cloche = (
  <svg viewBox="0 0 64 64" width="100%" height="100%">
    <path d="M8 44 a24 22 0 0 1 48 0 Z" fill="#d9f06d" stroke="#799d13" strokeWidth="3" strokeLinejoin="round" />
    <circle cx="32" cy="17" r="4" fill="#799d13" />
    <path d="M6 49 h52" stroke="#799d13" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

const Utensils = (
  <svg viewBox="0 0 64 64" width="100%" height="100%">
    <g fill="#0f766e">
      <rect x="19" y="6" width="3.5" height="14" rx="1.75" />
      <rect x="26.5" y="6" width="3.5" height="14" rx="1.75" />
      <rect x="34" y="6" width="3.5" height="14" rx="1.75" />
      <path d="M19 18 h18.5 v4 a9.25 8 0 0 1 -18.5 0 Z" />
      <rect x="26.5" y="27" width="4.5" height="31" rx="2.2" />
    </g>
    <g fill="#799d13">
      <ellipse cx="50" cy="14" rx="8" ry="11" />
      <rect x="47.5" y="24" width="5" height="34" rx="2.2" />
    </g>
  </svg>
);

const Pot = (
  <svg viewBox="0 0 64 64" width="100%" height="100%">
    <g stroke="#d9f06d" strokeWidth="3" fill="none" strokeLinecap="round">
      <path d="M26 20 q3 -4 0 -9" />
      <path d="M38 20 q3 -4 0 -9" />
    </g>
    <path d="M12 27 h40 l-3 24 a7 6 0 0 1 -7 5 H22 a7 6 0 0 1 -7 -5 Z" fill="#14b8a6" />
    <rect x="3" y="30" width="9" height="4.5" rx="2.25" fill="#0f766e" />
    <rect x="52" y="30" width="9" height="4.5" rx="2.25" fill="#0f766e" />
  </svg>
);

type Item = {
  cls: string;
  size: number;
  anim: string;
  dur: string;
  delay?: string;
  opacity?: number;
  svg: ReactNode;
};

const ITEMS: Item[] = [
  { cls: 'left-[4%] top-[8%]', size: 74, anim: 'animate-floaty', dur: '8s', opacity: 0.7, svg: Leaf },
  { cls: 'right-[7%] top-[6%]', size: 84, anim: 'animate-wiggle', dur: '5s', opacity: 0.75, svg: Pizza },
  { cls: 'left-[3%] top-[44%]', size: 66, anim: 'animate-floaty-alt', dur: '9s', delay: '0.4s', opacity: 0.65, svg: Avocado },
  { cls: 'right-[3%] top-[38%]', size: 72, anim: 'animate-floaty', dur: '7s', delay: '0.8s', opacity: 0.7, svg: Donut },
  { cls: 'left-[9%] bottom-[8%]', size: 68, anim: 'animate-floaty-alt', dur: '8s', delay: '0.2s', opacity: 0.65, svg: Broccoli },
  { cls: 'right-[10%] bottom-[12%]', size: 62, anim: 'animate-floaty', dur: '6.5s', delay: '1s', opacity: 0.7, svg: Lemon },
  { cls: 'left-[44%] top-[3%]', size: 60, anim: 'animate-floaty-alt', dur: '7.5s', opacity: 0.45, svg: Watermelon },
  { cls: 'right-[28%] top-[13%]', size: 54, anim: 'animate-wiggle', dur: '6s', delay: '0.6s', opacity: 0.5, svg: Coffee },
  { cls: 'left-[16%] top-[70%]', size: 58, anim: 'animate-floaty', dur: '7s', delay: '1.2s', opacity: 0.5, svg: Cloche },
  { cls: 'right-[38%] bottom-[5%]', size: 62, anim: 'animate-floaty-alt', dur: '8.5s', delay: '0.5s', opacity: 0.55, svg: Utensils },
  { cls: 'left-[30%] top-[22%]', size: 56, anim: 'animate-floaty', dur: '9s', delay: '1.4s', opacity: 0.35, svg: Pot },
];

export default function FoodBackdrop({ opacity = 0.55, className = '' }: { opacity?: number; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} style={{ opacity }}>
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#d9f06d] opacity-30 blur-3xl" />
      <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-[#14b8a6] opacity-20 blur-3xl" />
      <div className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-[#799d13] opacity-20 blur-3xl" />
      {ITEMS.map((item, i) => (
        <div
          key={i}
          className={`absolute ${item.cls} ${item.anim}`}
          style={{ width: item.size, height: item.size, animationDuration: item.dur, animationDelay: item.delay, opacity: item.opacity }}
        >
          {item.svg}
        </div>
      ))}
    </div>
  );
}
