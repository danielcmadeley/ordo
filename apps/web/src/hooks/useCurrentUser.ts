import { useSession } from '@/lib/session-context'

function useCurrentUser() {
  const { session, isLoading, reload } = useSession()

  const user = session?.user?.id && session?.user?.email
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      }
    : null

  return { user, isLoading, reloadUser: reload }
}

export { useCurrentUser }
