import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { requireAuthSession } from '@/lib/auth-guards'

export const Route = createFileRoute('/finance')({
  component: FinancePage,
  beforeLoad: requireAuthSession,
})

const apiBase = import.meta.env.VITE_API_URL || ''

type Institution = {
  id: string
  name: string
  bic?: string | null
  countries: string[]
  transaction_total_days?: string
}

type BalanceItem = {
  balanceAmount: { amount: string; currency: string }
  balanceType: string
  referenceDate?: string
}

type TransactionItem = {
  transactionId?: string
  bookingDate?: string
  valueDate?: string
  transactionAmount: { amount: string; currency: string }
  remittanceInformationUnstructured?: string
  creditorName?: string
  debtorName?: string
}

type AccountsResponse = {
  connected: boolean
  requisitionId?: string
  institutionId?: string
  institutionName?: string | null
  status?: string
  accountIds?: string[]
}

type CacheMeta = {
  fromCache?: boolean
  stale?: boolean
  cachedAt?: string
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    ...init,
  })
  const json = await res.json()
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Request failed')
  return json as T
}

function FinancePage() {
  const [country, setCountry] = useState('GB')
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('')
  const [selectedInstitutionName, setSelectedInstitutionName] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const queryParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const gcStatus = queryParams.get('gc')
  const gcReason = queryParams.get('gc_reason')

  useEffect(() => {
    if (gcStatus === 'connected') {
      setError(null)
    } else if (gcStatus === 'error') {
      setError(`Bank connection failed${gcReason ? `: ${gcReason}` : ''}`)
    } else if (gcStatus === 'pending') {
      setError('Bank authorization was not completed. Please try again.')
    }
  }, [gcStatus, gcReason])

  // Fetch institutions
  const institutionsQuery = useQuery({
    queryKey: ['gc-institutions', country],
    queryFn: () => apiFetch<Institution[]>(`/api/gocardless/institutions?country=${encodeURIComponent(country)}`),
  })
  const institutions = institutionsQuery.data ?? []

  // Fetch accounts
  const accountsQuery = useQuery({
    queryKey: ['gc-accounts'],
    queryFn: () => apiFetch<AccountsResponse>('/api/gocardless/accounts'),
  })
  const accountsData = accountsQuery.data
  const isConnected = accountsData?.connected ?? false
  const accountIds = accountsData?.accountIds ?? []

  useEffect(() => {
    if (accountIds.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accountIds[0])
    }
  }, [accountIds, selectedAccountId])

  // Fetch balances
  const balancesQuery = useQuery({
    queryKey: ['gc-balances', selectedAccountId],
    queryFn: () => apiFetch<{ balances?: BalanceItem[]; _meta?: CacheMeta }>(`/api/gocardless/accounts/${selectedAccountId}/balances`),
    enabled: Boolean(selectedAccountId),
  })

  // Fetch transactions
  const transactionsQuery = useQuery({
    queryKey: ['gc-transactions', selectedAccountId],
    queryFn: () => apiFetch<{ transactions?: { booked?: TransactionItem[] }; _meta?: CacheMeta }>(`/api/gocardless/accounts/${selectedAccountId}/transactions`),
    enabled: Boolean(selectedAccountId),
  })

  // Fetch details
  const detailsQuery = useQuery({
    queryKey: ['gc-details', selectedAccountId],
    queryFn: () => apiFetch<{ account?: Record<string, unknown>; _meta?: CacheMeta }>(`/api/gocardless/accounts/${selectedAccountId}/details`),
    enabled: Boolean(selectedAccountId),
  })

  const balances = balancesQuery.data?.balances ?? []
  const bookedTransactions = transactionsQuery.data?.transactions?.booked ?? []
  const accountDetails = detailsQuery.data?.account

  const connectBank = () => {
    if (!selectedInstitutionId) return
    const returnTo = window.location.href.split('?')[0]
    window.location.href = `${apiBase}/api/gocardless/connect?institution_id=${encodeURIComponent(selectedInstitutionId)}&institution_name=${encodeURIComponent(selectedInstitutionName)}&returnTo=${encodeURIComponent(returnTo)}`
  }

  const disconnect = async () => {
    try {
      await apiFetch('/api/gocardless/disconnect', { method: 'POST' })
      await queryClient.invalidateQueries({ queryKey: ['gc-accounts'] })
      setSelectedAccountId(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    }
  }

  return (
    <div className="h-full min-h-0 overflow-auto p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance</h1>
          <p className="mt-2 text-muted-foreground">Connect your bank account via Open Banking to view balances and transactions.</p>
          {gcStatus === 'connected' && (
            <p className="mt-2 text-sm text-primary">Bank account connected successfully.</p>
          )}
        </div>

        {/* Connection section */}
        {!isConnected && (
          <section className="rounded-xl border border-border/70 bg-card/70 p-4">
            <h2 className="text-lg font-semibold">Connect Bank</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select your country and bank to connect via GoCardless Open Banking.</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-[120px_1fr_auto] sm:items-end">
              <label className="text-sm text-muted-foreground">
                Country
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value)
                    setSelectedInstitutionId('')
                    setSelectedInstitutionName('')
                  }}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  {[
                    'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES',
                    'FI', 'FR', 'GB', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT',
                    'LI', 'LT', 'LU', 'LV', 'MT', 'NL', 'NO', 'PL', 'PT',
                    'RO', 'SE', 'SI', 'SK',
                  ].map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-muted-foreground">
                Bank
                <select
                  value={selectedInstitutionId}
                  onChange={(e) => {
                    setSelectedInstitutionId(e.target.value)
                    const inst = institutions.find((i) => i.id === e.target.value)
                    setSelectedInstitutionName(inst?.name ?? '')
                  }}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  disabled={institutionsQuery.isLoading}
                >
                  <option value="">
                    {institutionsQuery.isLoading ? 'Loading banks...' : 'Select a bank'}
                  </option>
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
              </label>

              <Button
                onClick={connectBank}
                disabled={!selectedInstitutionId}
              >
                Connect Bank
              </Button>
            </div>
          </section>
        )}

        {/* Connected state */}
        {isConnected && (
          <section className="rounded-xl border border-border/70 bg-card/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Bank Connection</h2>
                <p className="text-sm text-muted-foreground">
                  Connected to {accountsData?.institutionName ?? accountsData?.institutionId}
                  {accountIds.length > 0 && ` — ${accountIds.length} account${accountIds.length > 1 ? 's' : ''}`}
                </p>
              </div>
              <Button variant="outline" onClick={() => { void disconnect() }}>
                Disconnect
              </Button>
            </div>

            {accountIds.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {accountIds.map((id, index) => (
                  <button
                    key={id}
                    onClick={() => setSelectedAccountId(id)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      selectedAccountId === id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    Account {index + 1}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Account Details */}
        {isConnected && selectedAccountId && accountDetails && (
          <section className="rounded-xl border border-border/70 bg-card/70 p-4">
            <h2 className="text-lg font-semibold">Account Details</h2>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries(accountDetails).map(([key, value]) => {
                if (key === '_meta' || value === null || value === undefined) return null
                return (
                  <div key={key} className="flex gap-2">
                    <span className="font-medium text-muted-foreground">{key}:</span>
                    <span className="text-foreground">{String(value)}</span>
                  </div>
                )
              })}
            </div>
            {detailsQuery.data?._meta && <CacheStatusBadge meta={detailsQuery.data._meta} />}
          </section>
        )}

        {/* Balances */}
        {isConnected && selectedAccountId && (
          <section className="rounded-xl border border-border/70 bg-card/70 p-4">
            <h2 className="text-lg font-semibold">Balances</h2>
            {balancesQuery.isLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading balances...</p>
            ) : balances.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No balance data available.</p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {balances.map((balance, index) => (
                  <div key={index} className="rounded-lg border border-border/70 bg-background/40 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {balance.balanceType.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-foreground">
                      {balance.balanceAmount.currency} {Number(balance.balanceAmount.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    {balance.referenceDate && (
                      <p className="mt-1 text-xs text-muted-foreground">as of {balance.referenceDate}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {balancesQuery.data?._meta && <CacheStatusBadge meta={balancesQuery.data._meta} />}
          </section>
        )}

        {/* Transactions */}
        {isConnected && selectedAccountId && (
          <section className="rounded-xl border border-border/70 bg-card/70 p-4">
            <h2 className="text-lg font-semibold">Transactions</h2>
            {transactionsQuery.isLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading transactions...</p>
            ) : bookedTransactions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No transactions found.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/70 text-left">
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Date</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Description</th>
                      <th className="pb-2 font-medium text-right text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookedTransactions.map((tx, index) => {
                      const amount = Number(tx.transactionAmount.amount)
                      const isPositive = amount >= 0
                      const description =
                        tx.remittanceInformationUnstructured ||
                        tx.creditorName ||
                        tx.debtorName ||
                        'Unknown'
                      return (
                        <tr key={tx.transactionId ?? index} className="border-b border-border/30">
                          <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                            {tx.bookingDate ?? tx.valueDate ?? '—'}
                          </td>
                          <td className="py-2 pr-4 text-foreground">{description}</td>
                          <td className={`py-2 text-right font-medium whitespace-nowrap ${isPositive ? 'text-emerald-600' : 'text-foreground'}`}>
                            {isPositive ? '+' : ''}{tx.transactionAmount.currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {transactionsQuery.data?._meta && <CacheStatusBadge meta={transactionsQuery.data._meta} />}
          </section>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

function CacheStatusBadge({ meta }: { meta: CacheMeta }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
      {meta.fromCache && (
        <span className={`inline-flex rounded-full px-2 py-0.5 ${meta.stale ? 'bg-amber-500/15 text-amber-700' : 'bg-primary/15 text-primary'}`}>
          {meta.stale ? 'Stale cache' : 'Cached'}
        </span>
      )}
      {meta.cachedAt && (
        <span>Cached at {new Date(meta.cachedAt).toLocaleTimeString()}</span>
      )}
    </div>
  )
}
