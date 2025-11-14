# Railway Deployment Guide

## Prerequisites
1. Railway account (https://railway.app)
2. Gemini API key
3. ChromaDB running somewhere accessible

## Deployment Steps

### 1. Prepare Environment
Create `.env` file:
```
GEMINI_API_KEY=your-actual-gemini-api-key
CHROMADB_URL=http://your-chromadb-server:8000
```

### 2. Deploy to Railway

#### Option A: GitHub Integration
1. Push code to GitHub repository
2. Connect Railway to your GitHub repo
3. Set environment variables in Railway dashboard

#### Option B: Railway CLI
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### 3. Set Environment Variables in Railway
- `GEMINI_API_KEY`: Your Gemini API key
- `CHROMADB_URL`: Your ChromaDB server URL

### 4. ChromaDB Options

#### Option A: Self-hosted ChromaDB
Deploy ChromaDB on a separate server and use its URL

#### Option B: Include ChromaDB in same deployment
Add to `package.json`:
```json
"chromadb": "^0.4.0"
```

## Testing
Once deployed, test endpoints:
- `GET /health` - Health check
- `POST /api/chat` - Chat endpoint

## Local Development
```bash
npm install
npm run dev
```