# SUNMI built-in printing

Yummy Go Android 1.0.10 (build 11) adds the official SUNMI printer service transport. Other Yummy Go devices send their normal print jobs through the existing authenticated Backend queue to the SUNMI that owns the printer. This does not open a RAW TCP/9100, LPR or IPP listener on the terminal.

## Set up the terminal

1. Install `/downloads/android/yummy-go-1.0.10-sunmi.apk` over the existing Android app. The release is signed with the project's existing certificate. Keep the existing app data and printer delivery history.
2. Open Yummy Go on the SUNMI, connect to the internet and sign in with an account allowed to manage printers (account status 1, 2 or 3).
3. Add a printer and choose **Built-in SUNMI printer**. Android shows this choice with a persistent connection status and **Check SUNMI again** action. It stays disabled until the native printer is detected and receiver registration succeeds. Ordinary browsers keep their existing TCP/USB choices unless viewing a saved built-in configuration.
4. Confirm the actual paper width. The service reports 58 or 80 mm where supported; the app does not infer paper size from the model name or overwrite a saved width.
5. Choose the receipt, invoice, kitchen, report or QR roles and their normal category/zone permissions. Choose **Direct** for the owning terminal or **Internet** for other Yummy Go devices in the same branch. Built-in printing does not use the LAN/IP option.
6. Save, then run an explicit test on the owning SUNMI. Diagnostics and drawer tests use the local physical device; another device can send ordinary queued receipts but cannot redirect a diagnostic to its own printer.

Keep Yummy Go open and connected on the owning SUNMI while it receives jobs. The existing receiver lifecycle stops starting new jobs in the background. Other devices keep their existing browser, Electron or Android app; they do not need the SUNMI SDK. Staff accounts may submit permitted jobs, while receiver enrollment and delivery are limited to printer-manager account statuses.

If the built-in choice cannot be selected, read the status below the connection choices. It distinguishes a missing APK plugin, an unavailable native service, an unverified device identity, insufficient account permissions and failed server registration. The displayed version comes from the running APK when available. **Check SUNMI again** repeats discovery and registration without printing; a late service connection can recover without reinstalling the app. A detected printer or passing software tests alone do not confirm physical paper output.

## Non-SUNMI terminals (internal USB fallback)

Yummy Go Android 1.0.11 (build 12, `/downloads/android/yummy-go-1.0.11-builtin.apk`) keeps the same built-in contract on Android POS terminals without SUNMI's printer service, such as Rockchip `rk3566_r` all-in-ones. When `woyou.aidlservice.jiuiv5` is missing, the plugin looks for an internal USB printer: a USB printer-class (7) interface first, otherwise a single-interface vendor-specific device, each with a bulk OUT endpoint. Multi-interface vendor devices such as 4G modems are ignored.

- **Check SUNMI again** asks Android for USB permission and waits up to 6 seconds. The manifest's printer-class `USB_DEVICE_ATTACHED` filter lets the dialog offer "always allow", so a reboot does not ask again.
- When nothing matches, the diagnostic reason lists every USB device as `vid:pid[interface classes]` and every writable `/dev/ttyS*`/`ttyUSB*` node. Use it to decide whether the printer is wired over serial instead, which is not supported yet.
- USB has no transaction callback. A complete bulk transfer of every byte resolves as printed, the same contract as raw TCP/9100; it does not prove paper output. A failure after the first byte stays `unknown` and is never resent automatically. The native journal and replay protections are unchanged.

## Delivery contract

- The transport is explicit: `connect_type=sunmi`, `interface_value=sunmi://builtin`, `agent_id=sunmi-native`, `print_mode=sunmi_builtin`. The existing native mobile/TCP identity remains unchanged on the same terminal.
- Backend checks the authenticated branch, account permissions, registered native capability and exact owning device. Built-in receiver presence expires independently of the terminal's normal mobile/TCP heartbeat. An offline SUNMI is not replaced with another SUNMI or desktop worker.
- The Backend prepares canonical ESC/POS batches with the existing Lao/Thai raster renderer and retains their identity and bytes for that print round. Missing canonical bytes fail before delivery instead of switching to differently identified item jobs or another transport.
- The Android bridge verifies the actual device ID again, serializes physical delivery and preserves command/raster boundaries. A durable local journal records only job/payload hashes and delivery state, not sales data or receipt bytes. It prevents a duplicate or uncertain ID from automatically printing again after a remount or restart.
- A successful command callback is not print completion. Only the SUNMI transaction's `onPrintResult(0)` permits a successful delivery acknowledgment. A timeout or disconnect after bytes were handed off remains uncertain, with no automatic fallback or replay. Check the paper before using the existing explicit manual reprint workflow.
- A session or role change cancels preparation and unsent JavaScript waits. Work already handed to the native printer retains its original completion ownership.

## Release and validation

The Android build pins `com.sunmi:printerlibrary:1.0.24`; the native query targets `woyou.aidlservice.jiuiv5`. Build with JDK 21 after `npx cap sync android`, then run `:app:testDebugUnitTest` and `:app:assembleRelease`. Verify the APK's signing certificate, package/version, production server URL and packaged plugin before distribution. Never print a real receipt as an automated deployment check.

The Backend must apply `migrate:sunmi-native-printer` before restarting the API. Its migration extends the existing connection-type whitelist and shared-printer constraint, and adds capability/presence metadata. The older shared-IPv4 migration also preserves canonical SUNMI configurations when replayed. Existing sales, payments and TCP/USB configuration values are retained.

Automated mocks verify routing and delivery ownership; they cannot certify physical paper output, the shop's Android service version or network/AnyDesk latency. Device acceptance requires a test receipt on the shop's SUNMI and a receipt submitted from a second Yummy Go device.

Official references: [SUNMI demo and SDK integration](https://github.com/shangmisunmi/SunmiPrinterDemo), [SUNMI printer service documentation](https://cdn.sunmi.com/public/generalfile/mgt-document/841c6680d673447ba9c5d9b1e1131d01.pdf).
