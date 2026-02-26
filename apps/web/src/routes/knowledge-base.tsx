import { createFileRoute } from '@tanstack/react-router'
import { useStore } from '@livestore/react'
import { queryDb } from '@livestore/livestore'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { events, tables } from '@repo/shared/livestore-schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { cn } from '@/lib/utils'
import { requireAuthSession } from '@/lib/auth-guards'

export const Route = createFileRoute('/knowledge-base')({
  component: KnowledgeBasePage,
  beforeLoad: requireAuthSession,
})

type NotebookForm = { name: string; description: string }

const EMPTY_NOTEBOOK_FORM: NotebookForm = { name: '', description: '' }

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function KnowledgeBasePage() {
  const { store } = useStore()
  const [showNotebookForm, setShowNotebookForm] = useState(false)
  const [notebookForm, setNotebookForm] = useState<NotebookForm>(EMPTY_NOTEBOOK_FORM)
  const [selectedNotebookId, setSelectedNotebookId] = useState<number | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [contentDraft, setContentDraft] = useState('<p></p>')
  const [saveState, setSaveState] = useState<'saved' | 'unsaved' | 'saving'>('saved')
  const autosaveTimerRef = useRef<number | null>(null)

  const notebooks$ = useMemo(() => queryDb(() => tables.notebooks.where({}), { label: 'knowledge-notebooks' }), [])
  const notes$ = useMemo(() => queryDb(() => tables.notes.where({}), { label: 'knowledge-notes' }), [])
  const notebooks = store.useQuery(notebooks$)
  const notes = store.useQuery(notes$)

  const sortedNotebooks = useMemo(
    () => [...notebooks].sort((a, b) => b.updatedAt - a.updatedAt),
    [notebooks]
  )

  const notesForSelectedNotebook = useMemo(() => {
    if (selectedNotebookId === null) return []
    return notes
      .filter(note => note.notebookId === selectedNotebookId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [notes, selectedNotebookId])

  const selectedNote = useMemo(
    () => notes.find(note => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId]
  )

  const selectNotebook = (notebookId: number) => {
    if (notebookId === selectedNotebookId) return
    flushAutosaveNow()
    setSelectedNotebookId(notebookId)
  }

  const selectNote = (noteId: number) => {
    if (noteId === selectedNoteId) return
    flushAutosaveNow()
    setSelectedNoteId(noteId)
  }

  const persistDraft = useCallback(() => {
    if (!selectedNote) return false

    const cleanTitle = titleDraft.trim() || 'Untitled note'
    const currentContent = selectedNote.content || '<p></p>'

    if (cleanTitle === selectedNote.title && contentDraft === currentContent) {
      setSaveState('saved')
      return false
    }

    setSaveState('saving')
    const timestamp = Date.now()

    store.commit(
      events.noteUpdated({
        id: selectedNote.id,
        title: cleanTitle,
        content: contentDraft,
        updatedAt: timestamp,
      })
    )

    const activeNotebook = notebooks.find(notebook => notebook.id === selectedNote.notebookId)
    if (activeNotebook) {
      store.commit(
        events.notebookUpdated({
          id: activeNotebook.id,
          name: activeNotebook.name,
          description: activeNotebook.description,
          updatedAt: timestamp,
        })
      )
    }

    setSaveState('saved')
    return true
  }, [contentDraft, notebooks, selectedNote, store, titleDraft])

  const flushAutosaveNow = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    persistDraft()
  }, [persistDraft])

  useEffect(() => {
    if (sortedNotebooks.length === 0) {
      setSelectedNotebookId(null)
      return
    }

    if (selectedNotebookId === null || !sortedNotebooks.some(notebook => notebook.id === selectedNotebookId)) {
      setSelectedNotebookId(sortedNotebooks[0].id)
    }
  }, [selectedNotebookId, sortedNotebooks])

  useEffect(() => {
    if (selectedNotebookId === null) {
      setSelectedNoteId(null)
      return
    }

    const notebookNotes = notes
      .filter(note => note.notebookId === selectedNotebookId)
      .sort((a, b) => b.updatedAt - a.updatedAt)

    if (notebookNotes.length === 0) {
      setSelectedNoteId(null)
      return
    }

    if (selectedNoteId === null || !notebookNotes.some(note => note.id === selectedNoteId)) {
      setSelectedNoteId(notebookNotes[0].id)
    }
  }, [notes, selectedNotebookId, selectedNoteId])

  useEffect(() => {
    if (!selectedNote) {
      setTitleDraft('')
      setContentDraft('<p></p>')
      setSaveState('saved')
      return
    }

    setTitleDraft(selectedNote.title)
    setContentDraft(selectedNote.content || '<p></p>')
    setSaveState('saved')
  }, [selectedNote])

  useEffect(() => {
    if (!selectedNote) {
      setSaveState('saved')
      return
    }

    const cleanTitle = titleDraft.trim() || 'Untitled note'
    const currentContent = selectedNote.content || '<p></p>'
    const hasChanges = cleanTitle !== selectedNote.title || contentDraft !== currentContent

    if (!hasChanges) {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      setSaveState('saved')
      return
    }

    setSaveState('unsaved')

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null
      persistDraft()
    }, 700)

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [contentDraft, persistDraft, selectedNote, titleDraft])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushAutosaveNow()
      }
    }

    const handleBeforeUnload = () => {
      flushAutosaveNow()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [flushAutosaveNow])

  const createNotebook = () => {
    if (!notebookForm.name.trim()) return
    const id = Date.now()
    const timestamp = Date.now()
    store.commit(
      events.notebookCreated({
        id,
        name: notebookForm.name.trim(),
        description: notebookForm.description.trim(),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    )
    store.commit(
      events.historyRecorded({
        id: timestamp + 1,
        action: 'Created',
        entityType: 'notebook',
        entityId: id,
        entityText: notebookForm.name.trim(),
        timestamp,
      })
    )
    setNotebookForm(EMPTY_NOTEBOOK_FORM)
    setShowNotebookForm(false)
    setSelectedNotebookId(id)
  }

  const deleteNotebook = (id: number) => {
    const notebook = notebooks.find(item => item.id === id)
    if (!notebook) return

    const timestamp = Date.now()
    const notesInNotebook = notes.filter(note => note.notebookId === id)
    notesInNotebook.forEach(note => {
      store.commit(events.noteDeleted({ id: note.id }))
    })

    store.commit(events.notebookDeleted({ id }))
    store.commit(
      events.historyRecorded({
        id: timestamp,
        action: 'Deleted',
        entityType: 'notebook',
        entityId: id,
        entityText: notebook.name,
        timestamp,
      })
    )
  }

  const createNote = () => {
    if (selectedNotebookId === null) return
    flushAutosaveNow()
    const id = Date.now()
    const timestamp = Date.now()
    store.commit(
      events.noteCreated({
        id,
        notebookId: selectedNotebookId,
        title: 'Untitled note',
        content: '<p></p>',
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    )
    store.commit(events.noteUpdated({ id, title: 'Untitled note', content: '<p></p>', updatedAt: timestamp + 1 }))
    store.commit(events.notebookUpdated({
      id: selectedNotebookId,
      name: notebooks.find(notebook => notebook.id === selectedNotebookId)?.name ?? 'Notebook',
      description: notebooks.find(notebook => notebook.id === selectedNotebookId)?.description ?? '',
      updatedAt: timestamp + 2,
    }))
    setSelectedNoteId(id)
  }

  const deleteNote = (id: number) => {
    const note = notes.find(item => item.id === id)
    if (!note) return
    const timestamp = Date.now()
    store.commit(events.noteDeleted({ id }))
    store.commit(
      events.historyRecorded({
        id: timestamp,
        action: 'Deleted',
        entityType: 'note',
        entityId: id,
        entityText: note.title,
        timestamp,
      })
    )
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-7xl flex-col gap-4 p-6 lg:flex-row">
      <section className="w-full rounded-2xl border border-border bg-card p-4 lg:w-72 lg:shrink-0">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">Notebooks</h1>
          <Button size="sm" onClick={() => setShowNotebookForm(v => !v)}>
            {showNotebookForm ? 'Close' : 'New'}
          </Button>
        </div>

        {showNotebookForm && (
          <div className="mb-4 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <Input
              value={notebookForm.name}
              onChange={event => setNotebookForm({ ...notebookForm, name: event.target.value })}
              placeholder="Notebook name"
            />
            <Textarea
              rows={3}
              value={notebookForm.description}
              onChange={event => setNotebookForm({ ...notebookForm, description: event.target.value })}
              placeholder="Description"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={createNotebook} disabled={!notebookForm.name.trim()}>
                Create notebook
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {sortedNotebooks.map(notebook => (
            <div
              key={notebook.id}
              role="button"
              tabIndex={0}
              onClick={() => selectNotebook(notebook.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  selectNotebook(notebook.id)
                }
              }}
              className={cn(
                'w-full cursor-pointer rounded-xl border px-3 py-2 text-left transition-colors',
                selectedNotebookId === notebook.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background hover:bg-muted/40'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{notebook.name}</p>
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation()
                    deleteNotebook(notebook.id)
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Delete
                </button>
              </div>
              {notebook.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notebook.description}</p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">Updated {formatDate(notebook.updatedAt)}</p>
            </div>
          ))}
          {sortedNotebooks.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
              No notebooks yet. Create one to start writing.
            </p>
          )}
        </div>
      </section>

      <section className="w-full rounded-2xl border border-border bg-card p-4 lg:w-80 lg:shrink-0">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Notes</h2>
          <Button size="sm" onClick={createNote} disabled={selectedNotebookId === null}>
            New note
          </Button>
        </div>

        <div className="space-y-2">
          {notesForSelectedNotebook.map(note => (
            <div
              key={note.id}
              role="button"
              tabIndex={0}
              onClick={() => selectNote(note.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  selectNote(note.id)
                }
              }}
              className={cn(
                'w-full cursor-pointer rounded-xl border px-3 py-2 text-left transition-colors',
                selectedNoteId === note.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background hover:bg-muted/40'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{note.title || 'Untitled note'}</p>
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation()
                    deleteNote(note.id)
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Delete
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Updated {formatDate(note.updatedAt)}</p>
            </div>
          ))}

          {selectedNotebookId !== null && notesForSelectedNotebook.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
              This notebook has no notes yet.
            </p>
          )}
          {selectedNotebookId === null && (
            <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
              Select a notebook to view notes.
            </p>
          )}
        </div>
      </section>

      <section className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Input
            value={titleDraft}
            onChange={event => {
              setTitleDraft(event.target.value)
            }}
            placeholder="Note title"
            disabled={!selectedNote}
            className="text-base font-medium"
          />
          <span
            className={cn(
              'inline-flex min-w-20 justify-center rounded-full px-3 py-1 text-xs font-medium',
              saveState === 'saved' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              saveState === 'unsaved' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
              saveState === 'saving' && 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
            )}
          >
            {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving...' : 'Unsaved'}
          </span>
        </div>

        {selectedNote ? (
          <div className="space-y-3">
            <SimpleEditor
              content={contentDraft}
              onChange={html => {
                setContentDraft(html)
              }}
            />
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Created {formatDate(selectedNote.createdAt)}</span>
              <span>Updated {formatDate(selectedNote.updatedAt)}</span>
            </div>
          </div>
        ) : (
          <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            Select or create a note to start writing.
          </div>
        )}
      </section>
    </div>
  )
}
