import { describe, it, expect } from 'vitest';
import { buildSentimentPrompt, SENTIMENT_LABELS } from '../../../../ExternalServices/Gemini/promptTemplate';

describe('promptTemplate', () => {
  describe('buildSentimentPrompt', () => {
    it('should build a basic prompt with just content', () => {
      const prompt = buildSentimentPrompt({
        content: 'This coding agent is amazing!',
      });

      expect(prompt).toContain('This coding agent is amazing!');
      expect(prompt).toContain('positive');
      expect(prompt).toContain('neutral');
      expect(prompt).toContain('negative');
      expect(prompt).toContain('JSON');
    });

    it('should include author handle when provided', () => {
      const prompt = buildSentimentPrompt({
        content: 'Great tool',
        authorHandle: 'testuser',
      });

      expect(prompt).toContain('@testuser');
    });

    it('should include language when provided', () => {
      const prompt = buildSentimentPrompt({
        content: 'Excellent',
        language: 'en',
      });

      expect(prompt).toContain('Language: en');
    });

    it('should include all context fields', () => {
      const prompt = buildSentimentPrompt({
        content: 'Testing all fields',
        authorHandle: 'developer',
        language: 'en',
      });

      expect(prompt).toContain('Testing all fields');
      expect(prompt).toContain('@developer');
      expect(prompt).toContain('Language: en');
    });
  });

  describe('SENTIMENT_LABELS', () => {
    it('should contain exactly three labels', () => {
      expect(SENTIMENT_LABELS).toHaveLength(3);
    });

    it('should contain the correct labels', () => {
      expect(SENTIMENT_LABELS).toEqual(['positive', 'neutral', 'negative']);
    });
  });
});
