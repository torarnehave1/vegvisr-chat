/* eslint-disable react-refresh/only-export-components -- Browser library exports an imperative mount API. */
import { Component, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { GroupChat } from '../../../src/components/GroupChat'
import { GroupInfo } from '../../../src/components/GroupInfo'
import { createChatAdapter, createChatTransport, createDirectChat, withDirectForwarding } from '../../shared-chat/src/index'
import type { AuthParams, Group, ChatTransport } from '../../shared-chat/src/contract'
import { DirectInfo } from './DirectInfo'
import appCss from '../../../src/index.css?inline'
import workspaceCss from './workspace.css?inline'

export interface WorkspaceOptions {
  /** An already authenticated identity, resolved by the host's login flow. */
  auth: AuthParams
  groupId: string
  kind?: 'direct' | 'group'
  sessionToken?: string
  sourceGroupId?: string
  role?: string
  onBack?: () => void
}

class WorkspaceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed
      ? <p role="alert">Chatten kunne ikke vises. Velg samtalen på nytt.</p>
      : this.props.children
  }
}

function Workspace({ initialGroup, options, transport, directClient }: { initialGroup: Group; options: WorkspaceOptions; transport?: ChatTransport; directClient?: ReturnType<typeof createDirectChat> | null }) {
  const [group, setGroup] = useState(initialGroup)
  const [info, setInfo] = useState(false)
  return info
    ? <div className="workspace-info">{options.kind === 'direct' && directClient
        ? <DirectInfo client={directClient} groupId={group.id} name={group.name} onBack={() => setInfo(false)} />
        : <GroupInfo group={group} auth={options.auth} onBack={() => setInfo(false)} onGroupUpdated={setGroup} />}</div>
    : <GroupChat groupId={group.id} groupName={group.name} groupCreatedBy={group.created_by}
        postingLocked={Boolean(group.posting_locked)} currentUserRole={options.role}
        auth={options.auth} currentUserId={options.auth.user_id}
        direct={options.kind === 'direct'} messageTransport={transport}
        onBack={() => options.onBack?.()} onInfo={() => setInfo(true)} />
}

/** Mount in a dedicated same-origin iframe. No login, storage, or service worker is installed. */
export function mount(element: HTMLElement, options: WorkspaceOptions): { unmount: () => void } {
  if (element.ownerDocument !== document) throw new Error('Load workspace script inside its iframe.')
  if (!options.auth?.user_id || (!options.auth.phone && options.kind !== 'direct') || !options.groupId) {
    throw new Error('Workspace requires groupId and authenticated user_id/phone.')
  }
  // Private conversations use only the participant-scoped API. Groups use the group endpoints,
  // and forward into private conversations through the same participant-checked route.
  const directClient = options.sessionToken && options.sourceGroupId
    ? createDirectChat(options.sessionToken, options.sourceGroupId) : null
  if (options.kind === 'direct' && !directClient) throw new Error('Private samtaler krever innlogging og fellesskaps-ID.')
  const direct = options.kind === 'direct' ? directClient : null
  const groupTransport = createChatTransport()
  const transport = direct ? direct.transport : directClient ? withDirectForwarding(groupTransport, directClient) : groupTransport
  const style = document.createElement('style')
  style.textContent = appCss + '\n' + workspaceCss
  document.head.append(style)
  element.classList.add('vegvisr-chat-workspace')
  const root = createRoot(element)
  let disposed = false
  const adapter = createChatAdapter(groupTransport)
  root.render(<p role="status">Henter samtalen …</p>)
  // Resolve server-owned group metadata, including posting restrictions, before mounting.
  void (direct ? direct.fetchConversations() : adapter.fetchGroups(options.auth)).then(groups => {
    if (disposed) return
    const group = groups.find(item => item.id === options.groupId)
    if (!group) throw new Error('Du har ikke tilgang til denne samtalen.')
    root.render(<WorkspaceBoundary><Workspace initialGroup={group} options={options} transport={transport} directClient={direct} /></WorkspaceBoundary>)
  }).catch(error => {
    if (!disposed) root.render(<p role="alert">{error instanceof Error ? error.message : 'Kunne ikke hente samtalen.'}</p>)
  })
  const unmount = () => {
    if (disposed) return
    disposed = true
    root.unmount()
    style.remove()
    window.removeEventListener('pagehide', unmount)
  }
  window.addEventListener('pagehide', unmount)
  return { unmount }
}
