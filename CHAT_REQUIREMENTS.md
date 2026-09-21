# Chat requirements — private and group conversations

Owner: Tor Arne Håve. Explicit requirement, 21 September 2026.

> Alle chatter, private og gruppe, skal virke på samme måte.

## Binding product requirement

Private and group conversations must use the same chat workspace and the same
message capabilities. A private conversation is not a reduced or text-only product.
Conversation type may determine participants, the displayed name, and authorization;
it must not determine a reduced set of message tools.

This includes microphone recording, audio playback, transcription/dictation,
paperclip attachments (images, video, PDF/files), rich message rendering, emoji,
reactions, replies, forwarding, editing/deletion where authorized, polls, and the
app's AI features. Implement these through the common package and runtime rather
than maintaining a separate reduced private-chat renderer.

Private participant access must continue to be enforced server-side. Feature parity
does not grant third parties, group administrators, or bots implicit access to a
private conversation. Every operation must validate the appropriate participants
and permissions, including media access and source/destination access for forwarding.

## How to interpret existing code and API documentation

The deployed direct-message API and package v0.2.0 currently have incomplete support.
Descriptions such as “text only”, hidden microphone/paperclip buttons, and unsupported
private operations describe implementation gaps, NOT approved product requirements.
Do not preserve these gaps as intentional design. Do not claim parity is delivered
until backend support and the working controls are implemented and verified.

Earlier decisions to retain an old private renderer or limit private chats to text
are superseded by this explicit requirement. Existing app behavior remains the
reuse baseline, but does not override this requirement. A missing endpoint is work
to complete, not permission to silently reduce the requested scope.

## Acceptance criteria

- Open a group and a private conversation: both use the same workspace and message tools.
- Record, send, receive, and play audio in both; verify transcription/dictation.
- Attach, send, receive, and open the supported media/file types in both.
- Verify other message actions in both with equivalent permissions.
- Verify history/pagination, incoming updates, conversation switching, and mobile layout.
- Verify failures are visible, input is preserved where appropriate, and access
  revocation clears private content. No fallback to less restrictive group APIs.
- Verify an unauthorized account cannot read private messages or media or send to them.
- Keep the existing NIBI FELLES community, conversations, members, and data. Do not
  create substitute backend groups or test data for the NIBI deployment.
- Preserve the original Min side HTML node. Apply the change to the existing test node;
  Tor Arne publishes it to test.nibi.no from the editor.

Local intercepted-request tests do not establish deployed backend feature support.
Report exactly which backend version was verified and which gaps remain.
