import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

export const GRAPH_ID = '6e1f12f1-53b8-4d5f-8c9c-9a88135ad0ad'
export const NODE_ID = 'nibi-members-page-chat-workspace-test'

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Source HTML changed: ' + before.slice(0, 65))
  return source.replace(before, () => after)
}

export function prepareGraph(graph, bundle) {
  const source = graph.nodes.find(node => node.id === 'nibi-members-page')
  if (!source || source.type !== 'html-node') throw new Error('Original HTML node not found')
  const existing = graph.nodes.find(node => node.id === NODE_ID)
  const scriptUrl = 'data:text/javascript;base64,' + Buffer.from(bundle).toString('base64')
  let html = replaceOnce(source.info, "  const tabs = ['chat', 'meeting', 'articles', 'common', 'personal']",
    "  const workspaceComponent = " + JSON.stringify(scriptUrl) + "\n  let workspaceHandle = null\n  const tabs = ['chat', 'meeting', 'articles', 'common', 'personal']")
  html = replaceOnce(html, "  function clearChat() {\n    element('chatHost').replaceChildren()",
    "  function clearChat() {\n    if (workspaceHandle) { workspaceHandle.unmount(); workspaceHandle = null }\n    element('chatHost').replaceChildren()")
  html = replaceOnce(html, "  function openGroup(group) {", `
  function openWorkspaceGroup(group) {
    if (!session || !groups.some(item => item.id === group.id)) return
    chatSelection += 1
    clearChat()
    activeGroup = group
    renderGroups()
    element('chatTitle').textContent = group.name || 'Samtale'
    element('chatLayout').dataset.open = 'true'
    const frame = document.createElement('iframe')
    frame.title = (group.name || 'Chat') + ' – nytt workspace'
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups')
    frame.setAttribute('allow', 'microphone; clipboard-write; fullscreen')
    frame.referrerPolicy = 'no-referrer'
    const capturedSession = session
    frame.addEventListener('load', () => {
      const current = () => frame.isConnected && session === capturedSession && activeGroup?.id === group.id
      if (!current()) return
      const page = frame.contentDocument
      const root = page.createElement('div')
      root.id = 'workspace'
      page.body.append(root)
      const script = page.createElement('script')
      script.src = workspaceComponent
      script.onload = () => {
        if (!current()) return
        try {
          workspaceHandle = frame.contentWindow.VegvisrChatWorkspace.mount(root, {
            groupId: group.id,
            kind: group.kind === 'direct' ? 'direct' : 'group',
            sessionToken: capturedSession.token,
            sourceGroupId: directCommunity,
            auth: { user_id: capturedSession.user.user_id, phone: capturedSession.user.phone, email: capturedSession.user.email },
            role: capturedSession.user.role,
            onBack: () => { clearChat(); activeGroup = null; renderGroups() },
          })
        } catch (error) { root.textContent = 'Chatten kunne ikke åpnes: ' + error.message }
      }
      script.onerror = () => { root.textContent = 'Chatpakken kunne ikke lastes. Velg samtalen på nytt.' }
      page.body.append(script)
    }, { once: true })
    frame.srcdoc = '<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"></head><body></body></html>'
    element('chatHost').append(frame)
  }

  function openGroup(group) {
    openWorkspaceGroup(group); return
`)
  // Remove the obsolete renderer and its embedded bundle entirely in the test copy.
  const legacyStart = html.indexOf('    openWorkspaceGroup(group); return')
  const legacyEnd = html.indexOf('  async function loadGroups()', legacyStart)
  if (legacyStart < 0 || legacyEnd < 0) throw new Error('Cannot locate legacy renderer')
  html = html.slice(0, legacyStart) + '    openWorkspaceGroup(group)\n  }\n\n' + html.slice(legacyEnd)
  html = html.replace(/^  const chatComponent = "data:text\/javascript;base64,[^"]+"\n/m, '')
  const node = structuredClone(existing || source)
  node.id = NODE_ID
  node.label = 'NIBI | Min side – Chat workspace TEST'
  node.info = html
  node.bibl = ['https://test.nibi.no/']
  if (!existing) node.position = { x: (source.position?.x || 0) + 600, y: source.position?.y || 0 }
  const sourceGate = source.metadata?.publishGate?.['minside.nibi.no']
  node.metadata = {
    ...node.metadata,
    publishGate: existing?.metadata?.publishGate || (sourceGate ? { 'test.nibi.no': structuredClone(sourceGate) } : {}),
    chatWorkspace: {
      package: '@vegvisr/chat-workspace', version: '0.3.0',
      sourceNodeId: source.id, sourceGraphVersion: graph.metadata.version,
      bundleSha256: createHash('sha256').update(bundle).digest('hex'),
      targetHostname: 'test.nibi.no',
      directMessages: 'Shared React renderer with participant-scoped Bearer transport; existing NIBI conversations.',
    },
  }
  return { id: GRAPH_ID, override: false, graphData: { ...structuredClone(graph), nodes: existing
    ? structuredClone(graph.nodes).map(n => n.id === NODE_ID ? node : n)
    : [...structuredClone(graph.nodes), node] } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [graphPath, bundlePath, outputPath] = process.argv.slice(2)
  if (!graphPath || !bundlePath || !outputPath) throw new Error('Usage: node scripts/prepare-nibi-workspace.mjs graph.json bundle.js output.json')
  const payload = prepareGraph(JSON.parse(readFileSync(graphPath, 'utf8')), readFileSync(bundlePath, 'utf8'))
  writeFileSync(outputPath, JSON.stringify(payload))
  console.log(JSON.stringify({ graphId: GRAPH_ID, nodeId: NODE_ID, version: payload.graphData.metadata.version, nodes: payload.graphData.nodes.length }))
}
