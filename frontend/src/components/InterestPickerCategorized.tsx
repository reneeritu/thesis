/**
 * Categorized interest picker component for register/hub with collapsible categories.
 * Shows only the selected interests on dashboard (view mode).
 */
import { useState } from 'react'
import { INTEREST_CATEGORIES, type InterestCategory } from '../lib/interestPresets'
import { mixBlack } from '../lib/colorMix'

type Props = {
  selected: Set<string>
  onToggle: (interest: string) => void
  variant?: 'edit' | 'view'
  theme?: 'light' | 'dark'
}

function chipColourForTag(tag: string): string {
  // Same hash logic as HubPage
  let h = 2166136261
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const colors = ['#e879f9', '#4f8ef7', '#ff4757', '#2ecc71', '#be5bea', '#00d2ff']
  return colors[Math.abs(h) % colors.length]!
}

export function InterestPickerCategorized({
  selected,
  onToggle,
  variant = 'edit',
  theme = 'dark',
}: Props) {
  const [expandedCategories, setExpandedCategories] = useState<Set<InterestCategory>>(
    new Set(Object.keys(INTEREST_CATEGORIES) as InterestCategory[]),
  )

  const toggleCategory = (cat: InterestCategory) => {
    const next = new Set(expandedCategories)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    setExpandedCategories(next)
  }

  const light = theme === 'light'

  // View mode: only show selected, grouped by category
  if (variant === 'view') {
    const byCategory = new Map<InterestCategory, string[]>()
    for (const [cat, { subcategories }] of Object.entries(INTEREST_CATEGORIES)) {
      const matched = (subcategories as readonly string[]).filter((s) => selected.has(s))
      if (matched.length > 0) {
        byCategory.set(cat as InterestCategory, matched)
      }
    }

    return (
      <div className="space-y-3">
        {Array.from(byCategory.entries()).map(([cat, items]) => (
          <div key={cat}>
            <h4 className="mb-1.5 text-xs uppercase tracking-[0.14em] text-white/45">
              {INTEREST_CATEGORIES[cat].label}
            </h4>
            <div className="flex flex-wrap gap-2">
              {items.map((tag) => {
                const col = chipColourForTag(tag)
                return (
                  <span
                    key={tag}
                    className="rounded-full px-2.5 py-0.5 text-base tracking-wide"
                    style={{
                      backgroundColor: light ? 'transparent' : `${col}22`,
                      color: light ? '#1a1a18' : col,
                      boxShadow: light
                        ? `inset 0 0 0 1px ${mixBlack(col, 0.3)}`
                        : `inset 0 0 0 1px ${col}44`,
                    }}
                  >
                    {tag}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Edit mode: all categories with subcategories
  return (
    <div className="space-y-4">
      {(Object.entries(INTEREST_CATEGORIES) as Array<[InterestCategory, typeof INTEREST_CATEGORIES[InterestCategory]]>).map(
        ([cat, { label, subcategories }]) => (
          <div key={cat}>
            <button
              type="button"
              onClick={() => toggleCategory(cat)}
              className="mb-2 flex w-full items-center justify-between text-left font-mono text-sm uppercase tracking-[0.14em] text-white/65 hover:text-white/85"
            >
              <span>{label}</span>
              <span aria-hidden className="text-xs">
                {expandedCategories.has(cat) ? '▾' : '▸'}
              </span>
            </button>
            {expandedCategories.has(cat) && (
              <div className="flex flex-wrap gap-2 pl-2">
                {subcategories.map((tag) => {
                  const on = selected.has(tag)
                  const col = chipColourForTag(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onToggle(tag)}
                      className="cursor-pointer rounded-full px-2.5 py-0.5 text-base tracking-wide transition hover:brightness-110"
                      style={{
                        backgroundColor: light ? 'transparent' : `${col}22`,
                        color: light ? '#1a1a18' : col,
                        boxShadow:
                          light && on
                            ? `inset 0 0 0 1px ${mixBlack(col, 0.3)}`
                            : light
                              ? 'none'
                              : on
                                ? `inset 0 0 0 1px ${col}55`
                                : 'none',
                      }}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ),
      )}
    </div>
  )
}
