import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';

import { KnowledgeBaseService } from '../../packages/openapi/src/services/knowledge-base.service';
import { DeleteKnowledgeBaseQuerySchema } from '../../packages/openapi/src/types/knowledge-base.type';

describe('DeleteKnowledgeBaseQuerySchema', () => {
  it('should keep deletion non-cascading by default', () => {
    expect(DeleteKnowledgeBaseQuerySchema.parse({})).toEqual({});
    expect(DeleteKnowledgeBaseQuerySchema.parse({ removeFiles: 'false' })).toEqual({
      removeFiles: false,
    });
  });

  it('should only enable cascading deletion when explicitly requested', () => {
    expect(DeleteKnowledgeBaseQuerySchema.parse({ removeFiles: 'true' })).toEqual({
      removeFiles: true,
    });
  });
});

describe('KnowledgeBaseService.deleteKnowledgeBase', () => {
  let db: LobeChatDatabase;

  beforeEach(() => {
    db = {
      query: {
        knowledgeBases: {
          findFirst: vi.fn().mockResolvedValue({ id: 'kb-1', userId: 'user-1' }),
        },
      },
    } as unknown as LobeChatDatabase;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createService = () => {
    const service = new KnowledgeBaseService(db, 'user-1');

    vi.spyOn(service as any, 'log').mockImplementation(() => {});
    vi.spyOn(service as any, 'resolveOperationPermission').mockResolvedValue({
      isPermitted: true,
      message: '',
    });

    return service;
  };

  it('should delete only the knowledge base when removeFiles is omitted', async () => {
    const service = createService();
    const deleteSpy = vi.fn().mockResolvedValue(undefined);
    const deleteWithFilesSpy = vi.fn().mockResolvedValue({
      deletedFiles: [],
    });

    Reflect.set(service, 'knowledgeBaseModel', {
      delete: deleteSpy,
      deleteWithFiles: deleteWithFilesSpy,
    });

    await expect(service.deleteKnowledgeBase('kb-1')).resolves.toEqual({
      message: 'Knowledge base deleted successfully',
      success: true,
    });

    expect(deleteSpy).toHaveBeenCalledWith('kb-1');
    expect(deleteWithFilesSpy).not.toHaveBeenCalled();
  });

  it('should cascade only when removeFiles is explicitly true', async () => {
    const service = createService();
    const deleteSpy = vi.fn().mockResolvedValue(undefined);
    const deleteWithFilesSpy = vi.fn().mockResolvedValue({
      deletedFiles: [],
    });

    Reflect.set(service, 'knowledgeBaseModel', {
      delete: deleteSpy,
      deleteWithFiles: deleteWithFilesSpy,
    });

    await expect(service.deleteKnowledgeBase('kb-1', true)).resolves.toEqual({
      message: 'Knowledge base deleted successfully',
      success: true,
    });

    expect(deleteWithFilesSpy).toHaveBeenCalledWith('kb-1');
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
