---
"@item-enonic-types/lib-translations": patch
---

Fix `absoluteUrl` (used by `getLanguageLinksForHead()`) when a language is on the root vhost. The vhost source is now replaced in the path only, so `https://` is no longer rewritten to `https:/en//`, and the root page of a prefixed language now links back to the root.
