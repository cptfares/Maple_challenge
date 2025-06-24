# Website Chat & Voice Assistant

A full-stack project that lets you scrape websites, build a knowledge base, and interact with the content using chat or voice. The backend is built with FastAPI (Python), and the frontend uses React (Vite).

## Features

- **Multi-site Web Scraping:** Add multiple websites to your knowledge base with deep crawling and content chunking.
- **AI Chat:** Ask questions about the scraped content and get intelligent answers with source references.
- **Voice Assistant:** Join a LiveKit-powered voice room and interact with the knowledge base using speech.
- **Structure Analysis:** Query the structure and metadata of your scraped sites (pages, APIs, images, domains, etc.).
- **Modular Backend:** Clean, maintainable backend code organized in the `backend/` directory with FastAPI routers.

## Prerequisites

- Python 3.11 or higher
- Node.js and npm
- A virtual environment manager (recommended)

## Environment Setup

1. Clone the repository:
```bash
git clone [repository-url]
cd Maple_challenge_2
```

2. Set up Python environment and install dependencies:
```bash
# Create and activate a virtual environment
python -m venv venv
# On Windows
.\venv\Scripts\activate
# On Unix or MacOS
source venv/bin/activate

# Install Python dependencies
pip install -e .
```

3. Install frontend dependencies:
```bash
npm install
```

4. Create a `.env` file in the root directory with the following variables:
```env
OPENAI_API_KEY=your_openai_api_key
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

## Running the Application

1. **Start the backend server:**
```bash
# From the project root, run:
uvicorn backend.main:app --reload --env-file .env
```

2. **In a separate terminal, start the frontend development server:**
```bash
npm run dev
```

The application should now be running with:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

## Project Structure

```
Maple_challenge_2/
│
├── backend/              # All backend (FastAPI) code
│   ├── main.py           # FastAPI app entry point
│   ├── models.py         # Pydantic models
│   ├── services.py       # Service singletons
│   ├── routes/           # API routers (scrape, chat, voice)
│   └── ...               # Other backend modules
│
├── src/                  # React frontend source code
│   └── ...
├── package.json
├── vite.config.js
├── README.md
└── ...
```

## Notes
- Make sure to use the backend endpoints from `/backend/main.py`.
- The old backend files in the project root can be deleted (see `delete_note.txt`).
- For production, use a process manager and a production-ready ASGI server.
