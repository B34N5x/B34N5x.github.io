// (c) 2026 B34N5x. All rights reserved.
// Group call / voice removed (emotes-only lobby). Stub kept for old caches.
export const NET = (document.querySelector('meta[name="lobby-net"]') || {}).content || 'testnet';
export let groupCallHook = null; export const setGroupCallHook = f => { groupCallHook = f; };
