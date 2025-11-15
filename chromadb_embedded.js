const fs = require('fs').promises;
const path = require('path');

class EmbeddedChromaDB {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.corpus = null;
    this.embeddings = new Map();
  }

  async initialize() {
    try {
      // Load corpus data
      const corpusPath = path.join(process.cwd(), 'proschool360_corpus.json');
      const corpusData = await fs.readFile(corpusPath, 'utf8');
      this.corpus = JSON.parse(corpusData);
      
      console.log(`📚 Loaded ${this.corpus.length} documents from corpus`);
      
      // Create simple embeddings based on keywords
      this.createKeywordEmbeddings();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize embedded ChromaDB:', error.message);
      return false;
    }
  }

  createKeywordEmbeddings() {
    const keywordMap = {
      'student': ['student', 'admission', 'enrollment', 'register', 'enroll', 'applicant'],
      'teacher': ['teacher', 'staff', 'employee', 'faculty', 'instructor'],
      'fee': ['fee', 'payment', 'invoice', 'billing', 'finance', 'fees'],
      'attendance': ['attendance', 'present', 'absent', 'tracking'],
      'exam': ['exam', 'test', 'result', 'grade', 'mark', 'examination'],
      'class': ['class', 'section', 'subject', 'timetable', 'classroom'],
      'report': ['report', 'analytics', 'dashboard', 'summary'],
      'login': ['login', 'authentication', 'access', 'password'],
    };

    this.corpus.forEach((doc, index) => {
      const content = doc.content.toLowerCase();
      const path = doc.path.toLowerCase();
      
      // Calculate relevance scores for each keyword category
      const scores = {};
      for (const [category, keywords] of Object.entries(keywordMap)) {
        scores[category] = keywords.reduce((score, keyword) => {
          const contentMatches = (content.match(new RegExp(keyword, 'g')) || []).length;
          const pathMatches = (path.match(new RegExp(keyword, 'g')) || []).length;
          return score + contentMatches + (pathMatches * 2); // Path matches weighted higher
        }, 0);
      }
      
      this.embeddings.set(index, scores);
    });
  }

  async query(queryText, nResults = 8) {
    if (!this.corpus) {
      throw new Error('ChromaDB not initialized');
    }

    if (!queryText || typeof queryText !== 'string' || queryText.trim().length === 0) {
      return {
        documents: [[]],
        metadatas: [[]],
        distances: [[]],
        ids: [[]],
        suggestedUrls: ['https://proschool360.com']
      };
    }

    const queryLower = queryText.toLowerCase();
    const queryTerms = queryLower.split(' ').filter(term => term.length > 0);
    
    // Calculate similarity scores
    const results = [];
    
    this.corpus.forEach((doc, index) => {
      const embedding = this.embeddings.get(index);
      let score = 0;
      
      // Direct text matching
      const content = doc.content.toLowerCase();
      const path = doc.path.toLowerCase();
      
      queryTerms.forEach(term => {
        if (content.includes(term)) score += 2;
        if (path.includes(term)) score += 3;
      });
      
      // Keyword category matching
      for (const [category, categoryScore] of Object.entries(embedding)) {
        if (queryLower.includes(category)) {
          score += categoryScore * 0.5;
        }
      }
      
      if (score > 0) {
        results.push({
          document: doc.content,
          metadata: { path: doc.path, type: this.getFileType(doc.path) },
          score: score,
          index: index
        });
      }
    });
    
    // Sort by score and return top results
    results.sort((a, b) => b.score - a.score);
    
    const topResults = results.slice(0, nResults);
    
    return {
      documents: [topResults.map(r => r.document)],
      metadatas: [topResults.map(r => r.metadata)],
      distances: [topResults.map(r => 1 / (1 + r.score))], // Convert score to distance
      ids: [topResults.map(r => `doc_${r.index}`)]
    };
  }

  getFileType(filePath) {
    if (filePath.includes('controllers/')) return 'controller';
    if (filePath.includes('views/')) return 'view';
    if (filePath.includes('models/')) return 'model';
    if (filePath.includes('libraries/')) return 'library';
    return 'other';
  }

  async count() {
    return this.corpus ? this.corpus.length : 0;
  }

  async addDocuments(documents) {
    if (!this.corpus) {
      throw new Error('ChromaDB not initialized');
    }

    try {
      // Add new documents to corpus
      documents.forEach(doc => {
        const newDoc = {
          path: doc.id || `training_${Date.now()}`,
          content: doc.content
        };
        this.corpus.push(newDoc);
      });

      // Recreate embeddings with new documents
      this.createKeywordEmbeddings();

      // Save updated corpus to training file
      const trainingCorpusPath = path.join(process.cwd(), 'training_corpus.json');
      await fs.writeFile(trainingCorpusPath, JSON.stringify(this.corpus, null, 2));

      console.log(`Added ${documents.length} documents to embedded ChromaDB`);
      return true;
    } catch (error) {
      console.error('Error adding documents to ChromaDB:', error.message);
      return false;
    }
  }
}

module.exports = EmbeddedChromaDB;