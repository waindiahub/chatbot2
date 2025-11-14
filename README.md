# ProSchool360 Chatbot

A complete chatbot system that indexes your ProSchool360 codebase and provides AI-powered answers using ChromaDB and Gemini API.

## Setup Instructions

### 1. Install Python Dependencies
```bash
cd /www/wwwroot/proschool360.com/chatbot
pip install -r requirements.txt
```

### 2. Build JSON Corpus
Scan the project and create the corpus file:
```bash
python build_json.py
```
This creates `proschool360_corpus.json` with all project files (excluding .sql, .md, ProSchoolApp, and chatbot folders).

### 3. Build ChromaDB
Create the vector database:
```bash
python build_chromadb.py
```
This creates the `chroma_db` folder with indexed documents.

### 4. Start ChromaDB Server

#### Option A: Manual Start
```bash
chmod +x start_chromadb.sh
./start_chromadb.sh
```

#### Option B: Systemd Service (Auto-start)
```bash
# Copy service file
sudo cp chromadb.service /etc/systemd/system/

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable chromadb.service
sudo systemctl start chromadb.service

# Check status
sudo systemctl status chromadb.service
```

### 5. Configure Gemini API
Edit `api.php` and replace `YOUR_API_KEY` with your actual Gemini API key:
```php
$apiKey = 'your-actual-gemini-api-key';
```

### 6. Test the System

#### Test ChromaDB
```bash
curl -X POST http://127.0.0.1:8000/api/v1/collections/proschool360/query \
  -H "Content-Type: application/json" \
  -d '{"query_texts": ["test"], "n_results": 1}'
```

#### Test API
```bash
curl -X POST http://your-domain.com/chatbot/api.php \
  -H "Content-Type: application/json" \
  -d '{"query": "How does the authentication work?"}'
```

#### Test Frontend
Open `frontend.html` in your browser or access via web server.

## File Structure
```
chatbot/
├── build_json.py          # Scans project and builds JSON corpus
├── build_chromadb.py      # Creates ChromaDB from JSON
├── requirements.txt       # Python dependencies
├── start_chromadb.sh      # Start ChromaDB server script
├── chromadb.service       # Systemd service file
├── api.php               # PHP API backend
├── frontend.html         # Simple chat interface
├── README.md             # This file
├── proschool360_corpus.json  # Generated corpus file
├── chroma_db/            # ChromaDB database folder
└── chromadb.log          # Server logs
```

## Troubleshooting

- **ChromaDB not starting**: Check `chromadb.log` for errors
- **API errors**: Verify Gemini API key and ChromaDB server status
- **Memory issues**: Reduce batch size in `build_chromadb.py`
- **Permission errors**: Ensure proper file permissions for web server