// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServerSandboxService } from './index';

// Mock debug
vi.mock('debug', () => ({
  default: vi.fn(() => vi.fn()),
}));

// Mock js-sha256
vi.mock('js-sha256', () => ({
  sha256: vi.fn(() => 'mock-hash'),
}));

// Mock FileS3
vi.mock('@/server/modules/S3', () => ({
  FileS3: vi.fn().mockImplementation(() => ({
    createPreSignedUrl: vi.fn(),
    getFileMetadata: vi.fn(),
  })),
}));

const createMockFileService = () => ({
  createFileRecord: vi.fn(),
});

const createMockMarketService = () => ({
  getSDK: vi.fn(),
  exportFile: vi.fn(),
});

describe('ServerSandboxService', () => {
  let fileService: ReturnType<typeof createMockFileService>;
  let marketService: ReturnType<typeof createMockMarketService>;
  let service: ServerSandboxService;

  beforeEach(() => {
    vi.clearAllMocks();
    fileService = createMockFileService();
    marketService = createMockMarketService();
    service = new ServerSandboxService({
      fileService: fileService as any,
      marketService: marketService as any,
      topicId: 'test-topic-id',
      userId: 'test-user-id',
    });
  });

  describe('callTool', () => {
    it('should call the sandbox tool via marketService and return success result', async () => {
      const mockSDK = {
        plugins: {
          runBuildInTool: vi.fn().mockResolvedValue({
            success: true,
            data: {
              result: { output: 'Hello, World!' },
              sessionExpiredAndRecreated: false,
            },
          }),
        },
      };
      marketService.getSDK.mockReturnValue(mockSDK);

      const result = await service.callTool('python_interpreter', { code: 'print("Hello")' });

      expect(result).toEqual({
        result: { output: 'Hello, World!' },
        sessionExpiredAndRecreated: false,
        success: true,
      });
      expect(mockSDK.plugins.runBuildInTool).toHaveBeenCalledWith(
        'python_interpreter',
        { code: 'print("Hello")' },
        { topicId: 'test-topic-id', userId: 'test-user-id' },
      );
    });

    it('should return success result with sessionExpiredAndRecreated=true when session was recreated', async () => {
      const mockSDK = {
        plugins: {
          runBuildInTool: vi.fn().mockResolvedValue({
            success: true,
            data: {
              result: { output: 'result' },
              sessionExpiredAndRecreated: true,
            },
          }),
        },
      };
      marketService.getSDK.mockReturnValue(mockSDK);

      const result = await service.callTool('python_interpreter', {});

      expect(result.success).toBe(true);
      expect(result.sessionExpiredAndRecreated).toBe(true);
    });

    it('should return error result when tool response indicates failure', async () => {
      const mockSDK = {
        plugins: {
          runBuildInTool: vi.fn().mockResolvedValue({
            success: false,
            error: {
              message: 'Tool execution failed',
              code: 'EXECUTION_ERROR',
            },
          }),
        },
      };
      marketService.getSDK.mockReturnValue(mockSDK);

      const result = await service.callTool('python_interpreter', { code: 'bad code' });

      expect(result).toEqual({
        error: {
          message: 'Tool execution failed',
          name: 'EXECUTION_ERROR',
        },
        result: null,
        sessionExpiredAndRecreated: false,
        success: false,
      });
    });

    it('should return error result with default message when error has no message', async () => {
      const mockSDK = {
        plugins: {
          runBuildInTool: vi.fn().mockResolvedValue({
            success: false,
            error: {},
          }),
        },
      };
      marketService.getSDK.mockReturnValue(mockSDK);

      const result = await service.callTool('python_interpreter', {});

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Unknown error');
    });

    it('should catch thrown errors and return error result', async () => {
      const mockSDK = {
        plugins: {
          runBuildInTool: vi.fn().mockRejectedValue(new Error('Network error')),
        },
      };
      marketService.getSDK.mockReturnValue(mockSDK);

      const result = await service.callTool('python_interpreter', {});

      expect(result).toEqual({
        error: {
          message: 'Network error',
          name: 'Error',
        },
        result: null,
        sessionExpiredAndRecreated: false,
        success: false,
      });
    });

    it('should default sessionExpiredAndRecreated to false when not in response data', async () => {
      const mockSDK = {
        plugins: {
          runBuildInTool: vi.fn().mockResolvedValue({
            success: true,
            data: {
              result: 'output',
            },
          }),
        },
      };
      marketService.getSDK.mockReturnValue(mockSDK);

      const result = await service.callTool('python_interpreter', {});

      expect(result.sessionExpiredAndRecreated).toBe(false);
    });
  });

  describe('exportAndUploadFile', () => {
    let mockS3Instance: {
      createPreSignedUrl: ReturnType<typeof vi.fn>;
      getFileMetadata: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
      // Get the mocked FileS3 constructor and set up instance
      const { FileS3 } = await import('@/server/modules/S3');
      mockS3Instance = {
        createPreSignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
        getFileMetadata: vi.fn().mockResolvedValue({
          contentLength: 1024,
          contentType: 'text/plain',
        }),
      };
      (FileS3 as any).mockImplementation(() => mockS3Instance);
    });

    it('should successfully export and upload a file', async () => {
      marketService.exportFile.mockResolvedValue({
        success: true,
        data: {
          result: {
            success: true,
            mimeType: 'text/plain',
          },
        },
      });

      fileService.createFileRecord.mockResolvedValue({
        fileId: 'file-123',
        url: '/f/file-123',
      });

      const result = await service.exportAndUploadFile('/tmp/output.txt', 'output.txt');

      expect(result).toEqual({
        fileId: 'file-123',
        filename: 'output.txt',
        mimeType: 'text/plain',
        size: 1024,
        success: true,
        url: '/f/file-123',
      });
    });

    it('should pass correct parameters to marketService.exportFile', async () => {
      marketService.exportFile.mockResolvedValue({
        success: true,
        data: {
          result: { success: true },
        },
      });

      fileService.createFileRecord.mockResolvedValue({
        fileId: 'file-123',
        url: '/f/file-123',
      });

      mockS3Instance.getFileMetadata.mockResolvedValue({
        contentLength: 512,
        contentType: 'application/json',
      });

      await service.exportAndUploadFile('/tmp/data.json', 'data.json');

      expect(marketService.exportFile).toHaveBeenCalledWith({
        path: '/tmp/data.json',
        topicId: 'test-topic-id',
        uploadUrl: 'https://s3.example.com/presigned-url',
        userId: 'test-user-id',
      });
    });

    it('should use metadata mimeType when result.mimeType is not provided', async () => {
      marketService.exportFile.mockResolvedValue({
        success: true,
        data: {
          result: { success: true },
        },
      });

      fileService.createFileRecord.mockResolvedValue({
        fileId: 'file-456',
        url: '/f/file-456',
      });

      mockS3Instance.getFileMetadata.mockResolvedValue({
        contentLength: 2048,
        contentType: 'application/pdf',
      });

      const result = await service.exportAndUploadFile('/tmp/doc.pdf', 'doc.pdf');

      expect(result.mimeType).toBe('application/pdf');
    });

    it('should fall back to application/octet-stream when no mimeType available', async () => {
      marketService.exportFile.mockResolvedValue({
        success: true,
        data: {
          result: { success: true },
        },
      });

      fileService.createFileRecord.mockResolvedValue({
        fileId: 'file-789',
        url: '/f/file-789',
      });

      mockS3Instance.getFileMetadata.mockResolvedValue({
        contentLength: 500,
        contentType: undefined,
      });

      const result = await service.exportAndUploadFile('/tmp/unknown', 'unknown');

      expect(result.mimeType).toBe('application/octet-stream');
    });

    it('should return error when marketService.exportFile indicates failure', async () => {
      marketService.exportFile.mockResolvedValue({
        success: false,
        error: {
          message: 'Export failed',
        },
      });

      const result = await service.exportAndUploadFile('/tmp/file.txt', 'file.txt');

      expect(result).toEqual({
        error: { message: 'Export failed' },
        filename: 'file.txt',
        success: false,
      });
    });

    it('should return default error message when exportFile error has no message', async () => {
      marketService.exportFile.mockResolvedValue({
        success: false,
        error: {},
      });

      const result = await service.exportAndUploadFile('/tmp/file.txt', 'file.txt');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to export file from sandbox');
    });

    it('should return error when sandbox upload fails (result.success is false)', async () => {
      marketService.exportFile.mockResolvedValue({
        success: true,
        data: {
          result: {
            success: false,
            error: 'Upload to S3 failed',
          },
        },
      });

      const result = await service.exportAndUploadFile('/tmp/file.txt', 'file.txt');

      expect(result).toEqual({
        error: { message: 'Upload to S3 failed' },
        filename: 'file.txt',
        success: false,
      });
    });

    it('should return default upload error message when result has no error message', async () => {
      marketService.exportFile.mockResolvedValue({
        success: true,
        data: {
          result: {
            success: false,
          },
        },
      });

      const result = await service.exportAndUploadFile('/tmp/file.txt', 'file.txt');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to upload file from sandbox');
    });

    it('should catch thrown errors and return error result', async () => {
      mockS3Instance.createPreSignedUrl.mockRejectedValue(new Error('S3 connection error'));

      const result = await service.exportAndUploadFile('/tmp/file.txt', 'file.txt');

      expect(result).toEqual({
        error: { message: 'S3 connection error' },
        filename: 'file.txt',
        success: false,
      });
    });

    it('should generate S3 key with date-based sharding and topic path', async () => {
      marketService.exportFile.mockResolvedValue({
        success: true,
        data: { result: { success: true } },
      });

      fileService.createFileRecord.mockResolvedValue({
        fileId: 'file-abc',
        url: '/f/file-abc',
      });

      await service.exportAndUploadFile('/tmp/report.csv', 'report.csv');

      const today = new Date().toISOString().split('T')[0];
      const expectedKeyPattern = `code-interpreter-exports/${today}/test-topic-id/report.csv`;

      expect(mockS3Instance.createPreSignedUrl).toHaveBeenCalledWith(expectedKeyPattern);
      expect(fileService.createFileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'report.csv',
          url: expectedKeyPattern,
        }),
      );
    });

    it('should pass file metadata to createFileRecord', async () => {
      marketService.exportFile.mockResolvedValue({
        success: true,
        data: {
          result: { success: true, mimeType: 'image/png' },
        },
      });

      fileService.createFileRecord.mockResolvedValue({
        fileId: 'img-001',
        url: '/f/img-001',
      });

      mockS3Instance.getFileMetadata.mockResolvedValue({
        contentLength: 204800,
        contentType: 'image/png',
      });

      await service.exportAndUploadFile('/tmp/chart.png', 'chart.png');

      expect(fileService.createFileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          fileType: 'image/png',
          name: 'chart.png',
          size: 204800,
        }),
      );
    });
  });
});
