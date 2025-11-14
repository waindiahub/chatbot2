const { ChromaClient } = require('chromadb');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.CHROMADB_PORT || 8000;

// Initialize ChromaDB
let collection;

async function initChroma() {
  try {
    const client = new ChromaClient({ path: './chroma_db' });
    collection = await client.getCollection({ name: 'proschool360' });
    console.log('ChromaDB server started successfully');
  } catch (error) {
    console.error('ChromaDB initialization failed:', error);
    process.exit(1);
  }
}

// Query endpoint
app.post('/api/v1/collections/proschool360/query', async (req, res) => {
  try {
    const { query_texts, n_results = 5 } = req.body;
    
    if (!query_texts || !Array.isArray(query_texts)) {
      return res.status(400).json({ error: 'query_texts array required' });
    }

    const results = await collection.query({
      queryTexts: query_texts,
      nResults: n_results
    });

    res.json({
      documents: results.documents,
      metadatas: results.metadatas,
      distances: results.distances
    });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'ChromaDB server running' });
});

initChroma().then(() => {
  app.listen(PORT, () => {
    console.log(`ChromaDB server running on port ${PORT}`);
  });
});