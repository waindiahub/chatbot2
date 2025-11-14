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

// Advanced query analysis function
async function analyzeQuery(query, timestamp) {
  try {
    const analysisResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [{
          parts: [{ text: `Analyze this ProSchool360 query and return JSON with: {"intent": "primary_intent", "entities": ["entity1", "entity2"], "complexity": "simple|medium|complex", "language": "detected_language", "category": "student|teacher|fee|attendance|exam|report|other"}: "${query}"` }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': process.env.GEMINI_API_KEY
        },
        timeout: 8000
      }
    );
    
    const analysisText = analysisResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    try {
      return JSON.parse(analysisText);
    } catch {
      return { intent: 'general', entities: [], complexity: 'medium', language: 'English', category: 'other' };
    }
  } catch (error) {
    console.log(`[${timestamp}] Query analysis failed:`, error.message);
    return { intent: 'general', entities: [], complexity: 'medium', language: 'English', category: 'other' };
  }
}

// Enhanced context retrieval with smart ranking
async function getSmartContext(query, englishQuery, analysis, timestamp) {
  try {
    // Adjust search parameters based on complexity
    const searchCount = analysis.complexity === 'complex' ? 12 : analysis.complexity === 'medium' ? 8 : 5;
    
    // Use category-specific search terms
    const categoryKeywords = {
      'student': ['admission', 'enrollment', 'registration', 'student_profile'],
      'teacher': ['staff', 'employee', 'teacher_profile', 'staff_management'],
      'fee': ['payment', 'invoice', 'fee_collection', 'billing'],
      'attendance': ['present', 'absent', 'attendance_report', 'tracking'],
      'exam': ['test', 'result', 'grade', 'examination', 'marksheet'],
      'report': ['analytics', 'dashboard', 'summary', 'statistics']
    };
    
    const enhancedQuery = analysis.category !== 'other' ? 
      englishQuery + ' ' + (categoryKeywords[analysis.category] || []).join(' ') : englishQuery;
    
    console.log(`[${timestamp}] Enhanced search query: "${enhancedQuery}"`);
    
    if (chromaAvailable) {
      const chromaResults = await collection.query(enhancedQuery, searchCount);
      return {
        documents: chromaResults.documents[0] || [],
        source: 'chromadb',
        searchTerms: enhancedQuery
      };
    } else {
      const fallbackContext = await getEnhancedProSchool360Context(enhancedQuery);
      return {
        documents: [fallbackContext],
        source: 'fallback',
        searchTerms: enhancedQuery
      };
    }
  } catch (error) {
    console.error(`[${timestamp}] Smart context retrieval failed:`, error.message);
    return { documents: [], source: 'error', searchTerms: englishQuery };
  }
}

// Advanced prompt engineering based on query analysis
function buildAdvancedPrompt(query, englishQuery, context, analysis, contextInfo) {
  const complexityInstructions = {
    'simple': 'Provide a concise, direct answer with 2-3 key steps.',
    'medium': 'Provide a comprehensive answer with detailed steps and examples.',
    'complex': 'Provide an in-depth explanation with multiple approaches, best practices, and troubleshooting tips.'
  };
  
  const categorySpecificGuidance = {
    'student': 'Focus on student lifecycle: admission → enrollment → profile management → academic tracking.',
    'teacher': 'Focus on staff management: registration → profile setup → role assignment → performance tracking.',
    'fee': 'Focus on financial workflow: fee structure → collection → payment processing → reporting.',
    'attendance': 'Focus on attendance workflow: daily marking → tracking → reporting → notifications.',
    'exam': 'Focus on examination process: creation → scheduling → conduct → result processing → analysis.',
    'report': 'Focus on analytics: data collection → report generation → insights → decision making.'
  };
  
  return `You are an advanced ProSchool360 AI assistant with deep expertise in school management systems.

🧠 QUERY ANALYSIS:
- Intent: ${analysis.intent}
- Category: ${analysis.category}
- Complexity: ${analysis.complexity}
- Detected Language: ${analysis.language}
- Key Entities: ${analysis.entities.join(', ')}

📚 PROSCHOOL360 CONTEXT (English data from database):
${context}

❓ USER QUERY:
Original Query in ${analysis.language}: ${query}
English Translation for Search: ${englishQuery}

🌐 CRITICAL LANGUAGE INSTRUCTION:
- The user asked in ${analysis.language}
- You MUST respond COMPLETELY in ${analysis.language}
- DO NOT respond in English
- Use the English context above to understand ProSchool360 features, then translate your entire response to ${analysis.language}
- If user asked in Hindi/Hinglish, respond completely in Hindi
- If user asked in Spanish, respond completely in Spanish
- If user asked in any other language, respond completely in that language

🎯 RESPONSE STRATEGY:
${complexityInstructions[analysis.complexity]}
${categorySpecificGuidance[analysis.category] || 'Provide comprehensive ProSchool360 guidance.'}

📋 ADVANCED CONTENT GUIDELINES:
- Start with acknowledgment in ${analysis.language}
- Provide numbered steps with clear headings in ${analysis.language}
- Include navigation paths in ${analysis.language}
- Add practical examples in ${analysis.language}
- Mention related features and workflows in ${analysis.language}
- Include troubleshooting tips for complex queries in ${analysis.language}
- Skip branch-related terminology
- Use emojis for better readability

🚫 RESTRICTIONS:
- Only answer ProSchool360-related questions
- NEVER respond in English if user asked in another language
- Maintain professional yet friendly tone in user's language
- Avoid technical jargon
- Focus on practical implementation

Provide expert-level guidance in ${analysis.language} that helps users master ProSchool360 effectively.`;
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

    // Step 1: Advanced query analysis
    console.log(`[${timestamp}] Analyzing query...`);
    const analysis = await analyzeQuery(query, timestamp);
    console.log(`[${timestamp}] Query analysis:`, analysis);
    
    // Step 2: Smart translation for English search
    let englishQuery = query;
    if (analysis.language !== 'English') {
      try {
        console.log(`[${timestamp}] Translating ${analysis.language} query to English...`);
        const translateResponse = await axios.post(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
          {
            contents: [{
              parts: [{ text: `Translate this ${analysis.language} question to English for database search. Only return the English translation: "${query}"` }]
            }]
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-goog-api-key': process.env.GEMINI_API_KEY
            },
            timeout: 8000
          }
        );
        
        const translatedText = translateResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (translatedText && translatedText.trim().length > 0) {
          englishQuery = translatedText.trim();
          console.log(`[${timestamp}] Smart translation: "${query}" -> "${englishQuery}"`);
        }
      } catch (translateError) {
        console.log(`[${timestamp}] Translation failed:`, translateError.message);
      }
    }
    
    // Step 3: Smart context retrieval
    console.log(`[${timestamp}] Retrieving smart context...`);
    const contextInfo = await getSmartContext(query, englishQuery, analysis, timestamp);
    
    let prompt;
    if (contextInfo.documents.length > 0) {
      const context = Array.isArray(contextInfo.documents) ? 
        contextInfo.documents.join('\n\n') : contextInfo.documents;
      
      console.log(`[${timestamp}] Context retrieved from ${contextInfo.source}, ${contextInfo.documents.length} documents`);
      
      // Step 4: Build advanced prompt
      prompt = buildAdvancedPrompt(query, englishQuery, context, analysis, contextInfo);
      
      // Store context info for response
      res.locals.contextInfo = contextInfo;
    } else {
      console.log(`[${timestamp}] No context found, using fallback`);
      chromaAvailable = false;
    }
    
    if (!chromaAvailable) {
      // Advanced fallback mode
      try {
        console.log(`[${timestamp}] Using advanced fallback mode`);
        const enhancedContext = await getEnhancedProSchool360Context(englishQuery);
        
        prompt = `You are an expert ProSchool360 assistant for the complete school management system at https://proschool360.com.

ProSchool360 System Context (English data from database):
${enhancedContext}

Original User Question: ${query}
English Translation Used for Search: ${englishQuery}

🌐 CRITICAL LANGUAGE INSTRUCTION:
- The user asked their question in a specific language
- You MUST respond COMPLETELY in the SAME LANGUAGE as the original user question
- DO NOT respond in English unless the user asked in English
- Use the English context above to understand ProSchool360 features, then translate your ENTIRE response to the user's original language

IMPORTANT INSTRUCTIONS:
1. The database context above is in English, but you must respond in the SAME LANGUAGE as the original user question: "${query}"
2. Use the English context data to understand ProSchool360 features, then explain everything in the user's original language
3. AUTOMATICALLY detect the language of the original user question and respond in that EXACT SAME LANGUAGE
4. If the user asked in Hindi/Hinglish, respond completely in Hindi
5. If the user asked in Spanish, respond completely in Spanish
6. If the user asked in any other language, respond completely in that language

Provide detailed and helpful answers as an experienced ProSchool360 guide. Focus on:

🏫 PROSCHOOL360 FEATURES:
- Student Management (admission, enrollment, records)
- Teacher Management (profiles, assignments, schedules)
- Fee Management (collection, invoices, reports)
- Attendance System (daily tracking, reports)
- Exam Management (creation, grading, results)
- Academic Management (classes, subjects, timetables)
- Communication Tools (notifications, messaging)
- Reports & Analytics (academic, financial, administrative)

📱 NAVIGATION GUIDANCE:
- Provide clear menu paths
- Explain button locations and actions
- Detail form fields and requirements (skip branch-related fields)
- Give workflow steps with numbered lists
- Include relevant sidebar.php navigation routes

💡 BEST PRACTICES:
- Efficient usage tips
- Common workflows
- Time-saving features
- Troubleshooting guidance

🚫 IMPORTANT: 
- AUTOMATICALLY detect and respond in the same language as the user's question
- Skip any "Branch" terminology or branch-related fields
- Provide relevant sidebar navigation links

Provide ProSchool360-specific and practical advice to help users effectively use the system.`;
      } catch (fallbackError) {
        console.error(`[${timestamp}] Fallback Error:`, {
          message: fallbackError.message,
          stack: fallbackError.stack
        });
        
        prompt = `You are a ProSchool360 assistant. 

Original User Question: "${query}"

🌐 CRITICAL LANGUAGE INSTRUCTION:
- The user asked their question in a specific language
- You MUST respond COMPLETELY in the SAME LANGUAGE as the user's question
- DO NOT respond in English unless the user asked in English
- Detect the language and respond in that exact language

IMPORTANT INSTRUCTIONS:
1. AUTOMATICALLY detect the language of the original user question: "${query}"
2. Respond completely in that detected language (Hindi, Spanish, French, German, Arabic, Chinese, Japanese, etc.)
3. Use your knowledge of ProSchool360 features to provide helpful guidance in the user's language

ProSchool360 is a comprehensive school management system available at https://proschool360.com.

If this question is about ProSchool360 features like student management, teacher management, fees, attendance, exams, or other school operations, provide helpful guidance in the user's original language with:
- Step-by-step numbered instructions
- Navigation paths (skip branch-related fields)
- Relevant sidebar.php route links
- Practical examples

If this question is not related to ProSchool360 or school management, politely explain in the user's original language that you specialize in ProSchool360 assistance and suggest they ask about school management topics.`;
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
    
    console.log(`[${timestamp}] Response generated successfully`);
    res.json({ 
      reply,
      mode: chromaAvailable ? 'embedded_chromadb' : 'enhanced_corpus_search',
      suggestedUrls: ['https://proschool360.com'],
      analysis: {
        intent: res.locals.contextInfo?.analysis?.intent || 'general',
        category: res.locals.contextInfo?.analysis?.category || 'other',
        complexity: res.locals.contextInfo?.analysis?.complexity || 'medium',
        language: res.locals.contextInfo?.analysis?.language || 'English'
      },
      contextSource: res.locals.contextInfo?.source || 'fallback',
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
  
  // Also check if context contains ProSchool360 related content
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
    
    // Enhanced search with comprehensive keyword mapping from ChromaDB
    const searchTerms = query.toLowerCase().split(' ');
    const keywordMap = {
      // Student Management
      'student': ['student', 'admission', 'enrollment', 'register', 'enroll', 'applicant', 'pupil', 'learner', 'admissions', 'registration', 'student_id', 'roll_number', 'student_list', 'student_profile', 'student_details', 'student_information', 'student_record'],
      
      // Teacher & Staff Management
      'teacher': ['teacher', 'staff', 'employee', 'faculty', 'instructor', 'educator', 'professor', 'tutor', 'teaching_staff', 'academic_staff', 'teacher_profile', 'staff_management', 'employee_management', 'teacher_details'],
      
      // Fee Management
      'fee': ['fee', 'payment', 'invoice', 'billing', 'finance', 'fees', 'tuition', 'school_fee', 'fee_collection', 'fee_payment', 'fee_structure', 'fee_management', 'payment_gateway', 'online_payment', 'fee_receipt', 'fee_report', 'due_fees', 'fee_reminder', 'paypal', 'stripe', 'razorpay', 'paystack'],
      
      // Attendance System
      'attendance': ['attendance', 'present', 'absent', 'tracking', 'attendance_report', 'daily_attendance', 'attendance_management', 'attendance_record', 'attendance_sheet', 'student_attendance', 'teacher_attendance', 'attendance_summary'],
      
      // Examination System
      'exam': ['exam', 'test', 'result', 'grade', 'mark', 'examination', 'quiz', 'assessment', 'exam_result', 'grade_report', 'marksheet', 'exam_schedule', 'online_exam', 'exam_management', 'grading', 'marks', 'score', 'evaluation'],
      
      // Class & Academic Management
      'class': ['class', 'section', 'subject', 'timetable', 'classroom', 'academic', 'curriculum', 'syllabus', 'course', 'class_schedule', 'time_table', 'class_management', 'section_management', 'subject_management', 'academic_year', 'semester'],
      
      // Reports & Analytics
      'report': ['report', 'analytics', 'dashboard', 'summary', 'statistics', 'data', 'chart', 'graph', 'analysis', 'performance', 'academic_report', 'financial_report', 'attendance_report', 'student_report', 'teacher_report'],
      
      // Authentication & Access
      'login': ['login', 'authentication', 'access', 'password', 'signin', 'logout', 'user', 'account', 'profile', 'security', 'permission', 'role', 'admin', 'user_management', 'access_control'],
      
      // Communication & Messaging
      'communication': ['message', 'notification', 'sms', 'email', 'communication', 'alert', 'reminder', 'notice', 'announcement', 'messaging', 'parent_communication', 'bulk_sms', 'email_template'],
      
      // Library Management
      'library': ['library', 'book', 'issue', 'return', 'library_management', 'book_issue', 'book_return', 'library_card', 'book_catalog', 'library_report'],
      
      // Transport Management
      'transport': ['transport', 'bus', 'route', 'vehicle', 'driver', 'transport_management', 'bus_route', 'vehicle_management', 'transport_fee'],
      
      // Hostel Management
      'hostel': ['hostel', 'dormitory', 'room', 'hostel_management', 'room_allocation', 'hostel_fee', 'hostel_student'],
      
      // Accounting & Finance
      'accounting': ['accounting', 'expense', 'income', 'voucher', 'transaction', 'balance', 'financial', 'budget', 'account', 'ledger', 'office_accounting', 'expense_management', 'income_management'],
      
      // Homework & Assignments
      'homework': ['homework', 'assignment', 'task', 'project', 'homework_management', 'assignment_submission', 'homework_report'],
      
      // Events & Calendar
      'event': ['event', 'calendar', 'schedule', 'activity', 'program', 'event_management', 'school_event', 'academic_calendar'],
      
      // Certificate & Documents
      'certificate': ['certificate', 'document', 'transcript', 'diploma', 'certificate_generation', 'student_certificate', 'academic_certificate'],
      
      // Live Classes & Online Learning
      'live_class': ['live_class', 'online_class', 'virtual_class', 'zoom', 'meeting', 'online_learning', 'e_learning'],
      
      // Payroll & HR
      'payroll': ['payroll', 'salary', 'wage', 'payroll_management', 'salary_slip', 'employee_salary', 'staff_salary'],
      
      // Leave Management
      'leave': ['leave', 'holiday', 'vacation', 'leave_application', 'leave_management', 'leave_request', 'leave_approval'],
      
      // Settings & Configuration
      'settings': ['settings', 'configuration', 'setup', 'system_settings', 'school_settings', 'general_settings', 'application_settings'],
      
      // Branch & Multi-School
      'branch': ['branch', 'campus', 'location', 'multi_branch', 'branch_management', 'school_branch'],
      
      // Backup & System
      'backup': ['backup', 'restore', 'database', 'system_backup', 'data_backup', 'backup_management'],
      
      // Awards & Recognition
      'award': ['award', 'achievement', 'recognition', 'honor', 'prize', 'award_management', 'student_award'],
      
      // Custom Fields & System
      'custom_field': ['custom_field', 'field', 'form', 'custom_form', 'additional_field', 'extra_field'],
      
      // Modules & Add-ons
      'module': ['module', 'addon', 'plugin', 'extension', 'feature', 'functionality'],
      
      // API & Integration
      'api': ['api', 'integration', 'webhook', 'rest_api', 'web_service', 'third_party'],
      
      // Mobile App
      'mobile': ['mobile', 'app', 'android', 'ios', 'mobile_app', 'smartphone'],
      
      // Parent Portal
      'parent': ['parent', 'guardian', 'parent_portal', 'parent_access', 'parent_login', 'parent_dashboard']
    };
    
    // Find relevant modules based on query
    let relevantModules = [];
    for (const [module, keywords] of Object.entries(keywordMap)) {
      if (keywords.some(keyword => query.toLowerCase().includes(keyword))) {
        relevantModules.push(module);
      }
    }
    
    // Search for relevant files with enhanced filtering
    const relevantFiles = corpus.filter(file => {
      const content = file.content.toLowerCase();
      const path = file.path.toLowerCase();
      
      // Skip config and system files but keep important ones
      if (path.includes('.htaccess') || path.includes('index.html') || path.includes('cache/')) {
        return false;
      }
      
      // Prioritize controllers, views, models, and libraries
      const isRelevantFile = path.includes('controllers/') || path.includes('views/') || 
                            path.includes('models/') || path.includes('libraries/') ||
                            path.includes('config/') && !path.includes('cache/');
      
      // Enhanced search term matching
      const hasSearchTerms = searchTerms.some(term => {
        // Direct term matching
        if (content.includes(term) || path.includes(term)) return true;
        
        // Check for related keywords from all modules
        for (const [module, keywords] of Object.entries(keywordMap)) {
          if (keywords.includes(term)) {
            return keywords.some(keyword => content.includes(keyword) || path.includes(keyword));
          }
        }
        return false;
      });
      
      const hasRelevantModule = relevantModules.some(module => {
        const moduleKeywords = keywordMap[module] || [module];
        return moduleKeywords.some(keyword => 
          path.includes(keyword) || content.includes(keyword)
        );
      });
      
      // Include files that match search terms or relevant modules
      return isRelevantFile && (hasSearchTerms || hasRelevantModule || relevantModules.length === 0);
    }).slice(0, 15); // Increased to get more comprehensive results
    
    // Extract comprehensive information
    let contextInfo = 'ProSchool360 System Information:\n\n';
    
    if (relevantFiles.length > 0) {
      const moduleFeatures = {};
      
      relevantFiles.forEach(file => {
        const content = file.content;
        const path = file.path;
        
        // Extract module name from path
        const pathParts = path.split('/');
        let moduleName = 'General';
        
        if (pathParts.includes('controllers')) {
          const controllerIndex = pathParts.indexOf('controllers');
          if (controllerIndex + 1 < pathParts.length) {
            moduleName = pathParts[controllerIndex + 1].replace('.php', '');
          }
        }
        
        if (!moduleFeatures[moduleName]) {
          moduleFeatures[moduleName] = new Set();
        }
        
        // Extract comprehensive features and functions
        const functionMatches = content.match(/public function ([a-zA-Z_]+)/g) || [];
        const translateMatches = content.match(/translate\('([^']+)'\)/g) || [];
        const urlMatches = content.match(/base_url\('([^']+)'\)/g) || [];
        const classMatches = content.match(/class ([a-zA-Z_]+)/g) || [];
        const modelMatches = content.match(/\$this->load->model\('([^']+)'\)/g) || [];
        const libraryMatches = content.match(/\$this->load->library\('([^']+)'\)/g) || [];
        const dbTableMatches = content.match(/->get\('([a-zA-Z_]+)'\)/g) || [];
        const permissionMatches = content.match(/get_permission\('([^']+)'\)/g) || [];
        
        // Extract function names and convert to readable features
        functionMatches.forEach(match => {
          const funcName = match.replace('public function ', '').replace(/[^a-zA-Z_]/g, '');
          if (!funcName.startsWith('_') && funcName !== 'construct' && funcName !== 'index') {
            // Convert function names to readable features
            const readableFeature = funcName.replace(/_/g, ' ').toLowerCase();
            moduleFeatures[moduleName].add(`${readableFeature} management`);
          }
        });
        
        // Extract user-friendly labels from translate functions
        translateMatches.forEach(match => {
          const text = match.match(/'([^']+)'/)?.[1];
          if (text && text.length < 60 && !text.includes('_') && text.length > 3) {
            moduleFeatures[moduleName].add(text);
          }
        });
        
        // Extract permission-based features
        permissionMatches.forEach(match => {
          const permission = match.match(/'([^']+)'/)?.[1];
          if (permission && permission.length < 30) {
            moduleFeatures[moduleName].add(`${permission} operations`);
          }
        });
        
        // Extract database tables (indicates data management)
        dbTableMatches.forEach(match => {
          const table = match.match(/'([^']+)'/)?.[1];
          if (table && table.length < 25 && !table.includes('/')) {
            moduleFeatures[moduleName].add(`${table} data management`);
          }
        });
        
        // Extract models and libraries
        modelMatches.forEach(match => {
          const model = match.match(/'([^']+)'/)?.[1];
          if (model && model.includes('_model')) {
            const modelName = model.replace('_model', '').replace(/_/g, ' ');
            moduleFeatures[moduleName].add(`${modelName} data operations`);
          }
        });
        
        libraryMatches.forEach(match => {
          const library = match.match(/'([^']+)'/)?.[1];
          if (library && library.length < 25) {
            moduleFeatures[moduleName].add(`${library} integration`);
          }
        });
      });
      
      // Build context information
      for (const [module, features] of Object.entries(moduleFeatures)) {
        if (features.size > 0) {
          contextInfo += `📋 ${module.toUpperCase()} MODULE:\n`;
          const featureArray = Array.from(features).slice(0, 8);
          featureArray.forEach(feature => {
            contextInfo += `  • ${feature}\n`;
          });
          contextInfo += '\n';
        }
      }
    }
    
    // Add comprehensive ProSchool360 information
    contextInfo += `🏫 PROSCHOOL360 COMPREHENSIVE FEATURES:

📚 ACADEMIC MANAGEMENT:
  • Student Admission & Enrollment System
  • Class, Section & Subject Management
  • Academic Year & Semester Planning
  • Curriculum & Syllabus Management
  • Timetable & Schedule Generation
  • Online Examination System
  • Grade & Marksheet Management
  • Certificate Generation

👥 HUMAN RESOURCE MANAGEMENT:
  • Teacher & Staff Registration
  • Employee Profile Management
  • Payroll & Salary Management
  • Leave Management System
  • Attendance Tracking (Staff & Students)
  • Performance Evaluation
  • Award & Recognition System

💰 FINANCIAL MANAGEMENT:
  • Fee Structure & Collection
  • Online Payment Gateway Integration
  • Invoice & Receipt Generation
  • Expense & Income Tracking
  • Financial Reports & Analytics
  • Multi-currency Support
  • Payment Reminders & Notifications

📱 COMMUNICATION & ENGAGEMENT:
  • Parent Portal & Mobile App
  • SMS & Email Notifications
  • Bulk Messaging System
  • Event & Announcement Management
  • Parent-Teacher Communication
  • Student Progress Reports

🏢 ADMINISTRATIVE FEATURES:
  • Multi-branch School Support
  • Role-based Access Control
  • User Management & Permissions
  • System Settings & Configuration
  • Data Backup & Restore
  • Custom Fields & Forms
  • Module Management

📊 ADDITIONAL MODULES:
  • Library Management System
  • Transport & Bus Route Management
  • Hostel & Dormitory Management
  • Homework & Assignment Tracking
  • Live Class & Online Learning
  • Inventory & Asset Management
  • Health & Medical Records

🌐 TECHNICAL FEATURES:
  • Cloud-based SaaS Platform
  • REST API Integration
  • Mobile App Support (Android/iOS)
  • Multi-language Support
  • Advanced Security Features
  • Real-time Data Synchronization
  • Scalable Architecture

🔗 Access: https://proschool360.com
📱 Platform: Web, Android, iOS
🔒 Enterprise-grade Security & Reliability`;
    
    return contextInfo;
    
  } catch (error) {
    console.error('Error getting enhanced context:', error);
    // Return basic context even if file reading fails
    return `🏫 ProSchool360 - Complete School Management System

📍 Website: https://proschool360.com

✨ KEY FEATURES:
  • Student Management & Admission
  • Teacher & Staff Administration  
  • Fee Management & Billing
  • Attendance Tracking
  • Exam & Grade Management
  • Academic Reports & Analytics
  • Parent Communication Portal
  • Multi-branch Support

💡 ProSchool360 is a comprehensive solution that meets all school management needs.

For specific guidance on using ProSchool360 features, please ask about:
- How to add students
- How to take attendance
- How to manage fees
- How to create exams
- How to generate reports`;
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