# PaperBrief

PDF(s) → raw text extraction → OpenAI Responses API → structured scientific claims → infographic.

The app does **not** generate scientific content locally. Local code only parses PDF text, calls the OpenAI API, and renders the returned JSON.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY="your_key_here"
uvicorn backend.main:app --reload
```

Open:

```text
http://127.0.0.1:8000
```

You can also paste an API key into the UI instead of setting `OPENAI_API_KEY`.

## Features

- Single-paper and batch PDF upload.
- Per-paper structured scientific claims from the OpenAI Responses API.
- Cross-paper synthesis when multiple PDFs are uploaded.
- Compact infographic rendering by default.
- PDF print/export through the browser.
- Editable PPTX export after generation.

## API

- `POST /api/generate` - generate claims for one PDF.
- `POST /api/generate-batch` - generate claims for multiple PDFs and synthesize them.
- `GET /api/export-pptx/{batch_id}` - export the latest generated batch as PPTX.

## Files

- `backend/main.py` - FastAPI backend, PDF parsing, OpenAI Responses API calls, PPTX export.
- `index.html` - Frontend shell.
- `app.js` - Upload/API/render logic.
- `styles.css` - Infographic layout.
- `requirements.txt` - Python dependencies.

## Notes

- Text extraction uses PyMuPDF.
- Scientific claims are generated only by the OpenAI API.
- The backend uses Structured Outputs via `text.format.type = "json_schema"`.
