const { ChromaClient } = require('chromadb');
const fs = require('fs');

async function buildChromaDB() {
  try {
    // Create ChromaDB client
    const client = new ChromaClient({
      path: './chroma_db'
    });

    // Delete existing collection if it exists
    try {
      await client.deleteCollection({ name: 'proschool360' });
    } catch (e) {
      // Collection doesn't exist, continue
    }

    // Create collection
    const collection = await client.createCollection({
      name: 'proschool360'
    });

    // Load JSON corpus
    const corpus = JSON.parse(fs.readFileSync('./proschool360_corpus.json', 'utf8'));
    
    console.log(`Loading ${corpus.length} documents...`);

    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < corpus.length; i += batchSize) {
      const batch = corpus.slice(i, i + batchSize);
      
      const documents = batch.map(item => item.content);
      const metadatas = batch.map(item => ({ path: item.path }));
      const ids = batch.map((_, idx) => `doc_${i + idx}`);

      await collection.add({
        documents,
        metadatas,
        ids
      });

      console.log(`Processed ${Math.min(i + batchSize, corpus.length)}/${corpus.length} documents`);
    }

    console.log('ChromaDB build complete!');
  } catch (error) {
    console.error('Error building ChromaDB:', error);
    process.exit(1);
  }
}

buildChromaDB();