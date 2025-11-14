#!/bin/bash
nohup chromadb run --path ./chroma_db --host 127.0.0.1 --port 8000 > chromadb.log 2>&1 &
echo "ChromaDB server started on port 8000"
echo "Logs: chromadb.log"