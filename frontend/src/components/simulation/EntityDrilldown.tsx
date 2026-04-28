import type { Selection } from './MacroNetworkView'
import { NodeDetail } from './EntityDetail/NodeDetail'
import { SpaceDetail } from './EntityDetail/SpaceDetail'
import { ProjectDetail } from './EntityDetail/ProjectDetail'

type Props = {
  selection: Selection
  onNavigateSpace?: (spaceId: string) => void
}

export function EntityDrilldown({ selection, onNavigateSpace }: Props) {
  if (!selection) {
    return (
      <div className="rounded border border-white/10 bg-black/40 p-3 text-small leading-relaxed text-white/45">
        Select a node, space, or project on the canvas to drill down.
      </div>
    )
  }
  switch (selection.kind) {
    case 'space':
      return <SpaceDetail id={selection.id} />
    case 'node':
      return <NodeDetail alias={selection.alias} />
    case 'project':
      return <ProjectDetail id={selection.id} onNavigateSpace={onNavigateSpace} />
    default:
      return null
  }
}
