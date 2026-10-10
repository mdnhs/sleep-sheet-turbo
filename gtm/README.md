# GTM containers

Two exports, because the site sends every Meta event twice on purpose — once
from the browser Pixel and once from the server Conversions API — and both
copies carry the same `event_id` so Meta collapses the pair into one.

| File | Container | What it is |
| --- | --- | --- |
| `GTM-PQ667JWQ_web.json` | `GTM-PQ667JWQ` | The web container. Loads the Pixel, fires GA4 and Google Ads, and forwards every GA4 event to the server container. |
| `GTM-WRRQWMG5_server.json` | `GTM-WRRQWMG5` | The server container at `ss.sleepsheetbd.com`. Receives those events and re-sends the ones Meta should see through the Conversions API. |

These are exports, not the live configuration. Editing a file here changes
nothing until it is imported into GTM (**Admin → Import Container**, choosing
**Overwrite**) and that version is published.

## The access token is not in here

`GTM-WRRQWMG5_server.json` carries `SET_THIS_IN_THE_GTM_UI_AFTER_IMPORT`
where the Conversions API access token belongs. The token was left out
because the sandbox this was committed from refuses to write a live
credential into a file, not because the repository is public — it is
private.

After importing, open **Meta CAPI - Allowed Events** and paste the real token
back in. It is a one-off: the token already lives in the container, and
importing this file is what would overwrite it.

The web container needs only your Google Ads Add to Cart Conversion Label
set in the `Const - Google Ads AddToCart Conversion Label` variable (or
replace `SET_ADD_TO_CART_CONVERSION_LABEL_HERE` with the real label before or
after importing). The Purchase tag, Meta Pixel, and GA4 ids are already
populated.

## Why the server container has two triggers

`All GA4 Events` matches `.*` and feeds the GA4 tag, which should keep seeing
everything.

`Meta CAPI - Allowed Events` matches only the six events the browser also
fires as Pixel events:

    ^(page_view|view_item|add_to_cart|begin_checkout|purchase|search)$

Meta needs a browser twin for each server event to deduplicate against.
Pointing the Conversions API tag at `.*` sent GA4's enhanced-measurement
traffic — `scroll`, `user_engagement`, `session_start` and the rest — to Meta
as custom events with no twin, which spends Conversions API volume and drags
down Event Match Quality. `remove_from_cart` is excluded for the same reason:
Meta has no standard event for it and the web container fires no Pixel tag
for it.

## `fbq is not defined` (fixed in this export, 2026-09-21)

The six Meta Pixel event tags (PageView, ViewContent, Search, AddToCart,
InitiateCheckout, Purchase) call `fbq(...)` but had no dependency on
**Meta Pixel - Base Code** — the tag that defines `window.fbq`. PageView and
Base Code share the same "All Pages" trigger, so nothing guaranteed Base
Code's script ran first; GTM would sometimes evaluate the PageView tag
before Base Code had executed, throwing `ReferenceError: fbq is not
defined` in the console and silently dropping that Pixel event.

Fixed by giving all six event tags a `setupTag` dependency on Meta Pixel -
Base Code (GTM's "Fire a tag before this tag fires" / tag sequencing).
`stopOnSetupFailure: false` on purpose — this only fixes ordering (wait for
Base Code's script to run, which is where the synchronous `fbq` stub gets
defined, before the network fetch of `fbevents.js` even starts), it doesn't
add a new way for the event to be silently dropped that wasn't already
possible.

**This is not live until re-imported.** Admin → Import Container → choose
this file → **Overwrite** → publish. Nothing else in the export changed
(tags, triggers and variables are otherwise identical to the previous
export; one unrelated trigger's whitespace was normalized by the JSON
formatter, no content change).
