const VARIANTS = {
  primary:
    'bg-clay-500 text-white shadow-card hover:bg-clay-600 active:bg-clay-700 disabled:bg-clay-300',
  secondary:
    'bg-white text-ink-700 border border-cream-300 hover:border-clay-300 hover:text-clay-600 disabled:text-ink-400',
  ghost: 'text-ink-600 hover:bg-cream-200 disabled:text-ink-400',
  // For use on the dark welcome screen, where `secondary` would be a white slab.
  outline:
    'border border-cream-100/25 bg-cream-100/5 text-cream-100 hover:bg-cream-100/12 disabled:text-cream-200/40',
  dark: 'bg-ink-800 text-cream-100 hover:bg-ink-900 disabled:bg-ink-400',
};

const SIZES = {
  sm: 'h-9 px-3.5 text-[13px] rounded-xl',
  md: 'h-11 px-5 text-[15px] rounded-2xl',
  lg: 'h-[52px] px-6 text-[15px] rounded-2xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition
                  active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100
                  focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-clay-500/20
                  ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
