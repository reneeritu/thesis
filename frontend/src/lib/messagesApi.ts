import { api } from './api'

export type ConversationListItem = {
  _id: string
  participants: [string, string]
  otherAlias: string
  initiatorAlias: string
  status: 'pending' | 'accepted' | 'declined' | 'blocked'
  introMessage: string
  lastMessageAt: string | null
  preview: string
  unreadCount: number
  updatedAt: string
}

export type ConversationDetail = {
  _id: string
  participants: [string, string]
  initiatorAlias: string
  status: ConversationListItem['status']
  introMessage: string
  blockedByAlias?: string
  lastMessageAt: string | null
}

export type DmMessageRow = {
  _id: string
  conversationId: string
  senderAlias: string
  body: string
  readByRecipientAt: string | null
  createdAt: string
}

export function listConversations() {
  return api<ConversationListItem[]>('/conversations')
}

export function getConversation(id: string, opts?: { limit?: number; before?: string }) {
  const q = new URLSearchParams()
  if (opts?.limit) q.set('limit', String(opts.limit))
  if (opts?.before) q.set('before', opts.before)
  const suffix = q.toString() ? '?' + q.toString() : ''
  return api<{ conversation: ConversationDetail; messages: DmMessageRow[]; nextBefore: string | null }>(
    '/conversations/' + encodeURIComponent(id) + suffix,
  )
}

export function createConversation(recipientAlias: string, intro: string) {
  return api<{ conversation: ConversationDetail; existed?: boolean }>('/conversations', {
    method: 'POST',
    body: { recipientAlias, intro },
  })
}

export function respondConversation(id: string, decision: 'accept' | 'decline') {
  return api<ConversationDetail>('/conversations/' + encodeURIComponent(id) + '/respond', {
    method: 'POST',
    body: { decision },
  })
}

export function sendDm(id: string, body: string) {
  return api<DmMessageRow>('/conversations/' + encodeURIComponent(id) + '/messages', {
    method: 'POST',
    body: { body },
  })
}

export function blockConversation(id: string, block: boolean) {
  return api<ConversationDetail>('/conversations/' + encodeURIComponent(id) + '/block', {
    method: 'POST',
    body: { block },
  })
}

export function markConversationRead(id: string) {
  return api<{ markedRead: number }>('/conversations/' + encodeURIComponent(id) + '/read', {
    method: 'POST',
  })
}
