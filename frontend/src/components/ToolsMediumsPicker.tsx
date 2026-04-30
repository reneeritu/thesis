/**
 * Tools & mediums picker for Discover page filtering.
 * Scrollable lists with search.
 */
import { useState } from 'react'
import { TOOLS_AND_MEDIUMS } from '../lib/interestPresets'

type Props = {
  selectedTools: Set<string>
  selectedMediums: Set<string>
  onToggleTool: (tool: string) => void
  onToggleMedium: (medium: string) => void
}

export function ToolsMediumsPicker({
  selectedTools,
  selectedMediums,
  onToggleTool,
  onToggleMedium,
}: Props) {
  const [toolsSearch, setToolsSearch] = useState('')
  const [mediumsSearch, setMediumsSearch] = useState('')

  const filteredTools = (TOOLS_AND_MEDIUMS.tools as readonly string[]).filter((t) =>
    t.toLowerCase().includes(toolsSearch.toLowerCase()),
  )
  const filteredMediums = (TOOLS_AND_MEDIUMS.mediums as readonly string[]).filter((m) =>
    m.toLowerCase().includes(mediumsSearch.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block font-mono text-xs uppercase tracking-[0.22em] text-white/45">
          Tools & software
        </label>
        <input
          type="search"
          value={toolsSearch}
          onChange={(e) => setToolsSearch(e.target.value)}
          placeholder="Search tools..."
          className="mb-2 w-full border border-white/20 bg-zinc-900/55 px-3 py-2 font-mono text-small text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none"
        />
        <div className="max-h-[200px] space-y-1 overflow-y-auto">
          {filteredTools.map((tool) => (
            <label key={tool} className="flex cursor-pointer items-center gap-2 text-small">
              <input
                type="checkbox"
                checked={selectedTools.has(tool)}
                onChange={() => onToggleTool(tool)}
                className="h-3.5 w-3.5 shrink-0 rounded border-white/30 bg-zinc-900 accent-white/75"
              />
              <span className="text-white/80">{tool}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block font-mono text-xs uppercase tracking-[0.22em] text-white/45">
          Mediums & materials
        </label>
        <input
          type="search"
          value={mediumsSearch}
          onChange={(e) => setMediumsSearch(e.target.value)}
          placeholder="Search mediums..."
          className="mb-2 w-full border border-white/20 bg-zinc-900/55 px-3 py-2 font-mono text-small text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none"
        />
        <div className="max-h-[200px] space-y-1 overflow-y-auto">
          {filteredMediums.map((medium) => (
            <label key={medium} className="flex cursor-pointer items-center gap-2 text-small">
              <input
                type="checkbox"
                checked={selectedMediums.has(medium)}
                onChange={() => onToggleMedium(medium)}
                className="h-3.5 w-3.5 shrink-0 rounded border-white/30 bg-zinc-900 accent-white/75"
              />
              <span className="text-white/80">{medium}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
