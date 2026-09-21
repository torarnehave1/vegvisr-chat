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

## NIBI test node

`scripts/prepare-nibi-workspace.mjs` copies `nibi-members-page` in the existing graph,
keeps its original bytes and graph metadata, embeds the built package in the copy,
and points that copy's publish gate at `test.nibi.no`. No credentials are embedded.
The script creates a payload only; it does not save or publish by itself.

Existing NIBI groups/data are used. Both private conversations and group conversations
use the same React renderer. The old sidebar bundle is removed from the test node.

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
With Playwright installed in the test environment, run:

```sh
node scripts/test-nibi-workspace.cjs original-graph.json prepared-payload.json
```

The test intercepts all external requests and never writes fixtures to NIBI.
It covers preservation of the original graph/node, host authentication bridge,
world-domain selection, group history/sending, mobile scrolling, private-conversation
rendering/sending/polling, revoked private access, unmount, and logout. `WORKSPACE_CHROMIUM_PATH` optionally
selects an installed Chromium binary; `WORKSPACE_CHROMIUM_ARGS` is an optional JSON array.

The parity test runs the prepared node against the real group-chat-worker code
(`index.js` + `direct-chat.js`) in-process on SQLite and an in-memory R2 bucket, with a
fake microphone:

```sh
node scripts/test-nibi-parity.mjs prepared-payload.json /Volumes/T7/vegvisr-frontend/group-chat-worker
```

It drives, in a group and in a private conversation: text, reply, image, PDF, voice with
transcription, dictation, reactions, poll and vote, author-only delete, forwarding both
ways (private bytes copied), a failed upload shown with the file kept, mobile tool layout,
no private traffic on group or public media routes, and revocation clearing content and
links. Backend authorization is covered by `group-chat-worker/test-direct-chat-parity.mjs`.
Neither test proves the deployed backend: after a deploy, verify on the live service with
real NIBI accounts (CHAT_REQUIREMENTS.md acceptance criteria).
