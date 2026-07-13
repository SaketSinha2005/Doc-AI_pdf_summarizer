# DocGen AI — PDF Summarizer

A small project for getting hands-on with **LangChain**, **LangSmith**, **Docker**, and **Kubernetes** — built as a PDF summarization tool for the Indian... well, for any PDF, really. Upload a PDF, get back a structured report: title, summary, key insights, and any concrete data points found in the document.

No PDF is ever stored. Each upload is read into memory, processed, and discarded once the response is sent.

---

## How it works

```
┌──────────────┐        multipart/form-data         ┌──────────────────────┐
│  Browser     │ ──────────────────────────────────▶│  FastAPI backend      │
│  (landing.   │                                     │  (main.py)            │
│   html +     │◀──────────────────────────────────  │                       │
│   script.js) │        structured JSON report       │  1. Extract PDF text  │
└──────────────┘                                     │  2. Chunk + embed     │
                                                      │  3. Retrieve context  │
                                                      │  4. LLM → structured  │
                                                      │     report (LangChain)│
                                                      └───────────┬───────────┘
                                                                  │
                                                                  ▼
                                                          OpenAI API (LLM +
                                                          embeddings)
```

The PDF bytes live only for the duration of the request — read into a `BytesIO` buffer, parsed with `pypdf`, and never written to disk.

## Features

- **Single-page frontend** (`landing.html` + `script.js`) with three swappable views: upload, processing (live progress), and a report dashboard — no page reloads.
- **RAG-based analysis**: extracted text is chunked, embedded, and retrieved against targeted questions (objective, key findings, conclusions, concrete figures) before synthesis.
- **Structured output**: the LLM returns a typed `DocumentReport` (title, summary, insights, data points) via LangChain's `with_structured_output`, not a single freeform paragraph — so the frontend can render a real dashboard instead of a text dump.
- **Honest confidence metric**: "Extraction Confidence" is *computed* (percentage of PDF pages that yielded readable text), not an LLM-guessed number — this correctly flags scanned/image-only PDFs.
- **No persistence**: nothing touches disk or a database. Everything is processed in memory per-request.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Static HTML/CSS/JS, Tailwind (CDN) |
| Backend | Python, FastAPI |
| LLM orchestration | LangChain (`langchain-openai`, structured output, RAG) |
| PDF parsing | `pypdf` |
| Vector store | LangChain `InMemoryVectorStore` (no external DB) |
| LLM / embeddings | OpenAI (`gpt-4o-mini`, `text-embedding-3-small`) |
| Observability *(planned)* | LangSmith |
| Containerization *(planned)* | Docker |
| Orchestration *(planned)* | Kubernetes |

## Project structure

```
docgen-ai/
├── README.md
├── .gitignore
├── frontend/
│   ├── landing.html
│   ├── script.js
│   ├── style.css
│   └── tailwind-config.js
└── backend/
    ├── main.py
    ├── requirements.txt
    └── .env            # not committed — holds OPENAI_API_KEY
```

## Getting started

### Prerequisites
- Python 3.10+
- An OpenAI API key

### 1. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

pip install fastapi uvicorn python-multipart pypdf python-dotenv \
            langchain langchain-openai langchain-core langchain-text-splitters
```

Create `backend/.env`:
```
OPENAI_API_KEY=sk-...
```

Run the server:
```bash
uvicorn main:app --reload --port 8000
```

The API is now live at `http://127.0.0.1:8000`.

### 2. Frontend

The frontend is plain static files — no build step. Just open `frontend/landing.html` directly in a browser, or serve it:

```bash
cd frontend
python -m http.server 8080
```

Then visit `http://localhost:8080/landing.html`, upload a PDF, and watch it move through the upload → processing → report views.

## API

### `POST /summarize`

**Request:** `multipart/form-data` with a `file` field (PDF).

**Response:**
```json
{
  "filename": "example.pdf",
  "date": "2026-07-13",
  "pages_analyzed": 12,
  "extraction_confidence": 100.0,
  "title": "Q3 Growth Strategy Overview",
  "summary": "...",
  "insights": [
    { "type": "positive", "heading": "Revenue Growth", "description": "..." }
  ],
  "data_points": [
    { "label": "Q3 Revenue", "value": "$4.2M", "note": "vs. $3.6M in Q2" }
  ]
}
```

`insights` and `data_points` may be empty arrays — the frontend hides those dashboard sections when that happens, rather than showing empty boxes.

## Known limitations / things to harden later

- CORS is currently wide open (`allow_origins=["*"]`) — fine for local dev, tighten before any real deployment.
- No file-type/magic-byte validation server-side yet (frontend checks MIME type and size, but that's easy to spoof).
- No rate limiting — a public deployment would need this to avoid abuse of the OpenAI API budget.
- Large PDFs (500+ pages) haven't been load-tested; chunking is currently fixed at 1000 chars with 200 overlap.


## License

Personal/educational project — no license applied yet.