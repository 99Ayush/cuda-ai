# CUDA AI

Empowering Safety through Real-Time Crisis Coordination and Truth Verification.

## 🛡️ Project Overview

CUDA AI is an advanced multi-agent platform designed to address the critical gaps in emergency management within the hospitality and public event sectors. During high-stakes emergencies, information is often fractured, leading to chaos and the rapid spread of misinformation.

Sentinel-Sync, the flagship engine of CUDA AI, bridges this gap by providing a centralized command center that synchronizes emergency response while simultaneously deploying Agentic AI to detect and debunk fake news in real-time.

## 🚨 The Problem

This project directly addresses the [Rapid Crisis Response] Accelerated Emergency Response and Crisis Coordination challenge.

- **Information Silos**: Critical data often fails to reach guests and first responders simultaneously.
- **The Misinformation Crisis**: Fake news and viral rumors during a crisis can lead to panic, stampedes, and compromised safety.
- **Delayed Response**: Traditional manual reporting can be slow when seconds matter.

## ✨ Key Features

- **Real-Time Crisis Dashboard**: Built with React and Socket.io, providing an "Emergency Red" interface for immediate situational awareness.
- **Agentic Fact-Checker**: A LangGraph-powered multi-agent system that autonomously browses the web to verify rumors and assign a "Truth Score".
- **Hardware-Triggered Alerts**: Seamless integration with IoT devices (NFC/Sensors) to trigger automated safety protocols.
- **Explainable AI (XAI)**: Every verification log includes agent_reasoning, allowing officials to understand why a piece of news was flagged as fake.

## 💻 Tech Stack

- **Frontend**: React.js, Tailwind CSS, Vite
- **AI Orchestration**: Google Gemini 2.5 Flash, Tavily Search API
- **Backend**: Node.js (Express) with real-time claim analysis
- **Database**: Supabase (PostgreSQL) - optional

## 📁 Project Structure

```
cuda-ai/
├── backend/
│   └── api/
│       └── index.js          # Express server with AI fact-checking endpoints
├── frontend/
│   └── client/               # Vite + React frontend
│       ├── public/           # Static assets
│       ├── src/
│       │   ├── assets/       # Images, icons
│       │   ├── index.css     # Global styles (Tailwind)
│       │   └── main.jsx      # React app entry point
│       ├── index.html
│       ├── package.json
│       ├── vite.config.js
│       └── eslint.config.js
├── .env.example              # Environment variables template
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm or pnpm

### Installation

1. **Clone and setup environment:**
   ```bash
   git clone <repo-url>
   cd cuda-ai
   cp .env.example .env
   # Edit .env with your API keys (GEMINI_API_KEY, TAVILY_API_KEY)
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend/api
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd frontend/client
   npm install
   ```

### Running the Project

**Development mode (two terminals):**

Terminal 1 - Backend:
```bash
cd backend/api
npm start
# Runs on http://localhost:8080
```

Terminal 2 - Frontend:
```bash
cd frontend/client
npm run dev
# Runs on http://localhost:5173
```

**Production build:**
```bash
cd frontend/client
npm run build
# Output in frontend/client/dist/

cd backend/api
npm start
# Serves frontend from frontend/client/dist on port 8080
```

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key for AI analysis | Yes |
| `TAVILY_API_KEY` | Tavily API key for web search | Yes |
| `PORT` | Backend server port (default: 8080) | No |
| `NODE_ENV` | Environment mode (development/production) | No |
| `SUPABASE_URL` | Supabase project URL | No |
| `SUPABASE_KEY` | Supabase anon/service key | No |

## 📡 API Endpoints

- `GET /health` - Health check
- `POST /analyze-claim` - Analyze a claim/text for truthfulness
- `GET /history` - Get recent analysis history

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.