
from fastapi import FastAPI
import chromadb
from chromadb.config import Settings
from google.generativeai import configure, embed_content, generate_text
import os

configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

client = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="chroma_db"
))
collection = client.get_collection("proschool360")

@app.get("/ask")
def ask(question: str):
    q_embed = embed_content(
        model="models/text-embedding-004",
        content=question
    )["embedding"]

    result = collection.query(
        query_embeddings=[q_embed],
        n_results=3
    )

    context = "\n".join(result["documents"][0])

    reply = generate_text(
        model="models/gemini-1.5-flash",
        prompt=f"Use ONLY this context to answer:\n{context}\n\nUser Question: {question}"
    ).text

    return {"answer": reply}
