# AmtBrief AI

AmtBrief AI is a mobile-first partner MiniApp for the 1DE / KOBIL SuperApp ecosystem. It helps people in Germany understand official German letters, detect deadlines and risks, create an action checklist, draft a formal German reply, and confirm the next step.

## Features

- Next.js App Router with TypeScript and Tailwind CSS
- Mobile-first 360-430px MiniApp layout with safe-area support
- Bottom navigation and large touch targets
- Four input methods: take photo, upload PDF, upload image, paste text
- Local PDF text extraction before AI analysis to avoid provider file parsing costs
- Recognized source excerpt saved for uploaded PDF/image/camera scans
- Fictional Ausländerbehörde example document
- Home onboarding that switches to a dashboard after the first analyzed scan
- My Scans document archive with saved analyzed document text
- Document detail routes for each scan:
  - `/scans/[scanId]/overview`
  - `/scans/[scanId]/checklist`
  - `/scans/[scanId]/reply`
- Document-specific checklist plus a global Tasks command center
- OpenRouter-powered multimodal analysis route with local fallback when no API key is configured
- OpenAI-compatible API route structure:
  - `POST /api/analyze`
  - `POST /api/generate-reply`
- Server-side reminder infrastructure for mPower SuperApp messages:
  - `POST /api/reminders/schedule`
  - `POST /api/reminders/handled`
  - `GET|POST /api/reminders/run`
  - `POST /api/webhooks/mpower`
- `public/miniApp.json` for KOBIL / 1DE MiniApp rendering

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Local fallback

If `OPENROUTER_API_KEY` is missing, the analysis route returns a high-quality local fallback for the example Ausländerbehörde letter and a useful fallback for pasted text or demo uploads.

To try the happy path:

1. Open the home screen.
2. Tap **Use example letter**.
3. Wait for the 2-second analysis loading state.
4. Review the analysis, checklist, reply draft, Tasks tab, and reminder confirmation.

## Optional live AI mode

Create `.env.local` with:

```bash
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openai/gpt-4.1-mini
OPENROUTER_MAX_TOKENS=2200
```

`POST /api/analyze` accepts both JSON text requests and `multipart/form-data`
uploads for PDF, image, and camera input. Files are validated server-side:

- PDF: `application/pdf`, max 15MB
- Images: PNG, JPG/JPEG, WEBP, max 8MB

PDF uploads are processed with local text extraction first. If the PDF contains
selectable text, the extracted text is sent to the AI as a normal text request.
If the PDF is scanned/image-only or password protected, the user is asked to
upload a clear image/photo or paste the letter text.

When `OPENROUTER_API_KEY` is configured, live analysis errors return a visible
`502` response instead of silently falling back to mock data. The UI shows retry
and alternative input options so users can switch from PDF/photo to pasted text
when needed.

The reply route can still use an OpenAI-compatible provider:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://provider.example.com/v1
```

In production, configure `OPENROUTER_API_KEY` and monitor API route failures before release.

## mPower reminders

When a user taps the reminder CTA, the app saves the reminder plan server-side.
In production, `instrumentation.ts` starts an internal reminder scheduler when
the Next.js container boots. The scheduler checks due reminders every minute and
sends SuperApp mPower choice messages automatically.

The same mPower configuration is also used for PDF signing. From the reply
screen, AmtBrief AI creates an official reply PDF, sends it to the SuperApp
signature flow, receives the `signatureResponse` callback, and exposes the
signed PDF for download when mPower returns the signed media id.

Required environment variables:

```bash
OIDC_ISSUER=...
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
MPOWER_BASE_URL=...
MPOWER_TENANT=...
MPOWER_SERVICE_UUID=...
MINIAPP_SHARE_BASE=...
APP_BASE_URL=...
REMINDER_RUN_SECRET=...
```

Optional signature-specific settings:

```bash
MPOWER_CALLBACK_URL=https://your-miniapp.example/api/webhooks/mpower
SIGNATURE_STORE_DIR=/tmp/amtbrief-ai
```

Optional scheduler controls:

```bash
REMINDER_SCHEDULER_DISABLED=true
REMINDER_SCHEDULER_INTERVAL_MS=60000
REMINDER_SCHEDULER_INITIAL_DELAY_MS=15000
REMINDER_SCHEDULER_LIMIT=25
```

The manual runner endpoint remains available for debugging or backfilling:

```bash
curl -X POST "https://your-miniapp.example/api/reminders/run" \
  -H "Authorization: Bearer $REMINDER_RUN_SECRET"
```

The mPower callback endpoint is:

```text
https://your-miniapp.example/api/webhooks/mpower
```

Make sure the MiniApp callback URL in the 1DE dashboard points to this endpoint
so mPower choice responses can mark reminders as handled or snoozed and
signature responses can mark signed PDFs as ready.

For local development without Silent SSO, set `MPOWER_TEST_USER_ID` to a test
SuperApp user id. In production, the runner should use the OIDC `sub` from the
signed `user_session` cookie.

Current reminder and signature storage uses JSON files inside
`REMINDER_STORE_DIR` / `SIGNATURE_STORE_DIR` or `/tmp/amtbrief-ai`. For a
hardened production release, replace this with a managed database so reminders
and signed-PDF status survive container replacement.

## Example document

The fictional example letter is available at:

```text
public/samples/auslaenderbehoerde-missing-documents.txt
```

It contains no real personal data.

## 1DE / KOBIL MiniApp

The MiniApp manifest is included at:

```text
public/miniApp.json
```

When the 1DE partner MCP is connected, create the MiniApp once with `create_miniapp` and deploy updates to the same `service_id` with `deploy_miniapp`.
