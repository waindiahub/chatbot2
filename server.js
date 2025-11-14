const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { ChromaClient } = require('chromadb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Initialize ChromaDB client
let collection;
async function initChroma() {
  try {
    const client = new ChromaClient({ path: './chroma_db' });
    collection = await client.getCollection({ name: 'proschool360' });
    console.log('ChromaDB connected successfully');
  } catch (error) {
    console.error('ChromaDB connection failed:', error.message);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'ProSchool360 Chatbot API is running' });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    if (!collection) {
      return res.status(500).json({ error: 'ChromaDB not available' });
    }

    // Query ChromaDB directly
    const results = await collection.query({
      queryTexts: [query],
      nResults: 5
    });

    const documents = results.documents[0] || [];
    const context = documents.slice(0, 5).join('\n\n');

    // Build prompt
    const prompt = `Use only the following ProSchool360 code:\n\n${context}\n\nQuestion: ${query}`;

    // Call Gemini API
    const geminiResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': process.env.GEMINI_API_KEY
        }
      }
    );

    const reply = geminiResponse.data.candidates[0]?.content?.parts[0]?.text || 'No response generated';
    
    res.json({ reply });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize ChromaDB and start server
initChroma().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});