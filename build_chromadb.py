#!/usr/bin/env python3
import ijson
import chromadb
from chromadb.config import Settings
import os
from tqdm import tqdm

def load_corpus_streaming(json_file):
    """Load corpus using streaming JSON parser"""
    with open(json_file, 'rb') as f:
        parser = ijson.items(f, 'item')
        for item in parser:
            yield item

def main():
    # Setup ChromaDB
    chroma_path = "./chroma_db"
    os.makedirs(chroma_path, exist_ok=True)
    
    client = chromadb.PersistentClient(
        path=chroma_path,
        settings=Settings(anonymized_telemetry=False)
    )
    
    # Create or get collection
    try:
        collection = client.get_collection("proschool360")
        client.delete_collection("proschool360")
    except:
        pass
    
    collection = client.create_collection("proschool360")
    
    # Load and process documents
    json_file = "proschool360_corpus.json"
    
    batch_documents = []
    batch_metadatas = []
    batch_ids = []
    batch_size = 100
    doc_id = 0
    
    print("Loading documents from JSON...")
    
    for item in tqdm(load_corpus_streaming(json_file)):
        doc_id += 1
        
        batch_documents.append(item['content'])
        batch_metadatas.append({"path": item['path']})
        batch_ids.append(str(doc_id))
        
        if len(batch_documents) >= batch_size:
            collection.add(
                documents=batch_documents,
                metadatas=batch_metadatas,
                ids=batch_ids
            )
            batch_documents = []
            batch_metadatas = []
            batch_ids = []
    
    # Add remaining documents
    if batch_documents:
        collection.add(
            documents=batch_documents,
            metadatas=batch_metadatas,
            ids=batch_ids
        )
    
    print(f"Added {doc_id} documents to ChromaDB")
    print("ChromaDB build complete!")

if __name__ == "__main__":
    main()