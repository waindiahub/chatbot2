const express = require('express');
const cors = require('cors');
const axios = require('axios');
const EmbeddedChromaDB = require('./chromadb_embedded');
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
  // Try embedded ChromaDB with your corpus data
  try {
    collection = new EmbeddedChromaDB('./chroma_db');
    const initialized = await collection.initialize();
    
    if (initialized) {
      chromaAvailable = true;
      const count = await collection.count();
      console.log('🎯 Embedded ChromaDB initialized successfully');
      console.log(`📚 Loaded ${count} ProSchool360 documents`);
      console.log('✨ Using direct corpus data with semantic search');
      return;
    }
  } catch (error) {
    console.log('Embedded ChromaDB failed:', error.message);
  }
  
  console.log('❌ ChromaDB initialization failed');
  console.log('🚀 Falling back to Enhanced Corpus Mode');
  chromaAvailable = false;
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

// Translate query to English for ChromaDB search
async function translateToEnglish(query, timestamp) {
  try {
    console.log(`[${timestamp}] Translating query to English for ChromaDB search...`);
    const translateResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [{
          parts: [{ text: `Translate this question to English for database search. Only return the English translation: "${query}"` }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': process.env.GEMINI_API_KEY
        },
        timeout: 10000
      }
    );
    
    const translatedText = translateResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (translatedText && translatedText.trim().length > 0) {
      const englishQuery = translatedText.trim();
      console.log(`[${timestamp}] Translation: "${query}" -> "${englishQuery}"`);
      return englishQuery;
    }
  } catch (translateError) {
    console.log(`[${timestamp}] Translation failed:`, translateError.message);
  }
  return query;
}

// Chat endpoint with comprehensive error handling
app.post('/api/chat', async (req, res) => {
  const timestamp = new Date().toISOString();
  
  try {
    const { query } = req.body;
    
    // Log incoming request
    console.log(`[${timestamp}] Chat Request:`, {
      query: query?.substring(0, 100) + (query?.length > 100 ? '...' : ''),
      ip: req.ip
    });
    
    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.log(`[${timestamp}] 400 - Bad Request: Empty or invalid query`);
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Query is required and must be a non-empty string',
        timestamp
      });
    }

    if (query.length > 5000) {
      console.log(`[${timestamp}] 400 - Bad Request: Query too long (${query.length} chars)`);
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Query is too long. Please limit to 5000 characters.',
        timestamp
      });
    }

    // Step 1: Translate query to English for ChromaDB search
    const englishQuery = await translateToEnglish(query, timestamp);
    
    // Step 2: Get context from ChromaDB using English query
    let context = '';
    if (chromaAvailable) {
      try {
        console.log(`[${timestamp}] Searching ChromaDB with English query...`);
        const chromaResults = await collection.query(englishQuery, 8);
        const documents = chromaResults.documents[0] || [];
        
        if (documents.length > 0) {
          context = documents.join('\n\n');
          console.log(`[${timestamp}] Found ${documents.length} relevant documents`);
        } else {
          console.log(`[${timestamp}] No documents found, using fallback`);
          chromaAvailable = false;
        }
      } catch (error) {
        console.error(`[${timestamp}] ChromaDB search failed:`, error.message);
        chromaAvailable = false;
      }
    }
    
    // Step 3: Detect user's language first
    const userLanguage = detectLanguage(query);
    console.log(`[${timestamp}] Detected language: ${userLanguage}`);
    
    // Step 4: Build simple but effective prompt
    let prompt;
    if (context) {
      prompt = `You are a ProSchool360 expert assistant.

ProSchool360 Context (English data from database):
${context}

User's Original Question: "${query}"
Detected Language: ${userLanguage}

IMPORTANT INSTRUCTIONS:
1. The user asked in ${userLanguage}
2. Respond ONLY in ${userLanguage} language
3. Give COMPREHENSIVE, detailed answers with complete explanations
4. Provide step-by-step navigation: Menu → Submenu → Action
5. Include examples, tips, and additional helpful information
6. Skip branch-related information
7. Use clear, professional language

Provide comprehensive ProSchool360 guidance in ${userLanguage} with detailed explanations.`;
    } else {
      chromaAvailable = false;
    }
    
    if (!chromaAvailable) {
      // Advanced fallback mode
      try {
        console.log(`[${timestamp}] Using advanced fallback mode`);
        const enhancedContext = await getEnhancedProSchool360Context(englishQuery);
        
        prompt = `You are a ProSchool360 expert assistant.

ProSchool360 Context (English data from database):
${enhancedContext}

User's Original Question: "${query}"
Detected Language: ${userLanguage}

IMPORTANT INSTRUCTIONS:
1. The user asked in ${userLanguage}
2. Respond ONLY in ${userLanguage} language
3. Give COMPREHENSIVE, detailed answers with complete explanations
4. Provide step-by-step navigation: Menu → Submenu → Action
5. Include examples, tips, and additional helpful information
6. Skip branch-related information
7. Use clear, professional language

Provide comprehensive ProSchool360 guidance in ${userLanguage} with detailed explanations.`;
      } catch (fallbackError) {
        console.error(`[${timestamp}] Fallback Error:`, {
          message: fallbackError.message,
          stack: fallbackError.stack
        });
        
        prompt = `You are a ProSchool360 assistant.

User's Original Question: "${query}"
Detected Language: ${userLanguage}

IMPORTANT INSTRUCTIONS:
1. The user asked in ${userLanguage}
2. Respond ONLY in ${userLanguage} language
3. Give COMPREHENSIVE, detailed answers with complete explanations
4. Provide step-by-step navigation: Menu → Submenu → Action
5. Include examples, tips, and additional helpful information
6. Skip branch-related information

ProSchool360 is a comprehensive school management system available at https://proschool360.com.

If this question is about ProSchool360 features, provide comprehensive guidance in ${userLanguage} with detailed step-by-step instructions, examples, and helpful tips.

If this question is not related to ProSchool360, politely explain in ${userLanguage} that you specialize in ProSchool360 assistance.`;
      }
    }

    // Validate prompt before API call
    if (!prompt || prompt.trim().length === 0) {
      console.log(`[${timestamp}] Error: Empty prompt generated`);
      return res.status(500).json({
        error: 'Internal server error',
        message: "Unable to generate response prompt",
        timestamp
      });
    }

    // Validate API key
    if (!process.env.GEMINI_API_KEY) {
      console.error(`[${timestamp}] Error: Missing GEMINI_API_KEY`);
      return res.status(500).json({
        error: 'Configuration error',
        message: 'AI service is not properly configured',
        timestamp
      });
    }

    // Call Gemini API with timeout and error handling
    let geminiResponse;
    try {
      console.log(`[${timestamp}] Calling Gemini API...`);
      geminiResponse = await axios.post(
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
          },
          timeout: 30000 // 30 second timeout
        }
      );
      console.log(`[${timestamp}] Gemini API call successful`);
    } catch (apiError) {
      console.error(`[${timestamp}] Gemini API Error:`, {
        message: apiError.message,
        status: apiError.response?.status,
        statusText: apiError.response?.statusText,
        data: apiError.response?.data
      });
      
      if (apiError.response?.status === 429) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          timestamp
        });
      } else if (apiError.response?.status === 401) {
        return res.status(500).json({
          error: 'Authentication error',
          message: 'AI service authentication failed',
          timestamp
        });
      } else if (apiError.code === 'ECONNABORTED') {
        return res.status(504).json({
          error: 'Timeout error',
          message: 'Request timed out. Please try again.',
          timestamp
        });
      } else {
        return res.status(502).json({
          error: 'AI service error',
          message: 'Unable to get response from AI service',
          timestamp
        });
      }
    }

    // Validate API response
    const reply = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) {
      console.error(`[${timestamp}] Invalid Gemini response:`, geminiResponse.data);
      return res.status(502).json({
        error: 'Invalid AI response',
        message: 'Received invalid response from AI service',
        timestamp
      });
    }
    
    // Step 5: Save chat interaction for self-training
    await saveChatInteraction({
      timestamp,
      query,
      englishQuery,
      userLanguage,
      reply,
      context: context ? 'found' : 'fallback',
      mode: chromaAvailable ? 'embedded_chromadb' : 'enhanced_corpus_search'
    });
    
    console.log(`[${timestamp}] Response generated successfully`);
    res.json({ 
      reply,
      mode: chromaAvailable ? 'embedded_chromadb' : 'enhanced_corpus_search',
      suggestedUrls: ['https://proschool360.com'],
      contextSource: chromaAvailable ? 'chromadb' : 'fallback',
      timestamp
    });

  } catch (error) {
    console.error(`[${timestamp}] Unexpected Error:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again.',
        timestamp
      });
    }
  }
});

// Self-training functions
async function saveChatInteraction(interaction) {
  try {
    const fs = require('fs').promises;
    const trainingFile = './chat_training_data.json';
    
    let trainingData = [];
    try {
      const existingData = await fs.readFile(trainingFile, 'utf8');
      trainingData = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist, start with empty array
    }
    
    trainingData.push(interaction);
    
    // Keep only last 1000 interactions to prevent file from getting too large
    if (trainingData.length > 1000) {
      trainingData = trainingData.slice(-1000);
    }
    
    await fs.writeFile(trainingFile, JSON.stringify(trainingData, null, 2));
    console.log(`[${interaction.timestamp}] Chat interaction saved for training`);
  } catch (error) {
    console.error('Error saving chat interaction:', error.message);
  }
}

async function updateChromaWithTrainingData() {
  try {
    const fs = require('fs').promises;
    const trainingFile = './chat_training_data.json';
    
    const trainingData = JSON.parse(await fs.readFile(trainingFile, 'utf8'));
    
    // Filter successful interactions from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentInteractions = trainingData.filter(interaction => {
      const interactionDate = new Date(interaction.timestamp);
      return interactionDate > thirtyDaysAgo && interaction.reply && interaction.reply.length > 50;
    });
    
    if (recentInteractions.length === 0) {
      console.log('No recent training data to add to ChromaDB');
      return false;
    }
    
    // Create training documents from successful interactions
    const trainingDocuments = recentInteractions.map(interaction => ({
      id: `training_${interaction.timestamp}`,
      content: `Question: ${interaction.englishQuery}\nAnswer: ${interaction.reply}\nLanguage: ${interaction.userLanguage}`,
      metadata: {
        type: 'training_data',
        language: interaction.userLanguage,
        timestamp: interaction.timestamp
      }
    }));
    
    // Add to ChromaDB if available
    if (chromaAvailable && collection) {
      await collection.addDocuments(trainingDocuments);
      console.log(`Added ${trainingDocuments.length} training documents to ChromaDB`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error updating ChromaDB with training data:', error.message);
    return false;
  }
}

// Training endpoint
app.post('/api/train', async (req, res) => {
  const timestamp = new Date().toISOString();
  
  try {
    console.log(`[${timestamp}] Training request received`);
    
    const success = await updateChromaWithTrainingData();
    
    if (success) {
      res.json({
        status: 'success',
        message: 'Training data successfully added to ChromaDB',
        timestamp
      });
    } else {
      res.json({
        status: 'info',
        message: 'No new training data available or ChromaDB not available',
        timestamp
      });
    }
  } catch (error) {
    console.error(`[${timestamp}] Training Error:`, error.message);
    res.status(500).json({
      error: 'Training failed',
      message: 'Unable to process training data',
      timestamp
    });
  }
});

// Get training stats endpoint
app.get('/api/training-stats', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const trainingFile = './chat_training_data.json';
    
    try {
      const trainingData = JSON.parse(await fs.readFile(trainingFile, 'utf8'));
      
      const stats = {
        totalInteractions: trainingData.length,
        languages: [...new Set(trainingData.map(d => d.userLanguage))],
        lastInteraction: trainingData[trainingData.length - 1]?.timestamp,
        successfulInteractions: trainingData.filter(d => d.reply && d.reply.length > 50).length
      };
      
      res.json(stats);
    } catch (error) {
      res.json({
        totalInteractions: 0,
        languages: [],
        lastInteraction: null,
        successfulInteractions: 0
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Unable to get training stats' });
  }
});

// Language detection function
function detectLanguage(query) {
  const hindiPattern = /[\u0900-\u097F]/;
  const englishPattern = /^[a-zA-Z0-9\s\.,\?\!\-\'\"\(\)]+$/;
  
  // Check for Hindi/Devanagari characters
  if (hindiPattern.test(query)) {
    return 'Hindi';
  }
  
  // Check for common Hindi words in English script
  const hindiWords = ['kaise', 'kya', 'hai', 'hain', 'mein', 'me', 'ko', 'ka', 'ki', 'ke', 'se', 'par', 'aur', 'ya'];
  const queryLower = query.toLowerCase();
  if (hindiWords.some(word => queryLower.includes(word))) {
    return 'Hindi';
  }
  
  // Check for other languages (basic detection)
  if (/[\u0C80-\u0CFF]/.test(query)) return 'Kannada';
  if (/[\u0B80-\u0BFF]/.test(query)) return 'Tamil';
  if (/[\u0C00-\u0C7F]/.test(query)) return 'Telugu';
  if (/[\u0A80-\u0AFF]/.test(query)) return 'Gujarati';
  if (/[\u0A00-\u0A7F]/.test(query)) return 'Punjabi';
  if (/[\u0B00-\u0B7F]/.test(query)) return 'Oriya';
  if (/[\u0980-\u09FF]/.test(query)) return 'Bengali';
  if (/[\u0D00-\u0D7F]/.test(query)) return 'Malayalam';
  
  // Default to English if no other language detected
  return 'English';
}

// Helper function to check if query is about ProSchool360
function isProSchool360Query(query, context = '') {
  const proschoolKeywords = [
    'student', 'teacher', 'fee', 'attendance', 'exam', 'class', 'school', 'admission', 'grade',
    'छात्र', 'विद्यार्थी', 'शिक्षक', 'फीस', 'उपस्थिति', 'परीक्षा', 'कक्षा', 'स्कूल', 'प्रवेश', 'ग्रेड',
    'proschool', 'management', 'system', 'dashboard', 'login', 'report'
  ];
  
  const queryLower = query.toLowerCase();
  const hasProSchoolKeywords = proschoolKeywords.some(keyword => 
    queryLower.includes(keyword.toLowerCase())
  );
  
  const hasRelevantContext = context.toLowerCase().includes('proschool') || 
                            context.toLowerCase().includes('student') ||
                            context.toLowerCase().includes('school');
  
  return hasProSchoolKeywords || hasRelevantContext;
}

// Enhanced helper function to get comprehensive ProSchool360 context
async function getEnhancedProSchool360Context(query) {
  try {
    const fs = require('fs').promises;
    const corpus = JSON.parse(await fs.readFile('./proschool360_corpus.json', 'utf8'));
    
    const searchTerms = query.toLowerCase().split(' ');
    const keywordMap = {
      'student': ['student', 'admission', 'enrollment', 'register', 'enroll'],
      'teacher': ['teacher', 'staff', 'employee', 'faculty', 'instructor'],
      'fee': ['fee', 'payment', 'invoice', 'billing', 'finance'],
      'attendance': ['attendance', 'present', 'absent', 'tracking'],
      'exam': ['exam', 'test', 'result', 'grade', 'mark'],
      'class': ['class', 'section', 'subject', 'timetable']
    };
    
    let relevantModules = [];
    for (const [module, keywords] of Object.entries(keywordMap)) {
      if (keywords.some(keyword => query.toLowerCase().includes(keyword))) {
        relevantModules.push(module);
      }
    }
    
    const relevantFiles = corpus.filter(file => {
      const content = file.content.toLowerCase();
      const path = file.path.toLowerCase();
      
      const isRelevantFile = path.includes('controllers/') || path.includes('views/');
      const hasSearchTerms = searchTerms.some(term => content.includes(term) || path.includes(term));
      
      return isRelevantFile && hasSearchTerms;
    }).slice(0, 10);
    
    let contextInfo = 'ProSchool360 System Information:\n\n';
    
    if (relevantFiles.length > 0) {
      relevantFiles.forEach(file => {
        const content = file.content.substring(0, 500);
        contextInfo += `File: ${file.path}\n${content}...\n\n`;
      });
    }
    
    contextInfo += `🏫 ProSchool360 - Complete School Management System\n\n📍 Website: https://proschool360.com\n\n✨ KEY FEATURES:\n  • Student Management & Admission\n  • Teacher & Staff Administration\n  • Fee Management & Billing\n  • Attendance Tracking\n  • Exam & Grade Management\n  • Academic Reports & Analytics\n  • Parent Communication Portal\n  • Multi-branch Support`;
    
    return contextInfo;
    
  } catch (error) {
    console.error('Error getting enhanced context:', error);
    return `🏫 ProSchool360 - Complete School Management System\n\n📍 Website: https://proschool360.com\n\n✨ KEY FEATURES:\n  • Student Management & Admission\n  • Teacher & Staff Administration\n  • Fee Management & Billing\n  • Attendance Tracking\n  • Exam & Grade Management\n  • Academic Reports & Analytics`;
  }
}

// Initialize ChromaDB and start server
initChroma().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

// Global error handler middleware (must be after all routes)
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR:`, {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong. Please try again.',
    timestamp
  });
});

// 404 handler (must be after all routes)
app.use((req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 404 - Not Found:`, {
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found',
    timestamp
  });
});