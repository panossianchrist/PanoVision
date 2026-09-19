# Website Guide

This guide answers the 23 beginner questions in the website brief. Paths below are relative to `C:/Users/Owner/PanoVision`. A terminal is the PowerShell window where you enter commands; a server is the running program that makes the website available in your browser.

For the latest main-site features and 28 new answers, read [the platform guide](PLATFORM-GUIDE.md). The current main site is [http://127.0.0.1:4177/](http://127.0.0.1:4177/); the [README](../README.md#run-locally) has its exact startup command.

## 1. How Do I Open the Project?

Open `C:/Users/Owner/PanoVision` in your editor. In PowerShell:

```powershell
Set-Location 'C:/Users/Owner/PanoVision'
```

This is the main copy. It moved out of OneDrive because of filesystem errors. Do not continue editing the old `OneDrive/Documents/ChatGPT/PanoMedia` copy. Keep runtime data on a private, unsynced local disk.

## 2. How Do I Run the Website?

Use Node 24. Check it with `node --version`. The project includes npm at `package/bin/npm-cli.js`; `node package/bin/npm-cli.js` is the working equivalent of `npm` here.

If dependencies have not been installed, run the installation command from section 3. Then:

```powershell
$env:PANO_APP_ORIGIN='http://127.0.0.1:4180'
node package/bin/npm-cli.js run dev -- --hostname 127.0.0.1 --port 4180
```

Open [http://127.0.0.1:4180](http://127.0.0.1:4180) after starting development on that port. Leave the terminal running. Choose another free port if necessary and update `PANO_APP_ORIGIN` to match. Coordinate with the owner of the running main-site preview before development or rebuilds, since `.next` is shared.

The current production-mode local preview is [http://127.0.0.1:4177](http://127.0.0.1:4177). Production mode describes how Next.js runs a compiled build; it does not mean the site is public or the integrations are ready. Development changes do not update an older production build.

## 3. What Does npm install Mean?

It downloads the software libraries listed in `package.json` into `node_modules`. These include Next.js, React and image-processing tools. It does not publish the site.

```powershell
node package/bin/npm-cli.js install
```

For an existing project with a matching `package-lock.json`, a reproducible fresh installation is:

```powershell
node package/bin/npm-cli.js ci
```

`ci` replaces the dependency installation with the versions in the lockfile. `install` can update the lockfile. Do not reinstall while another person is using the same running project. Review dependencies before a production installation; see [Production](PRODUCTION.md).

## 4. What Does npm run dev Mean?

It runs the `dev` command defined in `package.json`. Next.js starts a development server and usually refreshes the browser after you save a source file. Section 2 uses 4180 as an example; any free port needs an exactly matching `PANO_APP_ORIGIN`.

The web server does not automatically start the moderation worker. That separate program processes uploaded creatives. Its setup is in [Production](PRODUCTION.md#worker-and-admin-commands).

## 5. How Do I Stop It?

Click the terminal running the server and press **Ctrl+C**. Stop the worker in its own terminal the same way. Closing a browser tab does not stop either program. Stop only the processes you started or coordinate with their owner.

## 6. Which File Controls the Homepage?

[`app/page.tsx`](../app/page.tsx) controls `/`, including the introduction, concept image, advantages and About section. The About navigation link points to `/#about`; there is no separate About page.

| Address | Page file |
| --- | --- |
| `/network` | `app/network/page.tsx` |
| `/how-it-works` | `app/how-it-works/page.tsx` |
| `/start-campaign` | `app/start-campaign/page.tsx` |
| `/contact` | `app/contact/page.tsx` |
| `/privacy` | `app/privacy/page.tsx` |
| `/terms` | `app/terms/page.tsx` |

`app/layout.tsx` wraps every page with the navigation, footer, fonts and shared metadata.

## 7. Where Is the Navigation?

[`components/Navbar.tsx`](../components/Navbar.tsx) contains the desktop links and mobile menu. [`components/Footer.tsx`](../components/Footer.tsx) contains footer links and contact details. Preserve the mobile menu's keyboard behavior and accessible button names when changing links.

## 8. Where Are the Colors?

[`app/globals.css`](../app/globals.css) holds the shared palette, styles and responsive layouts. Start with its color variables near the top. Save a backup or a version-control checkpoint before editing. Check text contrast, selected states, error states and small screens afterward.

## 9. Where Is My Email?

Edit `email` in [`lib/company.ts`](../lib/company.ts). It currently contains `YOUR_PANOVISION_EMAIL@gmail.com`, which is a placeholder, not a verified contact. The UI detects the `YOUR_` prefix and avoids presenting it as a functioning email link.

Changing this value updates public contact links. It does **not** configure email delivery or campaign notifications. `phone` in the same file is blank; add only a real number.

## 10. How Do I Add Instagram?

Put your complete verified `https://www.instagram.com/...` URL in `company.instagram` in `lib/company.ts`. Until then the interface shows a coming-soon state. No social account login or API key is needed for a normal link.

## 11. How Do I Replace the Logo?

The original is `public/brand/PanoVision_Logo.png`; navigation and footer use `public/brand/panovision-logo.webp` through `company.logo`. The original came from `C:/Users/Owner/Downloads/pano vision logo_files/PanoVision_Logo.png`.

Use only the approved logo, preserving its artwork, tagline and aspect ratio. A replacement with a different shape needs matching image dimensions in navigation/footer. The preparation script has crop coordinates tailored to the current original; running it on a different image may cut off the logo. Ask a developer to check the crop and regenerate the favicon/social image. See [Assets](ASSETS.md).

## 12. How Do I Replace the Concept Images?

The current file is `public/images/canopy-concept.webp`; its public URL is `/images/canopy-concept.webp`, configured as `company.conceptImage`. It is a generated photographic concept, not a photograph of an operating location.

Replace it with an approved, optimized image or update that path. Update the descriptive `alt` text and image dimensions in `app/page.tsx` when the subject or shape changes. Keep the visible **Concept visual** label and the explanation that it is not an operating PanoVision location.

The Samsung and Kia concept files named in the brief were not available in this handoff. Do not imply Samsung or Kia are clients or MEDCO is a partner. No substitute client logos are supplied.

## 13. How Do I Change Text?

Find the sentence in its page or component and edit only the displayed text. Shared campaign process text is in `lib/workflow.ts` and `components/Workflow.tsx`; the repeated campaign call to action is in `components/CampaignCTA.tsx`.

Keep the spelling **PanoVision** and the early-stage business facts. Do not publish invented partnerships, live locations, prices, traffic counts or legal guarantees. Leave code identifiers, quotation marks, braces and component tags intact. For an apostrophe inside JSX text, follow existing examples such as `PanoVision&apos;s`.

After an edit, inspect the page on desktop and mobile and run the relevant checks from the README. A production build must be rebuilt before it displays the change.

## 14. How Do I Add the First Real Gas Station?

[`data/locations.ts`](../data/locations.ts) exports `locations`, which is intentionally empty. Add an entry only after the location and the right to display its details are verified. Do not add an example station to the public array.

Each entry follows the `ScreenLocation` type in that file: a unique `id`, verified `name`, optional `operator`, `city`, `region`, `latitude`, `longitude`, `status`, optional screen specifications, `videoDuration`, image/video support flags and `bookingTypes`. Optional `availability` is descriptive text, not a calendar integration.

Use an exact region name from `data/lebanon-map.json`: Baalbek-Hermel, Beirut, North, Mount Lebanon, South, Nabatieh, Bekaa, Akkar or Keserwan-Jbeil. The React website imports `data/locations.ts`; the unused legacy browser-global JavaScript file has been removed.

Have a developer help create the first object from verified business data. Both the network list and map read this array. Check the map pin, details panel and link to the campaign form before publishing it.

## 15. Exactly Where Do Latitude and Longitude Go?

They are numeric properties inside the station's object in `locations`, not text in the description or manually placed SVG points:

```text
locations -> your verified station object -> latitude
locations -> your verified station object -> longitude
```

Enter the measured or independently verified station coordinates in decimal degrees without quotation marks. Latitude is north/south; longitude is east/west. The renderer calls `project(longitude, latitude)` internally. Do not reverse the values or use a city center as a station's position. The sourced city points in `lebanon-map.json` remain separate geographic labels.

## 16. How Do I Change planned to live?

Change that location's `status` from `"planned"` to `"live"` only after the real display is operating and cleared for publication. `"coming-soon"` is the intermediate display label. All listed locations can appear in the map/list, so planned entries must also be real and authorized to publish.

This field changes the public location label. It neither activates a physical display nor changes a campaign's business status. Campaign moderation, business approval, payment and scheduling checks remain separate. The map's current accessible description still says there are no confirmed screens: update that description with a developer when adding the first real location.

## 17. How Do I Add Screen Width and Height?

Set `screenWidth` and `screenHeight` on the location object to the actual pixel dimensions supplied by the installer/operator. Add `aspectRatio` if known, and accurate `supportsImage`, `supportsVideo`, `videoDuration` and `bookingTypes` values. These dimensions are pixels, not physical centimeters.

There is no universal screen resolution. The current moderation validator checks general media safety and format, not a selected screen's exact pixel specification. Final fitting is a business/technical review step. The website and backend currently expect 8-second video creatives; changing a single location's duration does not change the upload validator.

## 18. How Do I Add Future Pricing?

There is no live price catalog, quotation engine or checkout. Do not invent a price or change the main button to Buy now. A developer should add approved pricing data, quote records, currency/tax treatment and payment confirmation as a coordinated feature.

The intended sequence is creative approval, location/date/specification review, quote, customer acceptance and payment, then scheduling. The existing business-status API records confirmations; it does not collect payment or send a quote.

## 19. How Does the Campaign Form Work Now?

[`components/campaign/CampaignWizard.tsx`](../components/campaign/CampaignWizard.tsx) has six steps: Company, Campaign, Location, Dates, Creative and Review. It gathers company/contact information, the campaign type, geographic preferences, optional dates and optional dominant display time for a special occasion.

Choosing a file first runs local browser checks. Clicking **Upload & check creative** then calls the server to create/update a draft containing the entered details and uploads the file to private storage. Thus data can be stored **before final submission**, even if the upload later fails or the visitor leaves. The worker checks security, media and content, while the browser polls for status.

Only the current approved creative can proceed to Review and final submission. `POST /api/campaign-request` stores the request in SQLite as `requested`; it sends no email. Availability, dimensions and pricing still need human review. No money is taken, and no screen is automatically booked or activated.

The browser keeps campaign/asset IDs in session storage for recovery within the same tab session, and the server issues a customer-session cookie. This is not a customer account portal; losing the cookie or tab storage can prevent resuming an existing draft. A downloaded JSON request is a summary, not an attached creative or proof of booking.

The separate **contact form** in `components/ContactForm.tsx` only prepares a local JSON download. Its Send message button delivers nothing. A real email link, once configured, opens the visitor's email application separately.

## 20. What Must Be Connected for Real Submissions?

Server-side campaign storage and the protected admin UI are implemented. Before enabling public uploads, configure the private volume, Node 24 runtime, origin, scanner, media tools, provider key, worker and actual review staff. Provision admin accounts, complete privacy/contact details, retention, backups and the [production checklist](PRODUCTION.md).

`PANO_UPLOADS_ENABLED` defaults to false; `MODERATION_PROVIDER` defaults to disabled. Credentials and ClamAV are not configured for this handoff. A worker with missing services holds files for manual review, and missing security validation blocks human approval too. There is no automatic notification to tell staff a request arrived: establish a review routine or implement notifications before relying on the site for leads.

Do not switch `company.submissionMode` to `demo` as a privacy/offline switch. That flag affects final submission, while the creative component still calls upload APIs. Disable uploads at the server for a display-only preview.

## 21. How Can a Backend Be Connected Later?

The current backend consists of `app/api/`, `lib/server/store.ts`, `lib/media/` and `lib/moderation/`. Extend these components instead of replacing the form with an unprotected email handler.

A future database/object-storage/queue migration must preserve customer ownership checks, private previews, current-creative checks, policy versions, idempotency, review history and campaign state gates. Adding contact delivery, staff notifications, customer accounts, payments and display scheduling are separate integrations. Each needs its own validation and failure handling.

The current SQLite/local-files design requires one host and persistent storage. It cannot be moved unchanged to ephemeral serverless hosting or multiple independent hosts.

## 22. How Do I Deploy?

Follow [Production](PRODUCTION.md). The target is a maintained single host with Node 24, persistent private storage, the web process and a separately supervised worker, behind HTTPS. Run tests, type checking, lint and a production build before release. Protect the admin surface and test backups and restoration.

Set `PANO_APP_ORIGIN` to the exact public HTTPS origin and `NEXT_PUBLIC_SITE_URL` to the final public URL without a trailing slash. The latter affects metadata, robots and the sitemap, not API security or message delivery. Leave it unset for a local preview. Publish reviewed privacy/terms and verified contact details before collecting real submissions.

This documentation does not deploy the site or configure credentials. A successful `build` alone is not production acceptance.

## 23. What Should I Not Edit Without Help?

Ask a developer before changing authentication, cookies, API routes, database tables/triggers, upload paths, file limits, media commands, moderation thresholds, provider parsing, job leases, retention deletion or campaign transitions. These are safeguards, not appearance settings.

Do not hand-edit `package-lock.json`, generated `.next/`, `node_modules/`, the SQLite database, compiled map paths or stored customer files. Keep credentials and uploads out of source control. Routine public copy, verified contact details and approved image paths are the safest edits; policy changes need the process in [Moderation](MODERATION-GUIDE.md).
