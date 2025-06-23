# Maple Challenge

This project consists of a Python backend with FastAPI and a React frontend using Vite. It includes features for chat services, voice assistance, and web scraping.

## Prerequisites

- Python 3.11 or higher
- Node.js and npm
- A virtual environment manager (recommended)

## Environment Setup

1. Clone the repository:
```bash
git clone [repository-url]
cd maplechallenge
```

2. Set up Python environment and install dependencies:
```bash
# Create and activate a virtual environment
py -m venv venv
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

1. Start the backend server:
```bash
# Activate virtual environment if not already activated
uvicorn main:app --env-file .env.
```

2. In a separate terminal, start the frontend development server:
```bash
npm run dev
```

The application should now be running with:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

## Features

- Chat service with OpenAI integration
- Voice assistance capabilities
- Web scraping functionality
- LiveKit integration for real-time communication

## Project Structure

- `main.py`: Main FastAPI backend application
- `chat_service.py`: Chat functionality implementation
- `voice_assistant.py`: Voice assistance features
- `scraper.py` & `enhanced_scraper.py`: Web scraping utilities
- `src/`: Frontend React components and logic

## Development

- Use `npm run dev` for frontend development with hot-reload
- The backend will automatically reload when changes are detected
- Use `npm run build` to create a production build of the frontend

## Dependencies

### Backend (Python)
- FastAPI
- LangChain
- OpenAI
- LiveKit
- BeautifulSoup4
- And more (see pyproject.toml)

### Frontend (React)
- React
- LiveKit Client
- Vite
