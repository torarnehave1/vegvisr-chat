# @vegvisr/shared-chat

This package is a shared compatibility layer for Vegvisr chat.

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

- keep the original app behavior as the authority
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
