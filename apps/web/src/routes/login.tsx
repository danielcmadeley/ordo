import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import authClient, { invalidateSessionCache } from '@/lib/authClient'
import { redirectAuthenticatedUser } from '@/lib/auth-guards'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AuthModeSwitch } from '@/components/auth/AuthModeSwitch'
import { EmailAuthForm } from '@/components/auth/EmailAuthForm'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'

export const Route = createFileRoute('/login')({
  component: LoginPage,
  beforeLoad: redirectAuthenticatedUser,
})

function LoginPage() {
  const navigate = useNavigate()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const resetStateForMode = (nextValue: boolean) => {
    setIsSignUp(nextValue)
    setError(null)
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    setError(null)

    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: window.location.origin,
      })
    } catch {
      setError('Failed to sign in with Google. Please try again.')
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const result = isSignUp
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password })

      if (result.error) {
        const fallbackMessage = isSignUp
          ? 'Failed to create account. Please try again.'
          : 'Invalid email or password. Please try again.'

        setError(result.error.message || fallbackMessage)
        return
      }

      invalidateSessionCache()
      navigate({ to: '/' })
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="bg-card text-card-foreground border-border shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-foreground">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {isSignUp
                ? 'Sign up to get started with your todos'
                : 'Sign in to continue to your todos'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <AuthModeSwitch isSignUp={isSignUp} onChange={resetStateForMode} />

            <EmailAuthForm
              isSignUp={isSignUp}
              isLoading={isLoading}
              name={name}
              email={email}
              password={password}
              onNameChange={setName}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onSubmit={handleSubmit}
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <GoogleSignInButton
              isLoading={isGoogleLoading}
              onClick={handleGoogleSignIn}
            />

            <div className="text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 text-primary hover:text-primary/80"
                onClick={() => resetStateForMode(!isSignUp)}
              >
                {isSignUp ? 'Sign in' : 'Sign up'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
