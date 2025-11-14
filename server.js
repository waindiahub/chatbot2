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
let chromaAvailable = false;

async function initChroma() {
  const chromaUrl = process.env.CHROMADB_URL;
  if (!chromaUrl) {
    console.log('No CHROMADB_URL - running in fallback mode');
    chromaAvailable = false;
    return;
  }
  
  try {
    // Test ChromaDB connection
    const response = await axios.get(`${chromaUrl}/health`);
    if (response.status === 200) {
      chromaAvailable = true;
      console.log('ChromaDB server connected successfully');
    }
  } catch (error) {
    console.log('ChromaDB server not available - running in fallback mode');
    chromaAvailable = false;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'ProSchool360 Chatbot API is running' });
});

// GET endpoint for testing
app.get('/api/chat', (req, res) => {
  res.json({ 
    message: 'Use POST method with JSON body: {"query": "your question"}',
    example: 'POST /api/chat with {"query": "What is ProSchool360?"}'
  });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    let prompt;
    
    if (chromaAvailable) {
      try {
        // Query remote ChromaDB
        const chromaResponse = await axios.post(`${process.env.CHROMADB_URL}/api/v1/collections/proschool360/query`, {
          query_texts: [query],
          n_results: 5
        });
        
        const documents = chromaResponse.data.documents[0] || [];
        const context = documents.slice(0, 5).join('\n\n');
        prompt = `Based on the ProSchool360 codebase:\n\n${context}\n\nQuestion: ${query}\n\nProvide specific ProSchool360 implementation details, routes, and code references.`;
      } catch (error) {
        console.error('ChromaDB query failed:', error.message);
        chromaAvailable = false;
      }
    }
    
    if (!chromaAvailable) {
      // Fallback mode - use corpus data directly
      const contextInfo = await getProSchool360Context(query);
      prompt = `You are a helpful ProSchool360 assistant for the school management system at https://proschool360.com.\n\n${contextInfo}\n\nUser Question: ${query}\n\nProvide clear, step-by-step instructions for ProSchool360 users. Focus on:\n- How to navigate the system\n- What buttons/menus to click\n- What information to enter\n- Practical user guidance\n\nDo NOT mention technical details like file paths, controllers, or code. Give friendly, practical answers that help users accomplish their tasks.`;
    }

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
    
    res.json({ 
      reply,
      mode: chromaAvailable ? 'with_context' : 'fallback'
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to get ProSchool360 context from corpus
async function getProSchool360Context(query) {
  try {
    const fs = require('fs').promises;
    const corpus = JSON.parse(await fs.readFile('./proschool360_corpus.json', 'utf8'));
    
    // Search for relevant functionality in views and controllers
    const searchTerms = query.toLowerCase().split(' ');
    const relevantFiles = corpus.filter(file => {
      // Focus on views, controllers, and meaningful content
      if (file.path.includes('index.html') || file.path.includes('.htaccess') || file.path.includes('config/')) {
        return false;
      }
      
      const content = file.content.toLowerCase();
      const path = file.path.toLowerCase();
      
      // Look for relevant functionality
      return searchTerms.some(term => {
        return content.includes(term) || path.includes(term);
      }) && (path.includes('views/') || path.includes('controllers/') || content.includes('translate('));
    }).slice(0, 5);
    
    if (relevantFiles.length > 0) {
      // Extract user-facing information
      const userInfo = relevantFiles.map(file => {
        let info = '';
        const content = file.content;
        
        // Extract menu items, buttons, and user actions
        const menuMatches = content.match(/translate\('([^']+)'\)/g) || [];
        const buttonMatches = content.match(/btn[^>]*>([^<]+)</g) || [];
        const linkMatches = content.match(/base_url\('([^']+)'\)/g) || [];
        
        if (menuMatches.length > 0) {
          info += 'Menu items: ' + menuMatches.slice(0, 3).join(', ') + '\n';
        }
        if (linkMatches.length > 0) {
          info += 'Navigation: ' + linkMatches.slice(0, 2).join(', ') + '\n';
        }
        
        return info;
      }).filter(info => info.length > 0).join('\n');
      
      return `ProSchool360 Features:\n\n${userInfo}\n\nWebsite: https://proschool360.com`;
    }
    
    return 'ProSchool360 is a comprehensive school management system available at https://proschool360.com. It includes features for student management, attendance, fees, reports, and more.';
  } catch (error) {
    return 'ProSchool360 is a comprehensive school management system available at https://proschool360.com. It includes features for student management, attendance, fees, reports, and more.';
  }
}

// Initialize ChromaDB and start server
initChroma().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});