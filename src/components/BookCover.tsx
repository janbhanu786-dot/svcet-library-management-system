import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import type { CoverVariant, Department } from '../types/library';

const CS_COVER = '/src/assets/images/cover-cs.jpg';
const ECE_COVER = '/src/assets/images/cover-ece.jpg';

const VARIANT_STYLES: Record<CoverVariant, { bg: string; accent: string }> = {
  cs: { bg: 'from-[#172554] to-[#1E3A8A]', accent: 'text-sky-200' },
  ece: { bg: 'from-[#064E3B] to-[#0F766E]', accent: 'text-emerald-200' },
  navy: { bg: 'from-[#0F172A] to-[#1E293B]', accent: 'text-slate-300' },
  emerald: { bg: 'from-[#14532D] to-[#166534]', accent: 'text-emerald-200' },
  slate: { bg: 'from-[#1E293B] to-[#334155]', accent: 'text-amber-200' },
};

interface BookCoverProps {
  title: string;
  department: Department;
  variant: CoverVariant;
  className?: string;
}

export function BookCover({ title, department, variant, className = '' }: BookCoverProps) {
  const [imgError, setImgError] = useState(false);

  const imageSrc =
    variant === 'cs' ? CS_COVER : variant === 'ece' ? ECE_COVER : null;

  const palette = VARIANT_STYLES[variant] || VARIANT_STYLES.navy;

  if (imageSrc && !imgError) {
    return (
      <div className={`relative overflow-hidden rounded-md bg-slate-900 ${className}`}>
        <img
          src={imageSrc}
          alt={`${title} academic textbook cover`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent p-3 flex flex-col justify-end">
          <span className="text-[11px] font-mono uppercase tracking-wider text-amber-200">
            {department}
          </span>
          <p className="mt-0.5 text-xs font-semibold leading-snug text-white line-clamp-2">
            {title}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-md bg-gradient-to-br ${palette.bg} p-3.5 flex flex-col justify-between text-white ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-mono tracking-wider ${palette.accent}`}>
          {department}
        </span>
        <BookOpen className="h-3.5 w-3.5 text-white/60" aria-hidden="true" />
      </div>
      <div>
        <div className="mb-2 h-px w-8 bg-amber-400/70" />
        <p className="text-xs font-semibold leading-snug text-white line-clamp-3">
          {title}
        </p>
      </div>
    </div>
  );
}
