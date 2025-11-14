# 🎓 ProSchool360 AI Assistant

एक advanced chatbot system जो आपके ProSchool360 codebase को index करता है और ChromaDB + Gemini AI का उपयोग करके intelligent, user-friendly responses देता है।

## ✨ Key Features

- 🧠 **Intelligent Responses**: ChromaDB-powered context-aware answers
- 🌐 **Bilingual Support**: Hindi और English दोनों में responses
- 📚 **ProSchool360 Expert**: Complete school management system knowledge
- 🎯 **User-Friendly**: Technical details को avoid करके practical guidance देता है
- 🚀 **Fast & Reliable**: Embedded ChromaDB for quick responses
- 📱 **Modern UI**: Beautiful, responsive chat interface

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and add your Gemini API key:
```bash
cp .env.example .env
```

Edit `.env` file:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=3000
```

### 3. Start the Server
```bash
# For production
npm start

# For development (with auto-reload)
npm run dev
```

### 4. Access the Chatbot

#### Web Interface
Open your browser and go to:
```
http://localhost:3000
```

#### API Testing
```bash
# Test the API endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "How to add new student in ProSchool360?"}'
```

#### Health Check
```bash
curl http://localhost:3000/health
```

## 📁 File Structure
```
chatbot2/
├── server.js                    # Main Node.js server with enhanced AI
├── package.json                 # Node.js dependencies
├── index.html                   # Beautiful chat interface
├── .env.example                 # Environment configuration template
├── README.md                    # This documentation
├── proschool360_corpus.json     # ProSchool360 knowledge base
├── chroma_db/                   # Embedded ChromaDB database
├── .gitignore                   # Git ignore rules
├── Procfile                     # Deployment configuration
└── render.yaml                  # Render deployment config
```

## 🎯 Enhanced Features

### Intelligent Response System
- **Context-Aware**: ChromaDB से relevant ProSchool360 content retrieve करता है
- **User-Friendly**: Technical jargon avoid करके practical guidance देता है
- **Bilingual**: Hindi और English दोनों में natural responses
- **Module-Specific**: Student, Teacher, Fee, Attendance आदि modules के लिए specialized knowledge

### Advanced Query Processing
- **Smart Keyword Mapping**: Query को relevant modules से match करता है
- **Enhanced Context Extraction**: Controllers और views से meaningful information extract करता है
- **Fallback Intelligence**: ChromaDB unavailable होने पर भी comprehensive responses देता है

### Modern Chat Interface
- **Responsive Design**: Mobile और desktop दोनों के लिए optimized
- **Real-time Typing Indicators**: Professional chat experience
- **Quick Suggestions**: Common queries के लिए ready-made buttons
- **Beautiful UI**: Modern gradient design with smooth animations

## 🔧 Troubleshooting

### Common Issues

**Server not starting:**
```bash
# Check if port is available
netstat -tulpn | grep :3000

# Kill process if needed
kill -9 $(lsof -t -i:3000)
```

**ChromaDB errors:**
- Ensure `chroma_db/` folder exists and has proper permissions
- Check if `proschool360_corpus.json` is present and valid

**API key issues:**
- Verify your Gemini API key in `.env` file
- Check API key permissions and quotas

**Memory issues:**
- Reduce ChromaDB query results from 8 to 5 in server.js
- Monitor server memory usage

### Performance Tips

1. **For better responses**: Ensure ChromaDB is working properly
2. **For faster startup**: Keep corpus file optimized
3. **For production**: Set `NODE_ENV=production` in `.env`

## 🚀 Deployment

### Render Deployment
The project is configured for easy Render deployment:

1. Connect your GitHub repository to Render
2. Set environment variables in Render dashboard
3. Deploy automatically with included `render.yaml`

### Environment Variables
```env
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
NODE_ENV=production
```

## 🤝 Contributing

To improve the chatbot:

1. **Add more context**: Update `getEnhancedProSchool360Context()` function
2. **Improve responses**: Modify the prompt engineering in `/api/chat` endpoint
3. **Add features**: Extend the UI in `index.html`
4. **Optimize performance**: Enhance ChromaDB queries

## 🎨 Screenshots

### Chat Interface
The modern, responsive chat interface provides:
- Clean, professional design
- Bilingual support (Hindi/English)
- Real-time typing indicators
- Quick suggestion chips
- Mobile-friendly responsive layout

### AI Responses
The enhanced AI provides:
- ProSchool360-specific guidance
- Step-by-step instructions
- Module-wise feature explanations
- User-friendly language (no technical jargon)
- Contextual help based on actual codebase

## 📞 Support

For ProSchool360 related queries, visit: https://proschool360.com

---

**Made with ❤️ for ProSchool360 users**