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
