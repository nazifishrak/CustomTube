import numpy as np
from gensim.downloader import load
import json

def create_minimal_vectors():

    print("Loading word vectors...")
    words = load('glove-twitter-25')  
    

    categories = {
        'entertainment': [
            'movie', 'film', 'music', 'game', 'play', 'fun', 'dance', 'sing',
            'concert', 'theater', 'show', 'series', 'comedy', 'drama', 'art',
            'entertainment', 'performance', 'actor', 'actress', 'celebrity'
        ],
        'technology': [
            'tech', 'computer', 'software', 'programming', 'code', 'developer',
            'digital', 'internet', 'app', 'gadget', 'hardware', 'AI', 'data',
            'robot', 'smart', 'device', 'innovation', 'engineering', 'science'
        ],
        'education': [
            'learn', 'study', 'teach', 'school', 'university', 'college',
            'education', 'course', 'tutorial', 'guide', 'lesson', 'lecture',
            'professor', 'student', 'academic', 'research', 'knowledge'
        ],
        'gaming': [
            'game', 'gaming', 'playthrough', 'walkthrough', 'stream', 'console',
            'player', 'minecraft', 'fortnite', 'gameplay', 'gamer', 'esports',
            'nintendo', 'xbox', 'playstation', 'multiplayer', 'rpg'
        ],
        'sports': [
            'sports', 'football', 'basketball', 'soccer', 'baseball', 'tennis',
            'game', 'match', 'player', 'team', 'score', 'win', 'championship',
            'league', 'athlete', 'fitness', 'workout', 'exercise'
        ]
    }
    
    # Collect all relevant words
    relevant_words = set()
    for category_words in categories.values():
        relevant_words.update(category_words)
    
    # Add common YouTube-specific words
    youtube_words = [
        'video', 'channel', 'subscribe', 'like', 'comment', 'watch',
        'youtube', 'live', 'stream', 'vlog', 'review', 'tutorial',
        'reaction', 'compilation', 'viral', 'trending'
    ]
    relevant_words.update(youtube_words)
    
    # Create vectors dictionary
    vectors = {}
    for word in relevant_words:
        try:
            if word in words:
                # Convert vector to list and round to 6 decimal places to reduce size
                vectors[word] = [round(float(x), 6) for x in words[word]]
        except KeyError:
            continue
    
    print(f"Created vectors for {len(vectors)} words")
    

    with open('word_vectors_mini.json', 'w') as f:
        json.dump(vectors, f)
    
    print("Word vectors saved to word_vectors_mini.json")
    

    import os
    size_kb = os.path.getsize('word_vectors_mini.json') / 1024
    print(f"File size: {size_kb:.2f} KB")

if __name__ == '__main__':
    create_minimal_vectors()