
import json
import chromadb
from chromadb.config import Settings
from google.generativeai import configure, embed_content
from dotenv import load_dotenv
import os

load_dotenv()
configure(api_key=os.getenv("GEMINI_API_KEY"))

with open("proschool360_corpus.json", "r", encoding="utf-8") as f:
    corpus = json.load(f)

chroma_client = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="chroma_db"
))

collection = chroma_client.get_or_create_collection(name="proschool360")

for item in corpus:
    text = item["content"]
    doc_id = f"{item['path']}_{item['chunk_id']}"

    embed = embed_content(
        model="models/text-embedding-004",
        content=text
    )["embedding"]

    collection.add(
        ids=[doc_id],
        embeddings=[embed],
        documents=[text],
        metadatas=[{
            "path": item["path"],
            "chunk": item["chunk_id"]
        }]
    )

print("DONE: ChromaDB created!")
