import {
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttFeatureRow,
  GanttHeader,
  GanttProvider,
  GanttSidebar,
  GanttSidebarGroup,
  GanttSidebarItem,
  GanttTimeline,
  GanttToday,
  type GanttFeature,
} from '@/components/kibo-ui/gantt'

type GanttProjectGroup = {
  project: { id: number; name: string }
  features: GanttFeature[]
}

type ProjectsGanttViewProps = {
  groups: GanttProjectGroup[]
  onOpenTaskEditor: (taskId: number) => void
  onMove: (id: string, startAt: Date, endAt: Date | null) => void
}

export function ProjectsGanttView({ groups, onOpenTaskEditor, onMove }: ProjectsGanttViewProps) {
  return (
    <div className="h-full overflow-hidden">
      <div className="h-full overflow-hidden">
        <GanttProvider range="monthly">
          <GanttSidebar>
            {groups.map(group => (
              <GanttSidebarGroup key={group.project.id} name={group.project.name}>
                {group.features.length === 0 ? (
                  <div className="border-border/50 border-t" style={{ height: 'var(--gantt-row-height)' }} />
                ) : (
                  group.features.map(feature => (
                    <GanttSidebarItem
                      key={feature.id}
                      feature={feature}
                      onSelectItem={id => onOpenTaskEditor(Number(id))}
                    />
                  ))
                )}
              </GanttSidebarGroup>
            ))}
          </GanttSidebar>
          <GanttTimeline>
            <GanttHeader />
            <GanttFeatureList>
              {groups.map(group => (
                <GanttFeatureListGroup key={`row-${group.project.id}`}>
                  <GanttFeatureRow features={group.features} onMove={onMove} />
                </GanttFeatureListGroup>
              ))}
            </GanttFeatureList>
            <GanttToday />
          </GanttTimeline>
        </GanttProvider>
      </div>
    </div>
  )
}
