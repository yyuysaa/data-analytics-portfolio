# PersonifyIT

Video persona layer for the Hartnell College IT support chatbot.  
Adds a bilingual (English / Spanish) talking-head video interface on top of the existing AWS Bedrock chatbot.

---

## Project structure

```
PersonifyIT/
├── client/          React + Vite frontend (port 3000)
│   ├── src/
│   │   ├── App.jsx                 language gate + layout
│   │   └── components/
│   │       ├── LanguageSelect.jsx  full-screen language picker
│   │       ├── ChatPanel.jsx       message history + input
│   │       └── VideoPanel.jsx      Tavus video / placeholder
│   ├── index.html
│   ├── vite.config.js              proxies /api → Express on 4000
│   └── package.json
├── server/          Express backend (port 4000)
│   ├── index.js                    POST /api/chat orchestration
│   └── package.json
└── README.md
```

---

## Build order

| Step | What gets built | Status |
|------|----------------|--------|
| 1 | Minimal web UI — language toggle, chat panel, video placeholder | ✅ Done |
| 2 | Chatbot integration module (fallback RAG or Bedrock) | ⬜ Next |
| 3 | Conversational rewrite pass (LLM) | ⬜ |
| 4 | Tavus integration — rewritten text → talking-head video | ⬜ |
| 5 | Router, security-question verification, class-registration module | ⬜ |

---

## Getting started

### Prerequisites

- Node.js 18+
- npm 9+

### Install dependencies

```bash
# Frontend
cd client && npm install

# Backend
cd ../server && npm install
```

### Environment variables

Create `server/.env` (never commit this file):

```
PORT=4000

# Step 2 — add when wiring the chatbot
# BEDROCK_AGENT_ID=
# BEDROCK_AGENT_ALIAS_ID=
# AWS_REGION=us-west-2

# Step 3 — add your chosen LLM key
# OPENAI_API_KEY=
# or ANTHROPIC_API_KEY=

# Step 4 — Tavus
# TAVUS_API_KEY=
# TAVUS_REPLICA_ID=
```

### Run in development

Open **two terminals**:

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Architecture overview

```
User (browser)
  └─► React UI (Vite, :3000)
        └─► POST /api/chat  ──► Express (:4000)
                                  ├─ getChatbotResponse()   ← Step 2
                                  ├─ conversationalRewrite() ← Step 3
                                  └─ generateTavusVideo()    ← Step 4
```

The three functions in `server/index.js` are the only touch-points for future steps.  
The rest of the server and all frontend code never need to change when a new backend is wired in.

---

## Notes

- No real student data is used or stored at any point.
- The Tavus integration uses exact-text playback mode only — the chatbot (Bedrock or fallback RAG) is the sole "brain."
- Language is selected once at session start; changing it resets the conversation.
