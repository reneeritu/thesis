import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

const variantClass: Record<Variant, string> = {
  primary:
    'border border-black bg-yellow-400 text-black hover:bg-black hover:text-yellow-400',
  secondary:
    'border border-black bg-white text-black hover:bg-black hover:text-yellow-400',
  danger:
    'border border-black bg-grey-100 text-black hover:bg-black hover:text-yellow-400',
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
