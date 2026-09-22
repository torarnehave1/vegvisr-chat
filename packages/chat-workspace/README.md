# @vegvisr/chat-workspace

An embeddable build of the existing chat application's `GroupChat` and `GroupInfo`.
It is built in this repository so the UI and app retain a single implementation.
Every message operation goes through a `ChatTransport` from `@vegvisr/shared-chat`:
read, send, edit, delete, attachments, voice, transcription, reactions, polls and
forwarding. Group and private conversations implement the same transport; they differ
in endpoints and authorization, not in tools.

## Required behavior

[CHAT_REQUIREMENTS.md](../../CHAT_REQUIREMENTS.md) is the binding product requirement:
all private and group chats must work the same way, including microphone and paperclip
attachments. The differences are participants, names, and access checks, not a reduced
set of message tools. v0.3.0 implements the tools for both conversation types; see
"Private conversations" below for the access model and what differs by design.

Build from the repository root: `npm ci && npm run build:workspace`.
The result is `dist-workspace/vegvisr-chat-workspace.js`, a self-contained browser
IIFE with React and compiled styles; no service worker or login screen is installed.

Load it **inside a dedicated same-origin iframe**, then call:

```js
const handle = VegvisrChatWorkspace.mount(document.getElementById('workspace'), {
  groupId: selectedGroup.id,
  kind: selectedGroup.kind === 'direct' ? 'direct' : 'group',
  sessionToken: session.token, // only used with the participant-scoped direct API
  sourceGroupId: communityGroupId,
  auth: { user_id: user.user_id, phone: user.phone, email: user.email },
  role: user.role,
  onBack: () => hostCloseConversation(),
})
// Host must call before removing iframe / changing identity:
handle.unmount()
```

The host owns authentication, world-scoped conversation selection, and session cleanup.
The package verifies group access via the current `/groups` API before mounting.
All chat services use the existing Vegvisr endpoints; this version does not support
arbitrary backend overrides. UI is the app's existing English UI inside the Norwegian host.

## Releasing and installing

The package has one source of truth:

- **Code:** this repository, `main`, tagged `chat-workspace-v<version>`.
- **Release:** the Component Registry entry `chat-workspace` (graph 4072b898, delivery `embedded`)
  names the current version, bundle SHA-256 and source tag, and points to the release graph
  8b340071-616a-4c5d-8cda-a305db19e594, which keeps one node per version (rollback).

Release a tagged version with `node scripts/release-chat-workspace.mjs --write` (dry run without
`--write`). It refuses when the package sources changed since the tag.

A World member page carries its own copy of the bundle (`const workspaceComponent = "data:…"`).
Install or update it with Agent-Builder's `setup_chat_workspace(graphId, nodeId[, version])`: it
uses the registered release, checks the hash, stamps the page's `metadata.chatWorkspace`, and does
not publish. The page reads the World's groups and community from group-chat-worker's
`/world-chat-groups` (registry and group owner, never names).

### Private conversations

Private chat uses only the participant-scoped `/direct/*` API of group-chat-worker with the
member's session token as a Bearer token held in memory. It never falls back to group access
or Superadmin overrides. The tools are the same as in groups:

| Tool | Private endpoint | Access |
|---|---|---|
| history, polling, send, reply | `GET/POST /direct/{id}/messages` | participant; sender from token |
| edit, delete | `PATCH/DELETE /direct/{id}/messages/{mid}` | author only |
| paperclip (image, video, PDF), paste, drag and drop | `POST /direct/{id}/media` | participant; stored under `media/{id}/` |
| microphone: voice message, dictation | `POST /direct/{id}/media` + `/transcribe` | participant; audio stays in chat storage |
| transcribe a voice message | `POST /direct/{id}/transcribe` | participant |
| reactions | `GET /direct/{id}/reactions`, `POST …/messages/{mid}/reactions` | participant |
| polls | `POST /direct/{id}/polls`, `GET/POST …/polls/{pid}[/vote\|/close]` | participant; creator closes |
| forward (either direction) | `POST /direct/forward`, `GET /direct/forward-targets` | caller must belong to both ends |
| AI mode, emoji, rich rendering | client side | as in groups |

Private media is never served by the public `/media` route. Message responses carry links
signed for the reader's participant slot (valid 12 hours); each fetch re-checks that both
people are still members of the community, so leaving it revokes access to every link.
Forwarding a private attachment copies the bytes into the target conversation instead of
linking the private object. Group conversations in the workspace forward into private ones
through the same `/direct/forward` route.

Differences that follow from a two-person conversation, not from reduced tools: no bots or
`@mentions` (bots get no implicit access), no group alert menu (private messages use the
NIBI e-mail preference), no owner "move" moderation and no owner/admin delete of the other
person's messages (there is no owner). Participant display names come from the
authenticated direct-conversation list.

Group polling keeps the app's `latest=1` refresh behavior (backend ignores `after`
in this mode), pauses requests while hidden, and suppresses late results after unmount.
The backend's non-latest `after` cursor is a message ID, not a timestamp.

Publish only the node `nibi-members-page-chat-workspace-test` to `test.nibi.no`.
Do not publish the original node or change its `minside.nibi.no` gate.

## Verification

`npm run build` and `npm run build:workspace` typecheck and build both consumers.
`scripts/test-nibi-parity.mjs graph.json [group-chat-worker dir]` runs the member page node against
the real group-chat-worker code in-process (SQLite, in-memory R2, fake microphone), for group and
private conversations. It does not prove the deployed backend; the published page does.
