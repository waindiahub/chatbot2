const { ChromaClient } = require('chromadb');
const fs = require('fs').promises;

async function populateChromaDB() {
  try {
    console.log('Starting ChromaDB population...');
    
    // Initialize ChromaDB client (try local server first)
    const client = new ChromaClient({ path: 'http://localhost:8000' });
    
    // Try to get or create collection
    let collection;
    try {
      collection = await client.getCollection({ name: 'proschool360' });
      console.log('Found existing collection');
      
      // Check if collection has data
      const count = await collection.count();
      console.log(`Collection has ${count} documents`);
      
      if (count > 0) {
        console.log('Collection already has data. Skipping population.');
        return;
      }
    } catch (error) {
      console.log('Creating new collection...');
      collection = await client.createCollection({ name: 'proschool360' });
    }
    
    // Read corpus data
    console.log('Reading corpus data...');
    const corpusData = JSON.parse(await fs.readFile('./proschool360_corpus.json', 'utf8'));
    console.log(`Found ${corpusData.length} documents in corpus`);
    
    // Prepare data for ChromaDB
    const documents = [];
    const metadatas = [];
    const ids = [];
    
    corpusData.forEach((item, index) => {
      if (item.content && item.content.trim().length > 50) { // Only add meaningful content
        documents.push(item.content);
        metadatas.push({
          path: item.path,
          type: item.path.includes('controllers/') ? 'controller' : 
                item.path.includes('views/') ? 'view' :
                item.path.includes('models/') ? 'model' : 'other'
        });
        ids.push(`doc_${index}`);
      }
    });
    
    console.log(`Preparing to add ${documents.length} documents to ChromaDB...`);
    
    // Add documents in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = {
        documents: documents.slice(i, i + batchSize),
        metadatas: metadatas.slice(i, i + batchSize),
        ids: ids.slice(i, i + batchSize)
      };
      
      await collection.add(batch);
      console.log(`Added batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(documents.length/batchSize)}`);
    }
    
    console.log('ChromaDB population completed successfully!');
    
    // Test query
    console.log('Testing query...');
    const results = await collection.query({
      queryTexts: ['attendance'],
      nResults: 3
    });
    
    console.log(`Test query returned ${results.documents[0].length} results`);
    
  } catch (error) {
    console.error('Error populating ChromaDB:', error);
  }
}

// Run if called directly
if (require.main === module) {
  populateChromaDB();
}

module.exports = { populateChromaDB };