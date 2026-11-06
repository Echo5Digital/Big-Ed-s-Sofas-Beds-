// Split out from lib/dailyRotation.js because this is the only piece that
// needs "use cache"/cacheLife (next/cache), which is Server-Component-only —
// importing it from anywhere a Client Component can reach (e.g.
// app/wishlist/page.jsx, which needs dailyRotation.js's client-safe
// shuffleProducts) breaks the build ("You're importing a module that depends
// on cacheLife... but you are using it in the Pages Router"), since Next
// treats the whole importing module as tainted, not just the parts that
// actually call it.

import { cacheLife } from "next/cache";

// Whole calendar day (UTC) since the epoch — increments once every 24h, so a
// selection made with this as part of the seed is stable for a day and
// changes the next. Reading Date.now() directly in a Server Component is a
// build error under this app's cacheComponents config ("Next.js encountered
// the unstable value Date.now() while prerendering") since it's normally a
// sign of a value that can't be cached at all. "use cache" + cacheLife here
// tells Next the opposite is true: this value is fine to cache, just only
// for a day, which is exactly the rotation period we want — so it composes
// with each page's own revalidate/ISR instead of forcing the whole page
// dynamic.
export async function currentDaySeed() {
  "use cache";
  cacheLife("days");
  return Math.floor(Date.now() / 86_400_000);
}
