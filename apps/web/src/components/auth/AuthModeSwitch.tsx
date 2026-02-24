import { Button } from '@/components/ui/button'

type AuthModeSwitchProps = {
  isSignUp: boolean
  onChange: (nextValue: boolean) => void
}

function AuthModeSwitch({ isSignUp, onChange }: AuthModeSwitchProps) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
      <Button
        type="button"
        variant={isSignUp ? 'ghost' : 'secondary'}
        onClick={() => onChange(false)}
        className="w-full"
      >
        Login
      </Button>
      <Button
        type="button"
        variant={isSignUp ? 'secondary' : 'ghost'}
        onClick={() => onChange(true)}
        className="w-full"
      >
        Sign Up
      </Button>
    </div>
  )
}

export { AuthModeSwitch }
