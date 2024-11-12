class SemanticClassifier {
    constructor() {
        this.categoryVectors = {
          entertainment: {
            vector: new Float32Array(50),
            keywords: ['movie', 'film', 'music', 'game', 'play', 'fun', 'dance', 'sing',
              'concert', 'theater', 'show', 'series', 'comedy', 'drama', 'art',
              'entertainment', 'performance', 'actor', 'actress', 'celebrity']
          },
          politics: {
            vector: new Float32Array(50),
            keywords: ['politics', 'election', 'senate', 'government', 'policy', 'debate',
              'campaign', 'law', 'vote', 'congress', 'minister', 'president', 'democracy',
              'party', 'politician', 'bill', 'legislation', 'political']
          },
          technology: {
            vector: new Float32Array(50),
            keywords: ['tech', 'computer', 'software', 'programming', 'code', 'developer',
              'digital', 'internet', 'app', 'gadget', 'hardware', 'AI', 'data',
              'robot', 'smart', 'device', 'innovation', 'engineering', 'science']
          },
          sports: {
            vector: new Float32Array(50),
            keywords: ['sports', 'football', 'basketball', 'soccer', 'baseball', 'tennis',
              'game', 'match', 'player', 'team', 'score', 'win', 'championship',
              'league', 'athlete', 'fitness', 'workout', 'exercise']
          },
          gaming: {
            vector: new Float32Array(50),
            keywords: ['game', 'gaming', 'playthrough', 'walkthrough', 'stream', 'console',
              'player', 'minecraft', 'fortnite', 'gameplay', 'gamer', 'esports',
              'nintendo', 'xbox', 'playstation', 'multiplayer', 'rpg']
          },
          education: {
            vector: new Float32Array(50),
            keywords: ['learn', 'study', 'teach', 'school', 'university', 'college',
              'education', 'course', 'tutorial', 'guide', 'lesson', 'lecture',
              'professor', 'student', 'academic', 'research', 'knowledge']
          }
        };
        this.wordVectors = new Map();
        this.ready = false;
      }
  
    async init() {
      await this.loadWordVectors();
      this.ready = true;
    }
  
    async loadWordVectors() {
      try {
        const response = await fetch(chrome.runtime.getURL('word_vectors_mini.json'));
        const vectors = await response.json();
        
        for (const [word, vector] of Object.entries(vectors)) {
          this.wordVectors.set(word, new Float32Array(vector));
        }
  
        // Pre-compute category vectors
        for (const category of Object.keys(this.categoryVectors)) {
          this.categoryVectors[category].vector = this.computeCategoryVector(category);
        }
  
        console.log('Semantic classifier initialized with', this.wordVectors.size, 'words');
      } catch (error) {
        console.error('Error loading word vectors:', error);
      }
    }
  
    computeCategoryVector(category) {
      const keywords = this.categoryVectors[category].keywords;
      const vector = new Float32Array(50).fill(0);
      let count = 0;
  
      for (const word of keywords) {
        if (this.wordVectors.has(word)) {
          const wordVector = this.wordVectors.get(word);
          for (let i = 0; i < vector.length; i++) {
            vector[i] += wordVector[i];
          }
          count++;
        }
      }
  
      if (count > 0) {
        for (let i = 0; i < vector.length; i++) {
          vector[i] /= count;
        }
      }
  
      return vector;
    }
  
    computeTextVector(text) {
      const words = text.toLowerCase().split(/\W+/);
      const vector = new Float32Array(50).fill(0);
      let count = 0;
  
      for (const word of words) {
        if (this.wordVectors.has(word)) {
          const wordVector = this.wordVectors.get(word);
          for (let i = 0; i < vector.length; i++) {
            vector[i] += wordVector[i];
          }
          count++;
        }
      }
  
      if (count > 0) {
        for (let i = 0; i < vector.length; i++) {
          vector[i] /= count;
        }
      }
  
      return vector;
    }
  
    cosineSimilarity(vecA, vecB) {
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
  
      for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
      }
  
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
  
    classifyContent(text, threshold = 0.6) {
      if (!this.ready) {
        console.warn('Classifier not ready yet');
        return [];
      }
  
      const textVector = this.computeTextVector(text);
      const classifications = [];
  
      for (const [category, data] of Object.entries(this.categoryVectors)) {
        const similarity = this.cosineSimilarity(textVector, data.vector);
        if (similarity >= threshold) {
          classifications.push({
            category,
            confidence: similarity
          });
        }
      }
  
      return classifications.sort((a, b) => b.confidence - a.confidence);
    }
  }