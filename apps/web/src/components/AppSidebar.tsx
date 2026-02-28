import { Link, useRouterState, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Home01Icon,
  Briefcase01Icon,
  Book01Icon,
  Notebook01Icon,
  Group01Icon,
  Wallet01Icon,
  InboxIcon,
  DashboardCircleIcon,
  Folder01Icon,
  Task01Icon,
  Flag01Icon,
  Settings01Icon,
  Logout01Icon,
  UserIcon,
  SearchIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import authClient, { invalidateSessionCache } from '@/lib/authClient'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { clearCachedSession } from '@/lib/session-cache'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'

const topNavItems = [
  {
    to: '/knowledge-base' as const,
    icon: Book01Icon,
    label: 'Knowledge Base',
  },
  {
    to: '/crm' as const,
    icon: Group01Icon,
    label: 'CRM',
  },
  {
    to: '/finance' as const,
    icon: Wallet01Icon,
    label: 'Finance',
  },
]

export function AppSidebar() {
  const navigate = useNavigate()
  const { user, reloadUser } = useCurrentUser()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [isProjectSectionOpen, setIsProjectSectionOpen] = useState(pathname.startsWith('/project-manager'))
  const [isJournalSectionOpen, setIsJournalSectionOpen] = useState(pathname.startsWith('/journal'))

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsCommandOpen(open => !open)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleLogout = async () => {
    try {
      await authClient.signOut()
      clearCachedSession()
      invalidateSessionCache()
      await reloadUser()
      navigate({ to: '/login' })
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  const runCommand = (callback: () => void) => {
    callback()
    setIsCommandOpen(false)
  }

  return (
    <Sidebar collapsible="icon" className="md:bottom-[25px] md:h-[calc(100svh-25px)]">
      <SidebarHeader>
        <Link to="/project-manager/inbox" className="flex items-center px-2 py-1 text-lg font-bold group-data-[collapsible=icon]:hidden">
          Ordo
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setIsCommandOpen(true)}>
                <HugeiconsIcon icon={SearchIcon} size={16} />
                <span>Search</span>
                <span className="ml-auto text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">⌘K</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link to="/" />} isActive={pathname === '/'}>
                <HugeiconsIcon icon={Home01Icon} size={16} />
                <span>Home</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
              <div className="my-1 h-px bg-border/70" aria-hidden />
            </SidebarMenuItem>
            <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
              <SidebarMenuButton render={<Link to="/project-manager/dashboard" />} isActive={pathname.startsWith('/project-manager')}>
                <HugeiconsIcon icon={Briefcase01Icon} size={16} />
                <span>Project Manager</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
              <SidebarMenuButton render={<Link to="/journal/dashboard" />} isActive={pathname.startsWith('/journal')}>
                <HugeiconsIcon icon={Notebook01Icon} size={16} />
                <span>Journal</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link to="/project-manager/dashboard" />} isActive={pathname.startsWith('/project-manager')}>
                <HugeiconsIcon icon={Briefcase01Icon} size={16} />
                <span>Project Manager</span>
              </SidebarMenuButton>
              <SidebarMenuAction
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setIsProjectSectionOpen(current => !current)
                }}
              >
                <HugeiconsIcon icon={isProjectSectionOpen ? ArrowUp01Icon : ArrowDown01Icon} size={14} />
              </SidebarMenuAction>
              {isProjectSectionOpen && (
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link to="/project-manager/dashboard" />} isActive={pathname === '/project-manager/dashboard'}>
                      <HugeiconsIcon icon={DashboardCircleIcon} size={14} />
                      <span>Dashboard</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link to="/project-manager/inbox" />} isActive={pathname === '/project-manager/inbox'}>
                      <HugeiconsIcon icon={InboxIcon} size={14} />
                      <span>Inbox</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={<Link to="/project-manager/projects" search={{ view: 'list', dialog: undefined }} />}
                      isActive={pathname === '/project-manager/projects'}
                    >
                      <HugeiconsIcon icon={Folder01Icon} size={14} />
                      <span>Projects</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link to="/project-manager/tasks" />} isActive={pathname === '/project-manager/tasks'}>
                      <HugeiconsIcon icon={Task01Icon} size={14} />
                      <span>Tasks</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link to="/project-manager/milestones" />} isActive={pathname === '/project-manager/milestones'}>
                      <HugeiconsIcon icon={Flag01Icon} size={14} />
                      <span>Milestones</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton render={<Link to="/journal/dashboard" />} isActive={pathname.startsWith('/journal')}>
                <HugeiconsIcon icon={Notebook01Icon} size={16} />
                <span>Journal</span>
              </SidebarMenuButton>
              <SidebarMenuAction
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setIsJournalSectionOpen(current => !current)
                }}
              >
                <HugeiconsIcon icon={isJournalSectionOpen ? ArrowUp01Icon : ArrowDown01Icon} size={14} />
              </SidebarMenuAction>
              {isJournalSectionOpen && (
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link to="/journal/dashboard" />} isActive={pathname === '/journal/dashboard'}>
                      <HugeiconsIcon icon={DashboardCircleIcon} size={14} />
                      <span>Dashboard</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link to="/journal/daily-entry" />} isActive={pathname === '/journal/daily-entry'}>
                      <HugeiconsIcon icon={Notebook01Icon} size={14} />
                      <span>Daily Entry</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link to="/journal/timeline" />} isActive={pathname === '/journal/timeline'}>
                      <HugeiconsIcon icon={Task01Icon} size={14} />
                      <span>Timeline</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>

            {topNavItems.map(({ to, icon, label }) => (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton render={<Link to={to} />} isActive={pathname.startsWith(to)}>
                  <HugeiconsIcon icon={icon} size={16} />
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {user && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<SidebarMenuButton isActive={pathname === '/settings'} />}
                >
                  <HugeiconsIcon icon={UserIcon} size={16} />
                  <span className="truncate">{user.name || user.email}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => navigate({ to: '/settings' })}>
                    <HugeiconsIcon icon={Settings01Icon} size={16} />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout}>
                <HugeiconsIcon icon={Logout01Icon} size={16} />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}

      <CommandDialog
        open={isCommandOpen}
        onOpenChange={setIsCommandOpen}
        title="Search"
        description="Quickly jump to pages and actions"
      >
        <Command>
          <CommandInput placeholder="Search pages and actions..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Navigation">
              <CommandItem onSelect={() => runCommand(() => navigate({ to: '/' }))}>
                <HugeiconsIcon icon={Home01Icon} size={16} />
                <span>Home</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate({ to: '/project-manager/inbox' }))}>
                <HugeiconsIcon icon={InboxIcon} size={16} />
                <span>Project Manager Inbox</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate({ to: '/project-manager/projects', search: { view: 'list', dialog: undefined } }))}>
                <HugeiconsIcon icon={Folder01Icon} size={16} />
                <span>Projects</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate({ to: '/knowledge-base' }))}>
                <HugeiconsIcon icon={Book01Icon} size={16} />
                <span>Knowledge Base</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate({ to: '/journal/dashboard' }))}>
                <HugeiconsIcon icon={Notebook01Icon} size={16} />
                <span>Journal Dashboard</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate({ to: '/journal/daily-entry' }))}>
                <HugeiconsIcon icon={Notebook01Icon} size={16} />
                <span>Journal Daily Entry</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate({ to: '/journal/timeline' }))}>
                <HugeiconsIcon icon={Task01Icon} size={16} />
                <span>Journal Timeline</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => navigate({ to: '/settings' }))}>
                <HugeiconsIcon icon={Settings01Icon} size={16} />
                <span>Settings</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => runCommand(() => navigate({ to: '/project-manager/projects', search: { view: 'list', dialog: 'project' } }))}
              >
                <HugeiconsIcon icon={Briefcase01Icon} size={16} />
                <span>Create project</span>
                <CommandShortcut>⌘P</CommandShortcut>
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => navigate({ to: '/project-manager/projects', search: { view: 'list', dialog: 'task' } }))}
              >
                <HugeiconsIcon icon={Task01Icon} size={16} />
                <span>Create task</span>
                <CommandShortcut>⌘T</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </Sidebar>
  )
}
