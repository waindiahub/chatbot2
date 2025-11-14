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

    let prompt;
    
    if (chromaAvailable) {
      try {
        let documents = [];
        
        // Use embedded ChromaDB collection
        const chromaResults = await collection.query(query, 8);
        documents = chromaResults.documents[0] || [];
        
        if (documents.length === 0) {
          // If no documents found in ChromaDB, fall back to enhanced corpus search
          chromaAvailable = false;
        } else {
          const context = documents.slice(0, 8).join('\n\n');
          const suggestedUrls = chromaResults.suggestedUrls || ['https://proschool360.com'];
          
          // Detect if question is about ProSchool360
        const isProSchoolQuery = isProSchool360Query(query, context);
        const queryLanguage = detectLanguage(query);
        
        prompt = `You are a ProSchool360 expert assistant for the comprehensive school management system at https://proschool360.com.

ProSchool360 System Context:
${context}

User Question: ${query}
Query Language: ${queryLanguage}
Is ProSchool360 Related: ${isProSchoolQuery}

Provide detailed, knowledgeable answers about ProSchool360 based on the available data. Follow these guidelines:

🎯 RESPONSE STYLE:
- ALWAYS respond in the SAME LANGUAGE as the user's question
- Support ALL languages worldwide (Hindi, English, Spanish, French, German, Arabic, Chinese, Japanese, Korean, Russian, etc.)
- If asked in Hindi about ProSchool360, respond completely in Hindi
- If asked in Spanish about ProSchool360, respond completely in Spanish
- If asked in any other language about ProSchool360, respond in that language
- Provide step-by-step instructions when needed
- Focus on ProSchool360-specific features and capabilities
- Give practical examples and use cases

📋 CONTENT FOCUS:
- Explain navigation paths and menu locations (e.g., "Dashboard → Student Management → Add Student")
- Highlight required fields and important settings
- Share best practices and helpful tips
- Address common issues and their solutions

🚫 AVOID:
- Technical file paths or code references
- Controller names or database details
- Generic school management advice (stay ProSchool360-specific)

💡 HELPFUL ADDITIONS:
- Suggest related features
- Provide workflow tips
- Share time-saving shortcuts

🚫 IMPORTANT RESTRICTIONS:
- ONLY answer if the question is about ProSchool360 school management features
- If NOT about ProSchool360, politely redirect to ProSchool360 topics in the user's language
- ALWAYS respond in the same language as the user's question

🔗 IMPORTANT: Always end your response with these relevant ProSchool360 links:
**Relevant Links:**
${suggestedUrls.map(url => `• ${url}`).join('\n')}

Answer comprehensively based on the ProSchool360 system data provided to help users effectively use the system.`;
          
          // Store results for response
          res.locals.chromaResults = chromaResults;
        }
        

      } catch (error) {
        console.error('ChromaDB query failed:', error.message);
        chromaAvailable = false;
      }
    }
    
    if (!chromaAvailable) {
      // Enhanced fallback mode with better context
      try {
        console.log(`[${timestamp}] Using fallback mode - ChromaDB unavailable`);
        const contextInfo = await getEnhancedProSchool360Context(query);
        const detectedLanguage = detectLanguage(query);
        
        prompt = `You are an expert ProSchool360 assistant for the complete school management system at https://proschool360.com.

${contextInfo}

User Question: ${query}

🌐 LANGUAGE: Respond in the SAME language as the user's question. User asked in: ${detectedLanguage}

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
- Detail form fields and requirements
- Give workflow steps

💡 BEST PRACTICES:
- Efficient usage tips
- Common workflows
- Time-saving features
- Troubleshooting guidance

🚫 IMPORTANT: ALWAYS respond in the same language as the user's question (${detectedLanguage}).

Provide ProSchool360-specific and practical advice to help users effectively use the system.`;
      } catch (fallbackError) {
        console.error(`[${timestamp}] Fallback Error:`, {
          message: fallbackError.message,
          stack: fallbackError.stack
        });
        
        const detectedLanguage = detectLanguage(query);
        prompt = `You are a ProSchool360 assistant. The user asked: "${query}"

🌐 LANGUAGE: Respond in ${detectedLanguage} (same as user's question)

ProSchool360 is a comprehensive school management system available at https://proschool360.com.

If this question is about ProSchool360 features like student management, teacher management, fees, attendance, exams, or other school operations, provide helpful guidance in ${detectedLanguage}.

If this question is not related to ProSchool360 or school management, politely explain in ${detectedLanguage} that you specialize in ProSchool360 assistance and suggest they ask about school management topics.`;
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
      suggestedUrls: res.locals.chromaResults ? res.locals.chromaResults.suggestedUrls : ['https://proschool360.com'],
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

// Enhanced language detection for worldwide support
function detectLanguage(query) {
  try {
    // Unicode ranges for different scripts
    const scriptRanges = {
      'Hindi': /[\u0900-\u097F]/,
      'Arabic': /[\u0600-\u06FF]/,
      'Chinese': /[\u4e00-\u9fff]/,
      'Japanese': /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/,
      'Korean': /[\uac00-\ud7af]/,
      'Russian': /[\u0400-\u04FF]/,
      'Greek': /[\u0370-\u03FF]/,
      'Thai': /[\u0e00-\u0e7f]/,
      'Bengali': /[\u0980-\u09FF]/,
      'Tamil': /[\u0B80-\u0BFF]/,
      'Telugu': /[\u0C00-\u0C7F]/,
      'Gujarati': /[\u0A80-\u0AFF]/,
      'Punjabi': /[\u0A00-\u0A7F]/,
      'Malayalam': /[\u0D00-\u0D7F]/,
      'Kannada': /[\u0C80-\u0CFF]/,
      'Oriya': /[\u0B00-\u0B7F]/,
      'Urdu': /[\u0600-\u06FF]/,
      'Persian': /[\u0600-\u06FF]/,
      'Hebrew': /[\u0590-\u05FF]/,
      'Vietnamese': /[\u1EA0-\u1EF9]/
    };
    
    // Check for specific script patterns
    for (const [language, pattern] of Object.entries(scriptRanges)) {
      if (pattern.test(query)) {
        return language;
      }
    }
    
    // Common words detection for major languages
    const languageKeywords = {
      'Hindi': ['कैसे', 'क्या', 'कहाँ', 'कब', 'क्यों', 'में', 'का', 'की', 'के', 'है', 'हैं', 'था', 'थी', 'थे', 'होगा', 'होगी', 'होंगे', 'छात्र', 'विद्यार्थी', 'स्कूल', 'शिक्षक', 'फीस'],
      'Spanish': ['cómo', 'qué', 'dónde', 'cuándo', 'por qué', 'estudiante', 'profesor', 'escuela', 'clase', 'examen'],
      'French': ['comment', 'quoi', 'où', 'quand', 'pourquoi', 'étudiant', 'professeur', 'école', 'classe', 'examen'],
      'German': ['wie', 'was', 'wo', 'wann', 'warum', 'student', 'lehrer', 'schule', 'klasse', 'prüfung'],
      'Portuguese': ['como', 'que', 'onde', 'quando', 'por que', 'estudante', 'professor', 'escola', 'classe', 'exame'],
      'Italian': ['come', 'cosa', 'dove', 'quando', 'perché', 'studente', 'insegnante', 'scuola', 'classe', 'esame'],
      'Russian': ['как', 'что', 'где', 'когда', 'почему', 'студент', 'учитель', 'школа', 'класс', 'экзамен'],
      'Japanese': ['どう', 'なに', 'どこ', 'いつ', 'なぜ', '学生', '先生', '学校', 'クラス', '試験'],
      'Korean': ['어떻게', '무엇', '어디', '언제', '왜', '학생', '선생님', '학교', '수업', '시험'],
      'Arabic': ['كيف', 'ماذا', 'أين', 'متى', 'لماذا', 'طالب', 'معلم', 'مدرسة', 'فصل', 'امتحان']
    };
    
    const queryLower = query.toLowerCase();
    
    // Check for language-specific keywords
    for (const [language, keywords] of Object.entries(languageKeywords)) {
      if (keywords.some(keyword => queryLower.includes(keyword.toLowerCase()))) {
        return language;
      }
    }
    
    // Default to English if no specific language detected
    return 'English';
  } catch (error) {
    console.error('Language detection error:', error.message);
    return 'English';
  }
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