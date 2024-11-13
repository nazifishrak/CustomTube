class SemanticClassifier {
  constructor() {
    this.debug = true;  // Enable debug logging
    this.categoryVectors = {
      entertainment: {
        vector: new Float32Array(50),
        keywords: ['movie', 'film', 'music', 'game', 'play', 'fun', 'dance', 'sing',
          'concert', 'theater', 'show', 'series', 'comedy', 'drama', 'art',
          'entertainment', 'performance', 'actor', 'actress', 'celebrity']
      },
      politics: {
        vector: new Float32Array(50),
        keywords: [
          'politics', 'election', 'senate', 'government', 'policy', 'debate',
          'campaign', 'law', 'vote', 'congress', 'minister', 'president',
          'democracy', 'party', 'politician', 'bill', 'legislation', 'political',
          'trump', 'biden', 'republican', 'democrat', 'conservative', 'liberal',
          'election', 'musk', 'elon', 'news', 'breaking', 'fox', 'cnn', 'media'
        ],
        // Add explicit word matches for higher accuracy
        exactMatches: ['trump', 'biden', 'musk', 'elon']
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
    if (this.debug) {
      console.log('Classifier initialized with word vectors:', this.wordVectors.size);
    }
  }

  classifyContent(text, threshold = 0.6) {
    if (!this.ready) {
      console.warn('Classifier not ready yet');
      return [];
    }

    const textLower = text.toLowerCase();
    const classifications = [];

    for (const [category, data] of Object.entries(this.categoryVectors)) {
      // Check for exact matches first
      const hasExactMatch = data.exactMatches?.some(word =>
          textLower.includes(word.toLowerCase())
      );

      if (hasExactMatch) {
        classifications.push({
          category,
          confidence: 0.95,  // High confidence for exact matches
          matchType: 'exact'
        });
        if (this.debug) {
          console.log(`Exact match found for ${category} in text:`, text);
        }
        continue;
      }

      // Perform vector-based classification
      const textVector = this.computeTextVector(text);
      const similarity = this.cosineSimilarity(textVector, data.vector);

      if (similarity >= threshold) {
        classifications.push({
          category,
          confidence: similarity,
          matchType: 'vector'
        });
        if (this.debug) {
          console.log(`Vector match found for ${category} with confidence ${similarity}:`, text);
        }
      }
    }

    if (this.debug && classifications.length > 0) {
      console.log('Classifications for text:', text);
      console.log('Results:', classifications);
    }

    return classifications.sort((a, b) => b.confidence - a.confidence);
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

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return isNaN(similarity) ? 0 : similarity;
  }
}