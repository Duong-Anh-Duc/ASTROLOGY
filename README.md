# Divination Suite — Next.js Local App

An automated divination assistant. Enter customer data → the system scrapes
three Vietnamese divination sites in parallel → Gemini analyses each category
independently → Claude synthesises the full document → the result is exported
to a Google Doc, ready for final review.

> Runs entirely on your local machine — no deployment needed.

---

## Stack
- Next.js 14+ App Router, TypeScript (strict)
- `next-intl` for Vietnamese + English UI
- Tailwind CSS · Inter font · `lucide-react` icons
- Playwright (Chromium, headless)
- Google Gemini (`@google/generative-ai`) — one independent call per category
- Anthropic Claude (`@anthropic-ai/sdk`) — final synthesis
- Google Docs + Drive APIs (`googleapis`)

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npx playwright install chromium

# 3. Create .env.local from template
cp .env.example .env.local
# Then open .env.local and fill in:
#   GEMINI_API_KEY
#   ANTHROPIC_API_KEY
#   GOOGLE_DRIVE_FOLDER_ID

# 4. Place google-service-account.json into credentials/
#    (see "Google Service Account Setup" below)

# 5. Run dev server
npm run dev

# 6. Open browser: http://localhost:3000
```

The root URL redirects to `/vi` by default. Switch language via the dropdown
in the top-right corner.

---

## Google Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a
   new project (or pick an existing one).
2. Enable APIs:
   - **Google Docs API**
   - **Google Drive API**
3. Create a Service Account:
   - **IAM & Admin** → **Service Accounts** → **Create Service Account**
   - Once created, open the account → **Keys** → **Add Key** → **JSON**
   - A `.json` file will download.
   - Save it as `credentials/google-service-account.json` in this project.
4. Create the destination folder on Google Drive (where result docs will be
   saved):
   - Open the folder, copy the ID from the URL:
     `drive.google.com/drive/folders/[FOLDER_ID]`
   - Share the folder with the service-account email
     (the `client_email` field in the JSON) with **Editor** access.
5. Paste the folder ID into `.env.local` under `GOOGLE_DRIVE_FOLDER_ID`.

> Anyone with the resulting doc link can view it (reader permission is
> applied automatically). Edit access remains with the service account and
> the folder's owners.

---

## Environment variables

| Key                            | Required | Purpose                                            |
| ------------------------------ | -------- | -------------------------------------------------- |
| `GEMINI_API_KEY`               | yes      | Google Gemini key                                  |
| `ANTHROPIC_API_KEY`            | yes      | Anthropic Claude key                               |
| `GOOGLE_SERVICE_ACCOUNT_PATH`  | yes      | Path to the service-account JSON file              |
| `GOOGLE_DRIVE_FOLDER_ID`       | yes      | Drive folder ID for result docs                    |
| `PLAYWRIGHT_HEADLESS`          | no       | `false` to watch scrapers in a real browser window |

---

## Folder structure

```
divination-app/
├── .env.local                              # local secrets
├── credentials/google-service-account.json # Google credentials
├── i18n.ts                                 # next-intl config
├── middleware.ts                           # locale routing
├── messages/{vi,en}.json                   # translations
├── src/
│   ├── app/
│   │   ├── [locale]/{layout,page,globals.css}
│   │   └── api/run/route.ts                # main orchestrating endpoint
│   ├── components/
│   │   ├── DivinationForm.tsx
│   │   ├── StatusPanel.tsx
│   │   ├── LanguageSwitcher.tsx
│   │   └── ui/                             # primitives
│   ├── lib/
│   │   ├── scrapers/{tuTru,maiHoa,simPhongThuy}.ts
│   │   ├── ai/{gemini,claude}.ts
│   │   └── output/googleDoc.ts
│   └── types/index.ts
└── scripts/                                # standalone tsx test scripts
```

---

## Customising the AI prompts

System prompts for Gemini and Claude are defined as **named string constants
at the top** of:

- `src/lib/ai/gemini.ts` → `SYSTEM_PROMPT_TU_TRU`, `SYSTEM_PROMPT_MAI_HOA`, `SYSTEM_PROMPT_SIM`
- `src/lib/ai/claude.ts` → `SYSTEM_PROMPT_SYNTHESIZE`

Each is marked with a `[TODO: User will customize this expert divination prompt]`
header so you can replace it with your own expert wording. The pipeline keeps
each category isolated for Gemini (one call per topic, no merging) — this is
deliberate and important to keep the analysis focused.

---

## Standalone test scripts

Each piece of the pipeline can be exercised independently:

```bash
npm run test:tutru     # scrape only — Lá số Tứ Trụ
npm run test:maihoa    # scrape only — Kinh Dịch Mai Hoa
npm run test:sim       # scrape only — Sim Phong Thủy
npm run test:gemini    # Gemini analyses, with fake scraped text
npm run test:claude    # Claude synthesis, with fake analyses
npm run test:doc       # Create a Google Doc from a fixed markdown sample
```

Selectors on the target sites may change — if a scraper fails, open the page
in DevTools and update the corresponding `// TODO: Verify selector` lines in
`src/lib/scrapers/*.ts`.

---

## Notes

- Dark mystical theme is the only mode; gold accents on deep midnight purple.
- The app stores **nothing** — each run is independent.
- All API/AI calls happen server-side; no keys leak to the browser.
- Default timeouts: 30 s per scraper, 60 s per AI call.
