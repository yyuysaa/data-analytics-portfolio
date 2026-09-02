# 🎥 PersonifyIT
### A bilingual AI video-persona chatbot for Hartnell College IT Support.
PersonifyIT pairs a talking video avatar (Tavus CVI) with a knowledge-grounded AI backend, so students can get IT support by speaking to an on-screen persona or typing in chat — in English or Spanish. This README covers my contributions: the backend services layer, the post-session experience, and the data pipeline that makes each conversation useful beyond a single session.

## ✨ What It Does
Talk or type — students interact with a video avatar that answers from Hartnell's IT knowledge base, or use the text chat.
Bilingual — full English and Spanish support across the UI and AI responses.
Remembers the conversation — every session (typed + spoken) is captured, summarized, stored, and optionally emailed to the student.
Feeds back into support — structured ratings and full transcripts give IT staff queryable insight into what students actually asked.
## 🧩 My Contributions
### ⭐ Post-Session Rating System
- When a student ends a session, a 1–5 star prompt appears. Low scores (1–2 stars) reveal a follow-up field asking what could be improved, giving IT staff structured, queryable feedback tied directly to the conversation that prompted it — something the previous text-only chatbot lacked.
- Built as a self-contained, bilingual component (SessionRating.jsx), along with the "End Session" button and the post-session overlay (PostSessionPanel.jsx) housing both the rating and email prompts.

### 📧 Email Transcript Delivery
- After a session, students can optionally have a copy of the conversation emailed to them (non-blocking — they can decline). The delivered email includes:
- A 2–3 sentence AI-generated summary (Amazon Bedrock Nova Pro) at the top for the key takeaway
- The full chronological transcript with speaker labels and timestamps
- Delivery fires in the background via AWS SES after the API responds, so the student never waits.

### 🎙️ Video Call Transcript Capture
- Spoken exchanges (student speech + avatar responses) flow through a server-side LLM proxy. I added capture hooks so every spoken turn is recorded with a timestamp and role label, then merged chronologically with the typed chat into one unified transcript — so both the email and the database record reflect the complete interaction, not just the text portion.

### 🗄️ Data Storage — DynamoDB + S3
- DynamoDB (PersonifyIT-Sessions) — each session persisted as a single record: rating, low-rating reason, email (if given), full merged transcript, agent ID, language, and timestamp. Queryable by rating range, so staff can instantly pull "all sessions rated 1–2 stars" and read exactly what was said.
- S3 — full session JSON archived under a date-partitioned key (sessions/YYYY-MM-DD/<session-id>.json), separating queryable metadata from long-term raw archival and leaving the dataset ready for future Athena/Glue analysis with no extra infrastructure.

### 🧠 Bedrock Summarization
- Before sending each transcript email, the server calls Amazon Bedrock (Nova Pro) to summarize the conversation in 2–3 sentences in the student's chosen language, placed above the full transcript.

### 🔧 Tavus Custom LLM Integration Fix
The video avatar was configured to use the team's server as its LLM (so it answers from Hartnell's knowledge base, not a generic model) — but the integration was broken. I diagnosed and fixed four issues: wrong API endpoint (/v2/pals → /v2/personas), incorrect field names, a missing /v2 suffix on the base URL, and an unsupported extra_headers parameter that triggered a 500. This restored the avatar's ability to give knowledge-grounded answers.

### 🌐 Cloudflare Tunnel + QR Code Demo
For the live demo, I configured a Cloudflare Tunnel to expose the local Express backend as a public HTTPS endpoint — required for Tavus to reach the LLM proxy and for the audience to access the app on their phones. I updated Vite's dev server config to accept external hosts and generated a QR code so audience members could scan and try the bot live.

### 🔗 Source Links Feature (Restored)

The chatbot surfaces citation URLs from Bedrock's retrieval results as clickable reference links below each response. Originally built by a teammate and later reverted, I restored it — resolving three-way merge conflicts across ChatPanel.jsx, llm-proxy.js, and index.js while preserving all other features.

### 🛠️ Technical Stack (my portions)
- Frontend: React, Vite SessionRating.jsx · EndSessionPrompt.jsx · PostSessionPanel.jsx
- Backend: Node.js, Express sessions.js · db.js · video-transcript.js · ses.js · summarize.js · s3-archive.js
- AWS: DynamoDB · S3 · SES · Bedrock (Nova Pro)
- Infrastructure: Cloudflare Tunnel · Tavus CVI persona API

## 🏗️ Architecture at a Glance

```
Student (voice / text)
        │
        ├── Typed chat ─────────────┐
        │                           │
        └── Video avatar (Tavus CVI)│
                 │                  │
                 ▼                  ▼
        Server-side LLM proxy ──► Bedrock (knowledge base + Nova Pro)
                 │
                 ▼
        Merged transcript (typed + spoken)
                 │
      ┌──────────┼───────────────┐
      ▼          ▼               ▼
  DynamoDB      S3            SES email
 (queryable)  (archive)   (summary + transcript)
```

