# NOVA AI Workspace — Firebase #BuildHybridAI Hackathon Edition

NOVA AI Workspace is a responsive, hybrid-AI productivity environment combining **Chat**, **Quiz**, **Code**, and **Plan** studios inside a unified 3-panel architecture powered by **Firebase AI Logic (`firebase/ai`)**, **Chrome Built-in AI (Gemini Nano)**, **server-side Gemini Developer API (`@google/genai`)**, **Firebase Auth & Firestore**, **Cloud SQL (PostgreSQL + Drizzle ORM)**, **Google Workspace APIs**, and **offline-first IndexedDB + PWA** persistence.

---

## Core Architecture

1. **Four Integrated Workspaces**
   - **Chat Studio**: AI Model & Persona switcher (with search & custom persona CRUD), multimodal file/image/video/audio input, SSE streaming, microphone transcription (`gemini-3.5-transcribe`), text-to-speech (`gemini-3.8-flash-lite-tts`), claim verification against Knowledge Vault sources, conversation branching, and export to Markdown or **Google Docs**.
   - **Quiz Studio**: Subject management, configurable question types (`multiple_choice`, `true_false`, `short_answer`, `fill_blank`, `mixed`, `essay`), difficulty & timer controls, automated grading, **Google Sheets** export, and built-in **Quiz Accessories** (Calculator, Highlighter, Magnifier, Scratch Notes).
   - **Code Studio**: Monaco code editor, multi-file workspace, sandboxed live HTML preview (`sandbox="allow-scripts"`), 9 AI code actions, and **Visual-to-Code** (Mini Paint wireframe canvas & screenshot upload converted into HTML/CSS or React components).
   - **Plan Studio**: Multi-view execution planner (**List**, **Kanban Board**, **Calendar**, **Timeline**, **Daily Agenda**), AI roadmap generation, progress tracking, **Google Calendar** scheduling, and **Google Slides** deck export.

2. **Firebase AI Logic Hybrid Inference & Monitoring**
   - Uses `getAI(app, { backend: new GoogleAIBackend() })` and `getGenerativeModel(ai, { mode, inCloudParams })` with `InferenceMode.PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, `PREFER_IN_CLOUD`, and `ONLY_IN_CLOUD`.
   - Probes real Chrome Prompt API (`LanguageModel` / `window.ai.languageModel`) readiness and never fakes on-device execution: `result.response.inferenceSource` (`on_device` vs `in_cloud`) is logged verbatim to the **Hybrid AI Monitor**.
   - Includes **6 repeatable Hackathon Demo scenarios** inside the Hybrid AI Monitor modal.

3. **Security, Persistence & Offline Support**
   - **Firestore Rules (`firestore.rules`)**: Ownership-scoped, field-validated security rules tested with `@firebase/eslint-plugin-security-rules` and `firestore.rules.test.ts`.
   - **Firebase App Check & Remote Config**: Optional ReCaptcha V3 App Check (`VITE_FIREBASE_APP_CHECK_SITE_KEY`) and Remote Config flags (`nova_hybrid_default_mode`, `nova_enable_verification`).
   - **Offline-First Sync**: IndexedDB state persistence (`nova_workspace_persisted_v1`) + automatic sync queue flush when connectivity resumes.
   - **Server-Side Secrets**: `GEMINI_API_KEY` stays strictly on the Express backend (`server.ts`); Google Workspace OAuth tokens remain memory-only on the client.

---

## Running Locally & Testing

1. **Install & Configure**
   ```bash
   npm install
   ```
   Configure `GEMINI_API_KEY` in environment secrets (see `.env.example`).

2. **Start Development Server (Port 3000)**
   ```bash
   npm run dev
   ```

3. **Run Unit & Security Rules Tests**
   ```bash
   npx --yes tsx --test src/services/hybrid-router/router.test.ts src/utils/workspaceLogic.test.ts firestore.rules.test.ts
   ```

4. **Typecheck & Production Build**
   ```bash
   npm run lint
   npm run build
   ```

---

## Hackathon Demonstration Walkthrough

1. Open **NOVA AI Workspace** and notice the top navigation bar (`Chat | Quiz | Code | Plan`), Hybrid AI status indicator, and dedicated **Settings** button separated from Chat History.
2. Click **Hybrid AI Monitor** in the top bar -> click **Probe** to inspect real Chrome Gemini Nano readiness -> run the 6 **Repeatable Hackathon Demo Scenarios** (On-device attempt, Cloud inference, Local-unavailable fallback, Strict-Local privacy block, Offline resilience check, Flash-Lite latency check) and inspect live telemetry.
3. In **Chat**, select or create a custom Persona, ask a question, click **Verify** on a response to audit claims against **Knowledge Vault** documents, or export the conversation to **Google Docs**.
4. Switch to **Quiz**, complete a timed quiz using the **Calculator / Highlighter / Magnifier** accessories, and export results to **Google Sheets**.
5. Switch to **Code**, sketch a UI wireframe on the **Visual-to-Code** canvas, click **Generate Code from Sketch**, and inspect the live **Sandboxed Preview** alongside Monaco Editor.
6. Switch to **Plan**, toggle between **List / Kanban / Calendar / Timeline / Daily Agenda**, and schedule a task onto **Google Calendar** or export to **Google Slides**.
