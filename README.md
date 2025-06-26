
# Website Chat & Voice Assistant

A full-stack AI system that scrapes websites, stores the content in a persistent vector database, and enables users to interact with that content via chat or voice. The platform supports multi-site scraping, site structure analysis, and deep content interaction.

Built with **FastAPI**, **React (Vite)**, **Playwright**, **BeautifulSoup**, **OpenAI**, and **LiveKit**.

---

### DEMO:
 
 link: 

## Features

### Intelligent Web Scraping and Knowledge Aggregation

* **URL-based Input**: Accepts any user-provided URL to initiate scraping.
* **Recursive Crawling**: Follows internal links to scrape entire websites to a defined depth.
* **Multi-site Support**: Load multiple websites into a single knowledge base and query them collectively.
* **Persistent Caching**: Once scraped, content is stored and reused without redundant requests.
* **Sitemap Awareness**: Extracts and processes sitemaps and page structure metadata.
* **Support for Dynamic & Static Sites**:

  * **Playwright** for JavaScript-heavy websites and SPAs.
  * **BeautifulSoup** for fast parsing of static HTML pages.
* **Non-Text Content Support**: Handles and indexes text, JSON APIs, images, and metadata for broader coverage.

### Embedding and Retrieval

* **Semantic Chunking**: Content is broken into logical text blocks optimized for context relevance (e.g., paragraphs, sections).
* **Vector Embedding**: Each chunk is embedded using OpenAI embeddings .
* **Vector Store Integration**: Chunks are indexed in a vector database (FAISS ) for fast and accurate similarity-based retrieval.
* **Efficient Context Injection**: Only the most relevant chunks are used to generate responses, optimizing LLM performance and cost.

### Natural Interaction Interfaces

* **AI Chat Interface**: Interact with the content in natural language through a web-based chat UI.
* **Voice Assistant**: Use voice input/output powered by LiveKit for hands-free interactions.
* **Context-Aware QA**: Responses cite relevant source sections with traceability.

### Advanced Structure and Metadata Queries

* Query structural properties of websites:

  * Number of pages, number of links, internal vs. external domains
  * List of image assets, scripts, or stylesheets
  * JSON endpoints, available metadata, sitemap details

## Tech Stack

**Backend**

* FastAPI (Python)
* Playwright
* BeautifulSoup
* FAISS  (vector database)
* OpenAI (embeddings & LLM API)

**Frontend**

* React (Vite)
* LiveKit (voice support)

---

## Prerequisites

* Python 3.11+
* Node.js and npm
* OpenAI API key
* LiveKit API key and secret
* (Optional) Docker, if using containerized deployment

---

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/cptfares/Maple_challenge
cd Maple_challenge
```

### 2. Backend Setup

```bash
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -e .
```

### 3. Frontend Setup

```bash
npm install
```

### 4. Create a `.env` File

```env
OPENAI_API_KEY=your_openai_api_key
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

---

## Running the Application

### Backend

```bash
uvicorn backend.main:app --reload --env-file .env
```

### Frontend

```bash
npm run dev
```

Available locally at:

* Frontend: [http://localhost:5173](http://localhost:5173)
* Backend: [http://localhost:8000](http://localhost:8000)

---

## Project Structure

```
Maple_challenge/
│
├── backend/              
│   ├── main.py                     # App entry point
│   ├── routes/                     # API endpoints: scrape, query, chat, voice
│   ├── scraping/                  
│   │   ├── playwright_scraper.py   # Headless browser scraper
│   │   └── bs_scraper.py           # Static HTML parser
│   ├── embeddings/                # Chunking, vector store logic
│   ├── models.py                  
│   ├── services.py                
│   └── utils/                     
│
├── src/                          # Frontend (React + Vite)
│   ├── components/               
│   ├── pages/                    
│   ├── hooks/                    
│   └── ...
│
├── .env
├── package.json
├── vite.config.js
└── README.md
```

---

## Future Extensions

* User accounts and private knowledge bases
* Site audit summary and content insights
* Public searchable dashboards of indexed sites
* Plugin system for actions (summarize, translate, extract tables)
* Scheduled re-crawling and content updates


## Contact

* Email: [anes002@csusm.com](mailto:anes002@csusm.com)


-
