// Release the chat workspace package to the platform (architect's decision A1, 2026-09-22).
//
// Single source of truth:
//   code     → this repository, `main`, tagged chat-workspace-v<version>
//   release  → Component Registry graph 4072b898, node `component-chat-workspace` (label chat-workspace):
//              version, bundle SHA-256, source tag/commit, and where the bundle is stored
//   bundle   → release graph (one node per version, never changed after release), so the registry
//              graph stays small and every earlier version stays available for rollback
//
// World member pages carry an embedded copy (decision 4B); Agent-Builder's setup_chat_workspace
// copies the registered release into a page and refuses a bundle whose hash does not match.
//
//   node scripts/release-chat-workspace.mjs            # dry run: prints what would be written
//   node scripts/release-chat-workspace.mjs --write    # writes the release and updates the registry
import { readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const KG = 'https://knowledge.vegvisr.org'
const REGISTRY_GRAPH_ID = '4072b898-f111-42a9-b5ca-0d901bb17d26'
const REGISTRY_NODE_ID = 'component-chat-workspace'
const HEADERS = { 'Content-Type': 'application/json', 'x-user-email': 'torarnehave@gmail.com', 'x-user-role': 'Superadmin' }
const write = process.argv.includes('--write')
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

async function kg(path, body) {
  const response = await fetch(KG + path, body ? { method: 'POST', headers: HEADERS, body: JSON.stringify(body) } : { headers: HEADERS })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${path} ${response.status}: ${data.error || JSON.stringify(data).slice(0, 300)}`)
  return data
}

// 1. The release is a tagged commit on main, and everything the bundle is built from is unchanged
//    since that tag (later commits may only touch scripts and docs).
const version = JSON.parse(readFileSync('packages/chat-workspace/package.json', 'utf8')).version
const tag = `chat-workspace-v${version}`
if (git('status', '--porcelain')) throw new Error('Working tree is not clean. Commit first.')
const commit = git('rev-list', '-n', '1', tag)
git('merge-base', '--is-ancestor', commit, 'origin/main')
const bundleInputs = ['packages', 'src', 'index.html', 'vite.workspace.config.ts', 'tsconfig.workspace.json', 'package.json', 'package-lock.json']
const changed = git('diff', '--name-only', tag, 'HEAD', '--', ...bundleInputs)
if (changed) throw new Error(`Bundle sources changed since ${tag}:\n${changed}\nBump the version and tag a new release.`)

// 2. Build from that commit and fingerprint the bundle.
execFileSync('npm', ['run', 'build:workspace'], { stdio: 'inherit' })
const bundle = readFileSync('dist-workspace/vegvisr-chat-workspace.js', 'utf8')
const bundleSha256 = createHash('sha256').update(bundle).digest('hex')
const source = { repo: 'torarnehave1/vegvisr-chat', tag, commit }
console.log(`chat-workspace ${version}: ${Buffer.byteLength(bundle)} bytes, sha256 ${bundleSha256.slice(0, 16)}…, ${tag} @ ${commit.slice(0, 7)}`)

// 3. Registry entry and release graph.
const registry = await kg(`/getknowgraph?id=${REGISTRY_GRAPH_ID}`)
const entry = registry.nodes.find(node => node.id === REGISTRY_NODE_ID)
if (!entry) throw new Error(`Registry node ${REGISTRY_NODE_ID} not found`)
const releaseGraphId = entry.metadata?.releaseGraphId || randomUUID()
const releaseNodeId = `chat-workspace-${version}`
const releaseNode = {
  id: releaseNodeId,
  label: `chat-workspace ${version}`,
  type: 'component-release',
  info: `Released bundle of @vegvisr/chat-workspace ${version} (${tag}, ${commit.slice(0, 7)}). The bundle is in metadata.bundle; do not edit — a new version is a new node. Put it on a page with Agent-Builder's setup_chat_workspace.`,
  color: '#0f2a43',
  bibl: [`https://github.com/${source.repo}/tree/${tag}`],
  metadata: { package: '@vegvisr/chat-workspace', version, bundleSha256, bundleBytes: Buffer.byteLength(bundle), source, releasedAt: new Date().toISOString(), bundle },
}

let releaseGraph = null
try { releaseGraph = await kg(`/getknowgraph?id=${releaseGraphId}`) } catch { releaseGraph = null }
const existing = releaseGraph?.nodes?.find(node => node.id === releaseNodeId)
if (existing && existing.metadata?.bundleSha256 !== bundleSha256) {
  throw new Error(`Release ${version} already exists with a different bundle (${existing.metadata?.bundleSha256?.slice(0, 16)}…). Bump the version.`)
}

const registryMetadata = {
  delivery: 'embedded',
  package: '@vegvisr/chat-workspace',
  version,
  bundleSha256,
  bundleBytes: Buffer.byteLength(bundle),
  source,
  releaseGraphId,
  releaseNodeId,
  usage: 'The chat workspace for World member pages: group and private conversations with the same tools. Delivery "embedded": each member page carries a copy (base64 data URL). Put it on or update it in a page with setup_chat_workspace(graphId, nodeId); never paste the bundle by hand. Pages record the version they carry in metadata.chatWorkspace.',
}
const plan = [
  releaseGraph ? (existing ? `release node ${releaseNodeId} already present (same bundle)` : `addNode ${releaseNodeId} to release graph ${releaseGraphId}`) : `create release graph ${releaseGraphId} with node ${releaseNodeId}`,
  `patchNode registry ${REGISTRY_NODE_ID} (graph v${registry.metadata.version}): delivery embedded, version ${version}, drop the old served impl`,
]
console.log((write ? 'Writing:\n  ' : 'Dry run (add --write):\n  ') + plan.join('\n  '))
if (!write) process.exit(0)

if (!releaseGraph) {
  await kg('/saveGraphWithHistory', {
    id: releaseGraphId,
    override: false,
    graphData: {
      metadata: { title: 'Chat workspace releases', description: 'Released bundles of @vegvisr/chat-workspace, one node per version. The Component Registry entry chat-workspace (graph 4072b898) names the current release.', createdBy: 'torarnehave@gmail.com', metaArea: '#COMPONENT-RELEASE #CHAT-WORKSPACE', category: 'Component Release', version: 0 },
      nodes: [releaseNode],
      edges: [],
    },
  })
} else if (!existing) {
  await kg('/addNode', { graphId: releaseGraphId, node: releaseNode })
}

await kg('/patchNode', {
  graphId: REGISTRY_GRAPH_ID,
  nodeId: REGISTRY_NODE_ID,
  expectedVersion: registry.metadata.version,
  fields: {
    info: `chat-workspace ${version} — the chat workspace for World member pages. Released from ${source.repo} ${tag}. Bundle: release graph ${releaseGraphId}, node ${releaseNodeId} (sha256 ${bundleSha256.slice(0, 16)}…).`,
    metadata: registryMetadata,
  },
})

// 4. Read back: the registry names this release and the stored bundle matches it.
const after = (await kg(`/getknowgraph?id=${REGISTRY_GRAPH_ID}`)).nodes.find(node => node.id === REGISTRY_NODE_ID)
const stored = (await kg(`/getknowgraph?id=${releaseGraphId}`)).nodes.find(node => node.id === releaseNodeId)
const storedSha = createHash('sha256').update(stored.metadata.bundle).digest('hex')
if (after.metadata.version !== version || after.metadata.bundleSha256 !== bundleSha256 || storedSha !== bundleSha256 || 'impl' in after.metadata) {
  throw new Error('Read-back mismatch: ' + JSON.stringify({ registryVersion: after.metadata.version, registrySha: after.metadata.bundleSha256, storedSha, oldImplLeft: 'impl' in after.metadata }))
}
console.log(`Released chat-workspace ${version}: registry ${REGISTRY_NODE_ID} → release graph ${releaseGraphId} node ${releaseNodeId}, bundle verified.`)
