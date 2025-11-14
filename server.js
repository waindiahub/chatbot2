const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

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

    // Query ChromaDB
    const chromaResponse = await axios.post(`${process.env.CHROMADB_URL}/api/v1/collections/proschool360/query`, {
      query_texts: [query],
      n_results: 5
    });

    const documents = chromaResponse.data.documents[0] || [];
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});