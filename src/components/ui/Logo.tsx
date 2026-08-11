import { cn } from '@/lib/utils';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export function Logo({ className = 'h-10 w-10', ...props }: LogoProps) {
  return (
    <svg viewBox="30 30 140 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn(className)} {...props}>
      <defs>
        <linearGradient id="capGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#8B5CF6', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#6D28D9', stopOpacity: 1 }} />
        </linearGradient>
      </defs>

      {/* Chat Bubble Base */}
      <path
        d="M160 105C160 135.376 133.137 160 100 160C89.6 160 79.8 157.6 71.3 153.4L50 165V135C43.7 126.8 40 116.3 40 105C40 74.624 66.863 50 100 50C133.137 50 160 74.624 160 105Z"
        fill="url(#capGradient)"
      />

      {/* Cap Top */}
      <path d="M100 35L150 60L100 85L50 60L100 35Z" fill="#5B21B6" stroke="white" strokeWidth="2" strokeLinejoin="round" />

      {/* Tassel */}
      <circle cx="100" cy="60" r="3" fill="#FBBF24" />
      <path d="M100 60L125 75L120 95" stroke="#FBBF24" strokeWidth="2" />
      <circle cx="120" cy="95" r="3" fill="#FBBF24" />
    </svg>
  );
}
