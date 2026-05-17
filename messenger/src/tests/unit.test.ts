import { describe, expect, it, vi } from 'vitest';
import { UserService } from '../services/userService.js';
import { AttachmentService } from '../services/attachmentService.js';
import type { Db } from '../storage/database.js';

describe('Unit Tests: Business Logic', () => {
  describe('UserService', () => {
    it('TL-BL-1 (Positive): Should successfully create a user when a valid name is provided', () => {
      // Setup the mock Database
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(undefined), // Simulates user not found
          run: vi.fn(),                            // Simulates successful insert
        }),
      } as unknown as Db;

      const userService = new UserService(mockDb);
      const user = userService.create('Alice');

      expect(user).toBeDefined();
      expect(user.name).toBe('Alice');
      expect(typeof user.id).toBe('string');
      
      // Ensure DB methods were called properly
      expect(mockDb.prepare).toHaveBeenCalledTimes(2); 
    });

    it('TL-BL-2 (Negative): Should throw an error when attempting to create a user with an empty name', () => {
      // Mock DB isn't even used here as validation occurs before DB queries
      const mockDb = {} as Db; 
      const userService = new UserService(mockDb);

      expect(() => userService.create('')).toThrow('User name must not be empty.');
      expect(() => userService.create('   ')).toThrow('User name must not be empty.');
    });
  });
});

describe('Unit Tests: Auxiliary Tasks', () => {
  describe('AttachmentService', () => {
    it('TL-AUX-1 (Positive): Should successfully mark an uploaded attachment as SAFE', () => {
      // We need get() to return a pending attachment first, and then the updated SAFE attachment.
      const mockGet = vi.fn()
        .mockReturnValueOnce({ id: 'att-123', scanStatus: 'PENDING' }) // Initial check in markUploaded
        .mockReturnValueOnce({ id: 'att-123', scanStatus: 'SAFE' });    // Return value at the end of markUploaded
      const mockRun = vi.fn(); // Simulates the UPDATE query

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          get: mockGet,
          run: mockRun,
        }),
      } as unknown as Db;

      const attachmentService = new AttachmentService(mockDb);
      const updatedAttachment = attachmentService.markUploaded('att-123');

      expect(updatedAttachment.scanStatus).toBe('SAFE');
      expect(mockRun).toHaveBeenCalled(); // Ensure the UPDATE query was executed
    });

    it('TL-AUX-2 (Negative): Should throw an error when requesting an upload slot with an empty filename', () => {
      const mockDb = {} as Db;
      const attachmentService = new AttachmentService(mockDb);

      expect(() => 
        attachmentService.createUploadSlot('', 'image/jpeg', 1024, 'http://localhost')
      ).toThrow('Filename must not be empty.');
    });
  });
});
