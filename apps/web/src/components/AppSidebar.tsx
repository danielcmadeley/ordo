import { Link, useRouterState, useNavigate } from '@tanstack/react-router'
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'

const topNavItems = [
  {
    to: '/knowledge-base' as const,
    icon: Book01Icon,
    label: 'Knowledge Base',
  },
  {
    to: '/journal' as const,
    icon: Notebook01Icon,
    label: 'Journal',
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/project-manager/inbox" className="flex items-center px-2 py-1 text-lg font-bold group-data-[collapsible=icon]:hidden">
          Ordo
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {/* Dashboard */}
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link to="/" />}
                isActive={pathname === '/'}
              >
                <HugeiconsIcon icon={Home01Icon} size={16} />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Project Manager with Inbox sub-item */}
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link to="/project-manager/inbox" />}
                isActive={pathname.startsWith('/project-manager')}
              >
                <HugeiconsIcon icon={Briefcase01Icon} size={16} />
                <span>Project Manager</span>
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    render={<Link to="/project-manager/dashboard" />}
                    isActive={pathname === '/project-manager/dashboard'}
                  >
                    <HugeiconsIcon icon={DashboardCircleIcon} size={14} />
                    <span>Dashboard</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    render={<Link to="/project-manager/inbox" />}
                    isActive={pathname === '/project-manager/inbox'}
                  >
                    <HugeiconsIcon icon={InboxIcon} size={14} />
                    <span>Inbox</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    render={<Link to="/project-manager/projects" />}
                    isActive={pathname === '/project-manager/projects'}
                  >
                    <HugeiconsIcon icon={Folder01Icon} size={14} />
                    <span>Projects</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    render={<Link to="/project-manager/tasks" />}
                    isActive={pathname === '/project-manager/tasks'}
                  >
                    <HugeiconsIcon icon={Task01Icon} size={14} />
                    <span>Tasks</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    render={<Link to="/project-manager/milestones" />}
                    isActive={pathname === '/project-manager/milestones'}
                  >
                    <HugeiconsIcon icon={Flag01Icon} size={14} />
                    <span>Milestones</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>

            {/* Other top-level routes */}
            {topNavItems.map(({ to, icon, label }) => (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton
                  render={<Link to={to} />}
                  isActive={pathname.startsWith(to)}
                >
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
              <SidebarMenuButton
                render={<Link to="/settings" />}
                isActive={pathname === '/settings'}
              >
                <HugeiconsIcon icon={Settings01Icon} size={16} />
                <span className="truncate">Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link to="/settings" />}
                isActive={false}
              >
                <HugeiconsIcon icon={UserIcon} size={16} />
                <span className="truncate">{user.name || user.email}</span>
              </SidebarMenuButton>
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
    </Sidebar>
  )
}
