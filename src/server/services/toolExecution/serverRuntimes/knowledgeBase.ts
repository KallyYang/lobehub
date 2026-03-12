import { KnowledgeBaseIdentifier } from '@lobechat/builtin-tool-knowledge-base';
import {
  KnowledgeBaseExecutionRuntime,
  type KnowledgeBaseService,
} from '@lobechat/builtin-tool-knowledge-base/executionRuntime';

import { KnowledgeBaseModel } from '@/database/models/knowledgeBase';

import { type ServerRuntimeRegistration } from './types';

/**
 * Knowledge Base Server Runtime
 * Per-request runtime (needs serverDB, userId)
 */
export const knowledgeBaseRuntime: ServerRuntimeRegistration = {
  factory: (context) => {
    if (!context.userId || !context.serverDB) {
      throw new Error('userId and serverDB are required for KnowledgeBase execution');
    }

    const knowledgeBaseModel = new KnowledgeBaseModel(context.serverDB, context.userId);

    const knowledgeBaseService: KnowledgeBaseService = {
      createKnowledgeBase: async (params) => {
        const result = await knowledgeBaseModel.create(params);
        return result.id;
      },
      getKnowledgeBaseList: async () => {
        return knowledgeBaseModel.query();
      },
      updateKnowledgeBase: async (id, value) => {
        await knowledgeBaseModel.update(id, value);
      },
    };

    // Note: ragService is not available on server side for this runtime,
    // search/read operations are handled by the client-side executor.
    // Server runtime only handles CRUD operations.
    const noopRagService = {
      getFileContents: async () => [],
      semanticSearchForChat: async () => ({ chunks: [], fileResults: [] }),
    };

    return new KnowledgeBaseExecutionRuntime(noopRagService, knowledgeBaseService);
  },
  identifier: KnowledgeBaseIdentifier,
};
