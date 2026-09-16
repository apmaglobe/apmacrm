// APMA CRM deliberately does not cache sessions, API responses, or business data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
