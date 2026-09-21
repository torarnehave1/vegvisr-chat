# @vegvisr/shared-chat

This package is a shared compatibility layer for Vegvisr chat.

## Binding conversation requirements

[CHAT_REQUIREMENTS.md](../../CHAT_REQUIREMENTS.md) governs private and group chats.
Both must provide the same message capabilities, including microphone and attachments.
Transport differences implement authorization and routing, not a reduced private product.
The current direct transport's missing media and message operations are implementation
gaps to fix; they must not be treated as intentional restrictions or as completion.

It is not a standalone app and it is not a live UI component that replaces the
current chat runtime.

## What this package is

This package defines the shared contract and transport boundary for chat use
across apps and repos. Its purpose is to standardize:

- message shape
- event flow
- transport adapter behavior
- shared typing for chat data
- compatibility with the existing `group-chat-worker` API

It is intended as a reusable integration layer, not as a second implementation
of chat logic.

## What this package is not

This package is not:

- a full standalone chat application
- a replacement for the current app runtime
- a second chat protocol
- a UI component meant to be mounted directly in production

## Source of truth

The existing chat app remains the source of truth until this package is
validated by the real app flow and its tests.

The current rule is simple:

- reuse the original app behavior subject to the explicit requirements above
- adapt to the shared contract only when it matches the real app
- do not invent a parallel message format or transport system

## Intended role

This package should be used as a compatibility boundary between:

- existing app code
- future shared consumers
- reusable chat integrations across products

It is a safe extraction layer for standardization, not a forced rewrite.

## Working rule

Any migration must preserve the current app's behavior first. Only after the
real app validates the shared contract should the package be treated as the
canonical shared layer.

Preserving behavior does not authorize keeping private chats text-only or removing
tools to make an incomplete migration appear finished. Implement and verify parity
according to CHAT_REQUIREMENTS.md before describing the migration as complete.
