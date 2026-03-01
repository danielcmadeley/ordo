import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type AppChromeContextValue = {
  topRightContent: ReactNode | null
  bottomCenterContent: ReactNode | null
  setTopRightContent: (content: ReactNode | null) => void
  setBottomCenterContent: (content: ReactNode | null) => void
}

const AppChromeContext = createContext<AppChromeContextValue | null>(null)

export function AppChromeProvider({ children }: { children: ReactNode }) {
  const [topRightContent, setTopRightContent] = useState<ReactNode | null>(null)
  const [bottomCenterContent, setBottomCenterContent] = useState<ReactNode | null>(null)

  const value = useMemo(
    () => ({
      topRightContent,
      bottomCenterContent,
      setTopRightContent,
      setBottomCenterContent,
    }),
    [bottomCenterContent, topRightContent]
  )

  return <AppChromeContext.Provider value={value}>{children}</AppChromeContext.Provider>
}

export function useAppChrome() {
  const context = useContext(AppChromeContext)
  if (!context) throw new Error('useAppChrome must be used within AppChromeProvider')
  return context
}
