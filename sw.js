// Root Service Worker shim
// Purpose: make the main (React) app page be controlled by a SW,
// so /virtual/file/* streaming works (SmartCore relies on SW fetch interception).
//
// Reuse the proven Core SW implementation.
importScripts('./core/sw.js');
