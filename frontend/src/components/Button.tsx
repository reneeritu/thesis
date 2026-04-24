import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

/* Fully transparent chrome; danger keeps readable text tint only. */
const variantClass: Record<Variant, string> = {
  primary: 'border border-transparent bg-transparent text-current hover:opacity-90',
  secondary: 'border border-transparent bg-transparent text-current hover:opacity-90',
  danger:
    'border border-transparent bg-transparent text-[color:var(--etch-danger-text)] hover:opacity-90',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  loading?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  type = 'button',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[
        'font-mono text-small uppercase tracking-[0.2em] px-4 py-2 sm:px-6 transition',
        'active:scale-[0.98]',
        loading ? 'cursor-wait opacity-80' : '',
        variantClass[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
