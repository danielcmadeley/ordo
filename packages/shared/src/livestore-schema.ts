import { Events, makeSchema, Schema, State } from '@livestore/livestore'

export const Filter = Schema.Literal('All', 'Active', 'Completed')
export type Filter = typeof Filter.Type
export const JournalMainFocus = Schema.Literal('projects', 'research', 'exercise', 'recovery')
export type JournalMainFocus = typeof JournalMainFocus.Type

export const tables = {
  tasks: State.SQLite.table({
    name: 'tasks',
    columns: {
      id: State.SQLite.integer({ primaryKey: true }),
      text: State.SQLite.text({ default: '' }),
      description: State.SQLite.text({ default: '' }),
      completed: State.SQLite.boolean({ default: false }),
      projectId: State.SQLite.integer({ default: 0 }),   // 0 = inbox
      priority: State.SQLite.integer({ default: 1 }),    // 1=Low 2=Medium 3=High 4=Critical
      labels: State.SQLite.text({ default: '[]' }),      // JSON string array
      createdAt: State.SQLite.integer({ default: 0 }),
      startDate: State.SQLite.integer({ default: 0 }),   // 0 = not set
      dueDate: State.SQLite.integer({ default: 0 }),     // 0 = not set
    },
  }),
  projects: State.SQLite.table({
    name: 'projects',
    columns: {
      id: State.SQLite.integer({ primaryKey: true }),
      name: State.SQLite.text({ default: '' }),
      description: State.SQLite.text({ default: '' }),
      createdAt: State.SQLite.integer({ default: 0 }),
      startDate: State.SQLite.integer({ default: 0 }),
    },
  }),
  notebooks: State.SQLite.table({
    name: 'notebooks',
    columns: {
      id: State.SQLite.integer({ primaryKey: true }),
      name: State.SQLite.text({ default: '' }),
      description: State.SQLite.text({ default: '' }),
      createdAt: State.SQLite.integer({ default: 0 }),
      updatedAt: State.SQLite.integer({ default: 0 }),
    },
  }),
  notes: State.SQLite.table({
    name: 'notes',
    columns: {
      id: State.SQLite.integer({ primaryKey: true }),
      notebookId: State.SQLite.integer({ default: 0 }),
      title: State.SQLite.text({ default: '' }),
      content: State.SQLite.text({ default: '' }),
      createdAt: State.SQLite.integer({ default: 0 }),
      updatedAt: State.SQLite.integer({ default: 0 }),
    },
  }),
  journalEntries: State.SQLite.table({
    name: 'journal_entries',
    columns: {
      id: State.SQLite.integer({ primaryKey: true }),
      dateKey: State.SQLite.text({ default: '' }),
      feeling: State.SQLite.integer({ default: 1 }),
      sleepQuality: State.SQLite.integer({ default: 1 }),
      mainFocus: State.SQLite.text({ default: 'projects' }),
      entryContent: State.SQLite.text({ default: '' }),
      createdAt: State.SQLite.integer({ default: 0 }),
      updatedAt: State.SQLite.integer({ default: 0 }),
    },
  }),
  history: State.SQLite.table({
    name: 'history',
    columns: {
      id: State.SQLite.integer({ primaryKey: true }),
      action: State.SQLite.text({ default: '' }),
      entityType: State.SQLite.text({ default: '' }),
      entityId: State.SQLite.integer({ default: 0 }),
      entityText: State.SQLite.text({ default: '' }),
      timestamp: State.SQLite.integer({ default: 0 }),
    },
  }),
}

export const events = {
  taskCreated: Events.synced({
    name: 'v1.TaskCreated',
    schema: Schema.Struct({
      id: Schema.Number,
      text: Schema.String,
      description: Schema.String,
      projectId: Schema.Number,
      priority: Schema.Number,
      labels: Schema.String,
      createdAt: Schema.Number,
      startDate: Schema.Number,
      dueDate: Schema.Number,
    }),
  }),
  taskUpdated: Events.synced({
    name: 'v1.TaskUpdated',
    schema: Schema.Struct({
      id: Schema.Number,
      text: Schema.String,
      description: Schema.String,
      projectId: Schema.Number,
      priority: Schema.Number,
      labels: Schema.String,
      startDate: Schema.Number,
      dueDate: Schema.Number,
    }),
  }),
  taskDeleted: Events.synced({
    name: 'v1.TaskDeleted',
    schema: Schema.Struct({ id: Schema.Number }),
  }),
  taskCompleted: Events.synced({
    name: 'v1.TaskCompleted',
    schema: Schema.Struct({ id: Schema.Number }),
  }),
  taskUncompleted: Events.synced({
    name: 'v1.TaskUncompleted',
    schema: Schema.Struct({ id: Schema.Number }),
  }),
  projectCreated: Events.synced({
    name: 'v1.ProjectCreated',
    schema: Schema.Struct({
      id: Schema.Number,
      name: Schema.String,
      description: Schema.String,
      createdAt: Schema.Number,
      startDate: Schema.Number,
    }),
  }),
  projectDeleted: Events.synced({
    name: 'v1.ProjectDeleted',
    schema: Schema.Struct({ id: Schema.Number }),
  }),
  projectUpdated: Events.synced({
    name: 'v1.ProjectUpdated',
    schema: Schema.Struct({
      id: Schema.Number,
      name: Schema.String,
      description: Schema.String,
      startDate: Schema.Number,
    }),
  }),
  notebookCreated: Events.synced({
    name: 'v1.NotebookCreated',
    schema: Schema.Struct({
      id: Schema.Number,
      name: Schema.String,
      description: Schema.String,
      createdAt: Schema.Number,
      updatedAt: Schema.Number,
    }),
  }),
  notebookUpdated: Events.synced({
    name: 'v1.NotebookUpdated',
    schema: Schema.Struct({
      id: Schema.Number,
      name: Schema.String,
      description: Schema.String,
      updatedAt: Schema.Number,
    }),
  }),
  notebookDeleted: Events.synced({
    name: 'v1.NotebookDeleted',
    schema: Schema.Struct({ id: Schema.Number }),
  }),
  noteCreated: Events.synced({
    name: 'v1.NoteCreated',
    schema: Schema.Struct({
      id: Schema.Number,
      notebookId: Schema.Number,
      title: Schema.String,
      content: Schema.String,
      createdAt: Schema.Number,
      updatedAt: Schema.Number,
    }),
  }),
  noteUpdated: Events.synced({
    name: 'v1.NoteUpdated',
    schema: Schema.Struct({
      id: Schema.Number,
      title: Schema.String,
      content: Schema.String,
      updatedAt: Schema.Number,
    }),
  }),
  noteDeleted: Events.synced({
    name: 'v1.NoteDeleted',
    schema: Schema.Struct({ id: Schema.Number }),
  }),
  journalEntryCreated: Events.synced({
    name: 'v1.JournalEntryCreated',
    schema: Schema.Struct({
      id: Schema.Number,
      dateKey: Schema.String,
      feeling: Schema.Number,
      sleepQuality: Schema.Number,
      mainFocus: JournalMainFocus,
      entryContent: Schema.String,
      createdAt: Schema.Number,
      updatedAt: Schema.Number,
    }),
  }),
  journalEntryUpdated: Events.synced({
    name: 'v1.JournalEntryUpdated',
    schema: Schema.Struct({
      id: Schema.Number,
      feeling: Schema.Number,
      sleepQuality: Schema.Number,
      mainFocus: JournalMainFocus,
      entryContent: Schema.String,
      updatedAt: Schema.Number,
    }),
  }),
  journalEntryDeleted: Events.synced({
    name: 'v1.JournalEntryDeleted',
    schema: Schema.Struct({ id: Schema.Number }),
  }),
  historyRecorded: Events.synced({
    name: 'v1.HistoryRecorded',
    schema: Schema.Struct({
      id: Schema.Number,
      action: Schema.String,
      entityType: Schema.String,
      entityId: Schema.Number,
      entityText: Schema.String,
      timestamp: Schema.Number,
    }),
  }),
}

const materializers = State.SQLite.materializers(events, {
  'v1.TaskCreated': ({ id, text, description, projectId, priority, labels, createdAt, startDate, dueDate }) =>
    tables.tasks.insert({ id, text, description, projectId, priority, labels, createdAt, startDate, dueDate }),
  'v1.TaskUpdated': ({ id, text, description, projectId, priority, labels, startDate, dueDate }) =>
    tables.tasks.update({ text, description, projectId, priority, labels, startDate, dueDate }).where({ id }),
  'v1.TaskDeleted': ({ id }) => tables.tasks.delete().where({ id }),
  'v1.TaskCompleted': ({ id }) => tables.tasks.update({ completed: true }).where({ id }),
  'v1.TaskUncompleted': ({ id }) => tables.tasks.update({ completed: false }).where({ id }),
  'v1.ProjectCreated': ({ id, name, description, createdAt, startDate }) =>
    tables.projects.insert({ id, name, description, createdAt, startDate }),
  'v1.ProjectDeleted': ({ id }) => tables.projects.delete().where({ id }),
  'v1.ProjectUpdated': ({ id, name, description, startDate }) =>
    tables.projects.update({ name, description, startDate }).where({ id }),
  'v1.NotebookCreated': ({ id, name, description, createdAt, updatedAt }) =>
    tables.notebooks.insert({ id, name, description, createdAt, updatedAt }),
  'v1.NotebookUpdated': ({ id, name, description, updatedAt }) =>
    tables.notebooks.update({ name, description, updatedAt }).where({ id }),
  'v1.NotebookDeleted': ({ id }) => tables.notebooks.delete().where({ id }),
  'v1.NoteCreated': ({ id, notebookId, title, content, createdAt, updatedAt }) =>
    tables.notes.insert({ id, notebookId, title, content, createdAt, updatedAt }),
  'v1.NoteUpdated': ({ id, title, content, updatedAt }) =>
    tables.notes.update({ title, content, updatedAt }).where({ id }),
  'v1.NoteDeleted': ({ id }) => tables.notes.delete().where({ id }),
  'v1.JournalEntryCreated': ({ id, dateKey, feeling, sleepQuality, mainFocus, entryContent, createdAt, updatedAt }) =>
    tables.journalEntries.insert({ id, dateKey, feeling, sleepQuality, mainFocus, entryContent, createdAt, updatedAt }),
  'v1.JournalEntryUpdated': ({ id, feeling, sleepQuality, mainFocus, entryContent, updatedAt }) =>
    tables.journalEntries.update({ feeling, sleepQuality, mainFocus, entryContent, updatedAt }).where({ id }),
  'v1.JournalEntryDeleted': ({ id }) => tables.journalEntries.delete().where({ id }),
  'v1.HistoryRecorded': ({ id, action, entityType, entityId, entityText, timestamp }) =>
    tables.history.insert({ id, action, entityType, entityId, entityText, timestamp }),
})

const state = State.SQLite.makeState({ tables, materializers })
export const schema = makeSchema({ events, state })
