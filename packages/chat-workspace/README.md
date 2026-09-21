# @vegvisr/chat-workspace

An embeddable build of the existing chat application's `GroupChat` and `GroupInfo`.
It is built in this repository so the UI and app retain a single implementation.
Message CRUD uses `@vegvisr/shared-chat` through the application's service layer.

Build from the repository root: `npm ci && npm run build:workspace`.
The result is `dist-workspace/vegvisr-chat-workspace.js`, a self-contained browser
IIFE with React and compiled styles; no service worker or login screen is installed.

Load it **inside a dedicated same-origin iframe**, then call:

```js
const handle = VegvisrChatWorkspace.mount(document.getElementById('workspace'), {
  groupId: selectedGroup.id,
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

Existing NIBI groups/data are used. Direct conversations retain the original
token-authenticated component; group workspaces use the new React build.
This is deliberately not a claim that the package implements the `/direct` protocol.

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
fallback, unmount, access denial, and logout. `WORKSPACE_CHROMIUM_PATH` optionally
selects an installed Chromium binary; `WORKSPACE_CHROMIUM_ARGS` is an optional JSON array.
Authenticated testing against real services remains the publisher's next step.
