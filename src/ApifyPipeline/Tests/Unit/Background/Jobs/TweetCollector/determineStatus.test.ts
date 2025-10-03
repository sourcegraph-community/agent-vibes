import { describe, it, expect } from 'vitest';

const determineStatus = (newCount: number, errors: unknown[]):
  | 'succeeded'
  | 'partial_success'
  | 'failed' => {
  if (errors.length === 0) {
    return 'succeeded';
  }

  if (newCount > 0) {
    return 'partial_success';
  }

  return 'failed';
};

describe('determineStatus', () => {
  describe('succeeded status', () => {
    it('should return succeeded when no errors and tweets collected', () => {
      const result = determineStatus(10, []);
      expect(result).toBe('succeeded');
    });

    it('should return succeeded when no errors and zero tweets', () => {
      const result = determineStatus(0, []);
      expect(result).toBe('succeeded');
    });

    it('should return succeeded when no errors and many tweets', () => {
      const result = determineStatus(1000, []);
      expect(result).toBe('succeeded');
    });
  });

  describe('partial_success status', () => {
    it('should return partial_success when errors exist but tweets collected', () => {
      const errors = [{ error: 'Some error' }];
      const result = determineStatus(5, errors);
      expect(result).toBe('partial_success');
    });

    it('should return partial_success with single tweet and errors', () => {
      const errors = [{ error: 'Error 1' }, { error: 'Error 2' }];
      const result = determineStatus(1, errors);
      expect(result).toBe('partial_success');
    });

    it('should return partial_success with many tweets and few errors', () => {
      const errors = [{ error: 'Minor error' }];
      const result = determineStatus(100, errors);
      expect(result).toBe('partial_success');
    });

    it('should return partial_success with few tweets and many errors', () => {
      const errors = Array.from({ length: 50 }, (_, i) => ({ error: `Error ${i}` }));
      const result = determineStatus(2, errors);
      expect(result).toBe('partial_success');
    });
  });

  describe('failed status', () => {
    it('should return failed when errors exist and no tweets collected', () => {
      const errors = [{ error: 'Fatal error' }];
      const result = determineStatus(0, errors);
      expect(result).toBe('failed');
    });

    it('should return failed with single error and no tweets', () => {
      const errors = [{ error: 'Database connection failed' }];
      const result = determineStatus(0, errors);
      expect(result).toBe('failed');
    });

    it('should return failed with multiple errors and no tweets', () => {
      const errors = [
        { error: 'Error 1' },
        { error: 'Error 2' },
        { error: 'Error 3' },
      ];
      const result = determineStatus(0, errors);
      expect(result).toBe('failed');
    });
  });

  describe('edge cases', () => {
    it('should handle negative tweet count as failed', () => {
      const errors = [{ error: 'Some error' }];
      const result = determineStatus(-1, errors);
      expect(result).toBe('failed');
    });

    it('should handle empty errors array correctly', () => {
      const result = determineStatus(0, []);
      expect(result).toBe('succeeded');
    });

    it('should handle various error object types', () => {
      const errors = [
        new Error('Error 1'),
        'String error',
        { message: 'Object error' },
        null,
        undefined,
      ];
      const result = determineStatus(0, errors);
      expect(result).toBe('failed');
    });
  });

  describe('business logic validation', () => {
    it('should prioritize success when no errors regardless of count', () => {
      expect(determineStatus(0, [])).toBe('succeeded');
      expect(determineStatus(1, [])).toBe('succeeded');
      expect(determineStatus(1000, [])).toBe('succeeded');
    });

    it('should ensure partial success requires both errors and tweets', () => {
      expect(determineStatus(1, [{ error: 'err' }])).toBe('partial_success');
      expect(determineStatus(0, [{ error: 'err' }])).not.toBe('partial_success');
      expect(determineStatus(1, [])).not.toBe('partial_success');
    });

    it('should ensure failed requires errors and no tweets', () => {
      expect(determineStatus(0, [{ error: 'err' }])).toBe('failed');
      expect(determineStatus(1, [{ error: 'err' }])).not.toBe('failed');
      expect(determineStatus(0, [])).not.toBe('failed');
    });
  });
});
