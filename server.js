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
        let documents = [];
        
        // Use embedded ChromaDB collection
        const results = await collection.query(query, 8);
        documents = results.documents[0] || [];
        
        if (documents.length === 0) {
          // If no documents found in ChromaDB, fall back to enhanced corpus search
          chromaAvailable = false;
        } else {
          const context = documents.slice(0, 8).join('\n\n');
          prompt = `You are a ProSchool360 expert assistant for the comprehensive school management system at https://proschool360.com.

ProSchool360 System Context:
${context}

User Question: ${query}

Provide detailed, knowledgeable answers about ProSchool360 based on the available data. Follow these guidelines:

🎯 RESPONSE STYLE:
- Always respond in friendly, professional English
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

Answer comprehensively based on the ProSchool360 system data provided to help users effectively use the system.`;
        }
        

      } catch (error) {
        console.error('ChromaDB query failed:', error.message);
        chromaAvailable = false;
      }
    }
    
    if (!chromaAvailable) {
      // Enhanced fallback mode with better context
      const contextInfo = await getEnhancedProSchool360Context(query);
      prompt = `You are an expert ProSchool360 assistant for the complete school management system at https://proschool360.com.

${contextInfo}

User Question: ${query}

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

Provide ProSchool360-specific and practical advice to help users effectively use the system.`;
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
      mode: chromaAvailable ? 'embedded_chromadb' : 'enhanced_corpus_search'
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

💡 ProSchool360 is a comprehensive solution that meets all school management needs.`;
  }
}

// Initialize ChromaDB and start server
initChroma().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});