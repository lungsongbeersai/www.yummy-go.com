# Employee responsibility window

The **My orders** button beside table search opens a responsive window inside `/posAll/tables`, including the native mobile table screen. The existing `/my_orders` page, its store and `/api/v1/posAll/my_sales` API remain unchanged.

The new window uses only authenticated `GET /api/v1/posAll/my_work` and `GET /api/v1/posAll/my_work/report`. Responsibility belongs to the bill opener. Each item also names its contributor; another employee adding an item does not transfer the bill. Neither requests nor UI controls select another employee or branch. The server verifies the live employee and branch. This is a current bill snapshot, not a complete audit history or a financial-liability allocation.

**Today**, **earlier unsettled bills** and **unverified opening dates** are separate scopes, with separate counts and totals. Opening provenance is shown when estimated or unknown. The window never treats an old date-only order field as a precise opening timestamp. Check-bill state, kitchen state and settlement are distinct: a closed credit bill may still have outstanding credit. Historical print acknowledgements are not shown as proof that the current version reached a kitchen printer.

The business day runs from 05:00 Asia/Vientiane to the following 04:59:59.999. This feature has its own pure period helper and does not change the legacy 06:00 report helper. The server response samples the authoritative clock; the client advances that sample with a monotonic clock and schedules the next cutoff. Cutoff clears the old list and pending report, returns to page one and reloads. Focus/visibility refresh also handles a device waking after the boundary. Actor, branch, token, permission context, dialog lease and business-day guards prevent late results from restoring an earlier scope, including changes that return to the original identity.

All bill and line amounts come from the API. Set components remain visible but are charged only as recorded by the server. Bill discount, service and VAT are not allocated again to each contributor. Missing financial snapshots and malformed payment facts remain `null`/unknown, including combined summaries; the UI and report show a review notice instead of claiming zero or settled.

**Print my report** fetches the complete selected scope and filters, pinned to the displayed business day. It never substitutes the current list page. The API returns the complete report or fails above its 1,000-bill/20,000-item limit. The A4 document includes employee, branch, period, filters, contribution and status details, and uses the selected application Lao font. Browser printing opens its window within the click gesture, waits for fonts, and rechecks ownership before invoking print. Android uses the existing `AndroidSystemPrint` bridge; no new native binary or printer API is introduced. Closing the window or changing sessions invalidates pending reports and closes their browser preview. Nothing is stored offline.

Focused verification:

```sh
npx vitest run src/services/pos/employee-work.test.ts src/stores/employee-work-store.test.ts src/features/pos/employee-work/employee-work-period.test.ts src/features/pos/employee-work/employee-work-print.test.ts
```

Browser checks cover the shared mobile/native launcher, responsive item details, filtering and pagination, full-report printing, nullable amounts and credit states, exact cutoff/wake-up, and delayed responses after close or authentication changes.
