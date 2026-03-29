import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BriefModel } from '@/database/models/brief';
import { TaskModel } from '@/database/models/task';
import { TaskTopicModel } from '@/database/models/taskTopic';
import { TopicModel } from '@/database/models/topic';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { SystemAgentService } from '@/server/services/systemAgent';
import { TaskReviewService } from '@/server/services/taskReview';

import { TaskLifecycleService } from '../index';

vi.mock('@/database/models/brief');
vi.mock('@/database/models/task');
vi.mock('@/database/models/taskTopic');
vi.mock('@/database/models/topic');
vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: vi.fn(),
}));
vi.mock('@/server/services/systemAgent');
vi.mock('@/server/services/taskReview');
vi.mock('debug', () => ({
  default: () => vi.fn(),
}));

describe('TaskLifecycleService', () => {
  let service: TaskLifecycleService;
  const mockDb = {} as any;
  const mockUserId = 'user-1';

  let mockTaskModel: any;
  let mockTaskTopicModel: any;
  let mockBriefModel: any;
  let mockTopicModel: any;
  let mockSystemAgentService: any;

  const mockTask = {
    assigneeAgentId: 'agent-1',
    assigneeUserId: 'user-1',
    config: {},
    createdAt: new Date('2025-01-01'),
    description: 'Test task',
    id: 'task-1',
    identifier: 'TASK-001',
    instruction: 'Do something',
    name: 'Test Task',
    parentTaskId: null,
    status: 'running',
    totalTopics: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTaskModel = {
      findById: vi.fn().mockResolvedValue(mockTask),
      findByIds: vi.fn().mockResolvedValue([]),
      getCheckpointConfig: vi.fn().mockReturnValue({}),
      getDependencies: vi.fn().mockResolvedValue([]),
      getDependenciesByTaskIds: vi.fn().mockResolvedValue([]),
      getReviewConfig: vi.fn().mockReturnValue(undefined),
      resolve: vi.fn().mockResolvedValue(mockTask),
      shouldPauseOnTopicComplete: vi.fn().mockReturnValue(true),
      updateHeartbeat: vi.fn().mockResolvedValue(undefined),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    mockTaskTopicModel = {
      findByTaskId: vi.fn().mockResolvedValue([]),
      updateHandoff: vi.fn().mockResolvedValue(undefined),
      updateReview: vi.fn().mockResolvedValue(undefined),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    mockBriefModel = {
      create: vi.fn().mockResolvedValue({}),
      findByTaskId: vi.fn().mockResolvedValue([]),
    };

    mockTopicModel = {
      update: vi.fn().mockResolvedValue(undefined),
    };

    mockSystemAgentService = {
      getTaskModelConfig: vi.fn().mockResolvedValue({ model: 'gpt-4', provider: 'openai' }),
    };

    vi.mocked(TaskModel).mockImplementation(() => mockTaskModel);
    vi.mocked(TaskTopicModel).mockImplementation(() => mockTaskTopicModel);
    vi.mocked(BriefModel).mockImplementation(() => mockBriefModel);
    vi.mocked(TopicModel).mockImplementation(() => mockTopicModel);
    vi.mocked(SystemAgentService).mockImplementation(() => mockSystemAgentService);

    service = new TaskLifecycleService(mockDb, mockUserId);
  });

  describe('onTopicComplete', () => {
    describe('reason = done', () => {
      it('should update heartbeat on completion', async () => {
        await service.onTopicComplete({
          operationId: 'op-1',
          reason: 'done',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
        });

        expect(mockTaskModel.updateHeartbeat).toHaveBeenCalledWith('task-1');
      });

      it('should update topic status to completed when topicId is provided', async () => {
        await service.onTopicComplete({
          operationId: 'op-1',
          reason: 'done',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        expect(mockTaskTopicModel.updateStatus).toHaveBeenCalledWith(
          'task-1',
          'topic-1',
          'completed',
        );
      });

      it('should not update topic status when topicId is not provided', async () => {
        await service.onTopicComplete({
          operationId: 'op-1',
          reason: 'done',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
        });

        expect(mockTaskTopicModel.updateStatus).not.toHaveBeenCalled();
      });

      it('should auto-complete task when latest brief is result type and no review config', async () => {
        mockBriefModel.findByTaskId.mockResolvedValue([{ type: 'result' }]);
        mockTaskModel.getReviewConfig.mockReturnValue(undefined);

        await service.onTopicComplete({
          operationId: 'op-1',
          reason: 'done',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        expect(mockTaskModel.updateStatus).toHaveBeenCalledWith('task-1', 'completed', {
          error: null,
        });
      });

      it('should pause task when shouldPauseOnTopicComplete is true and no result brief', async () => {
        mockBriefModel.findByTaskId.mockResolvedValue([]);
        mockTaskModel.getReviewConfig.mockReturnValue(undefined);
        mockTaskModel.shouldPauseOnTopicComplete.mockReturnValue(true);

        await service.onTopicComplete({
          operationId: 'op-1',
          reason: 'done',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        expect(mockTaskModel.updateStatus).toHaveBeenCalledWith('task-1', 'paused', {
          error: null,
        });
      });

      it('should not pause task when shouldPauseOnTopicComplete is false and no result brief', async () => {
        mockBriefModel.findByTaskId.mockResolvedValue([{ type: 'insight' }]);
        mockTaskModel.getReviewConfig.mockReturnValue(undefined);
        mockTaskModel.shouldPauseOnTopicComplete.mockReturnValue(false);

        await service.onTopicComplete({
          operationId: 'op-1',
          reason: 'done',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        expect(mockTaskModel.updateStatus).not.toHaveBeenCalled();
      });

      it('should not auto-complete when review config is enabled even if result brief exists', async () => {
        mockBriefModel.findByTaskId.mockResolvedValue([{ type: 'result' }]);
        mockTaskModel.getReviewConfig.mockReturnValue({ enabled: true, rubrics: [] });
        mockTaskModel.shouldPauseOnTopicComplete.mockReturnValue(false);

        await service.onTopicComplete({
          operationId: 'op-1',
          reason: 'done',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        // Should not auto-complete
        expect(mockTaskModel.updateStatus).not.toHaveBeenCalledWith('task-1', 'completed', {
          error: null,
        });
      });

      it('should attempt handoff generation when topicId and lastAssistantContent are provided', async () => {
        const mockModelRuntime = {
          generateObject: vi.fn().mockResolvedValue({ title: 'Handoff Title', summary: 'Done' }),
        };
        vi.mocked(initModelRuntimeFromDB).mockResolvedValue(mockModelRuntime as any);
        mockBriefModel.findByTaskId.mockResolvedValue([]);

        await service.onTopicComplete({
          lastAssistantContent: 'Task completed successfully',
          operationId: 'op-1',
          reason: 'done',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        expect(mockSystemAgentService.getTaskModelConfig).toHaveBeenCalledWith('topic');
      });

      it('should continue without throwing when handoff generation fails', async () => {
        vi.mocked(initModelRuntimeFromDB).mockRejectedValue(new Error('Model error'));
        mockBriefModel.findByTaskId.mockResolvedValue([]);

        await expect(
          service.onTopicComplete({
            lastAssistantContent: 'Task completed successfully',
            operationId: 'op-1',
            reason: 'done',
            taskId: 'task-1',
            taskIdentifier: 'TASK-001',
            topicId: 'topic-1',
          }),
        ).resolves.not.toThrow();
      });
    });

    describe('reason = error', () => {
      it('should update topic status to failed when topicId is provided', async () => {
        await service.onTopicComplete({
          errorMessage: 'Something went wrong',
          operationId: 'op-1',
          reason: 'error',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        expect(mockTaskTopicModel.updateStatus).toHaveBeenCalledWith('task-1', 'topic-1', 'failed');
      });

      it('should not update topic status when topicId is not provided', async () => {
        await service.onTopicComplete({
          errorMessage: 'Something went wrong',
          operationId: 'op-1',
          reason: 'error',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
        });

        expect(mockTaskTopicModel.updateStatus).not.toHaveBeenCalled();
      });

      it('should create an error brief with error message', async () => {
        await service.onTopicComplete({
          errorMessage: 'Connection timeout',
          operationId: 'op-1',
          reason: 'error',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        expect(mockBriefModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            priority: 'urgent',
            summary: 'Execution failed: Connection timeout',
            taskId: 'task-1',
            type: 'error',
          }),
        );
      });

      it('should use Unknown error message when errorMessage is not provided', async () => {
        await service.onTopicComplete({
          operationId: 'op-1',
          reason: 'error',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
        });

        expect(mockBriefModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            summary: 'Execution failed: Unknown error',
          }),
        );
      });

      it('should include topic seq and topicId in brief title when topicId is provided', async () => {
        await service.onTopicComplete({
          errorMessage: 'Error',
          operationId: 'op-1',
          reason: 'error',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        expect(mockBriefModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining('topic-1'),
          }),
        );
      });

      it('should update task status to paused after error', async () => {
        await service.onTopicComplete({
          errorMessage: 'Error',
          operationId: 'op-1',
          reason: 'error',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
        });

        expect(mockTaskModel.updateStatus).toHaveBeenCalledWith('task-1', 'paused');
      });
    });

    describe('auto-review', () => {
      it('should run review when review config is enabled with rubrics', async () => {
        const mockReviewResult = {
          overallScore: 90,
          passed: true,
          rubricResults: [],
          suggestions: [],
        };
        const mockReviewService = {
          review: vi.fn().mockResolvedValue(mockReviewResult),
        };
        vi.mocked(TaskReviewService).mockImplementation(() => mockReviewService as any);

        mockTaskModel.getReviewConfig.mockReturnValue({
          enabled: true,
          rubrics: [{ criterion: 'Quality', weight: 1 }],
        });
        mockTaskTopicModel.findByTaskId.mockResolvedValue([
          { reviewIteration: 0, topicId: 'topic-1' },
        ]);

        // Mock handoff generation failure so we don't need full runtime setup
        vi.mocked(initModelRuntimeFromDB).mockRejectedValue(new Error('skip'));
        mockBriefModel.findByTaskId.mockResolvedValue([]);

        await service.onTopicComplete({
          lastAssistantContent: 'The task was completed.',
          operationId: 'op-1',
          reason: 'done',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        expect(mockReviewService.review).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'The task was completed.',
            iteration: 1,
            rubrics: [{ criterion: 'Quality', weight: 1 }],
          }),
        );
      });

      it('should create result brief when review passes', async () => {
        const mockReviewResult = {
          overallScore: 95,
          passed: true,
          rubricResults: [],
          suggestions: [],
        };
        const mockReviewService = {
          review: vi.fn().mockResolvedValue(mockReviewResult),
        };
        vi.mocked(TaskReviewService).mockImplementation(() => mockReviewService as any);

        mockTaskModel.getReviewConfig.mockReturnValue({
          enabled: true,
          rubrics: [{ criterion: 'Quality', weight: 1 }],
        });
        mockTaskTopicModel.findByTaskId.mockResolvedValue([
          { reviewIteration: 0, topicId: 'topic-1' },
        ]);
        vi.mocked(initModelRuntimeFromDB).mockRejectedValue(new Error('skip'));
        mockBriefModel.findByTaskId.mockResolvedValue([]);

        await service.onTopicComplete({
          lastAssistantContent: 'Done',
          operationId: 'op-1',
          reason: 'done',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        expect(mockBriefModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'result',
            priority: 'info',
          }),
        );
      });

      it('should pause task and create insight brief when review fails and autoRetry is enabled', async () => {
        const mockReviewResult = {
          overallScore: 40,
          passed: false,
          rubricResults: [],
          suggestions: ['Improve quality'],
        };
        const mockReviewService = {
          review: vi.fn().mockResolvedValue(mockReviewResult),
        };
        vi.mocked(TaskReviewService).mockImplementation(() => mockReviewService as any);

        mockTaskModel.getReviewConfig.mockReturnValue({
          autoRetry: true,
          enabled: true,
          maxIterations: 3,
          rubrics: [{ criterion: 'Quality', weight: 1 }],
        });
        mockTaskTopicModel.findByTaskId.mockResolvedValue([
          { reviewIteration: 0, topicId: 'topic-1' },
        ]);
        vi.mocked(initModelRuntimeFromDB).mockRejectedValue(new Error('skip'));
        mockBriefModel.findByTaskId.mockResolvedValue([]);

        await service.onTopicComplete({
          lastAssistantContent: 'Done',
          operationId: 'op-1',
          reason: 'done',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        expect(mockBriefModel.create).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'insight' }),
        );
        expect(mockTaskModel.updateStatus).toHaveBeenCalledWith('task-1', 'paused', {
          error: null,
        });
      });

      it('should create decision brief when max iterations reached', async () => {
        const mockReviewResult = {
          overallScore: 40,
          passed: false,
          rubricResults: [],
          suggestions: ['Improve quality'],
        };
        const mockReviewService = {
          review: vi.fn().mockResolvedValue(mockReviewResult),
        };
        vi.mocked(TaskReviewService).mockImplementation(() => mockReviewService as any);

        mockTaskModel.getReviewConfig.mockReturnValue({
          autoRetry: true,
          enabled: true,
          maxIterations: 1, // max 1 iteration
          rubrics: [{ criterion: 'Quality', weight: 1 }],
        });
        // iteration will be 1, which equals maxIterations
        mockTaskTopicModel.findByTaskId.mockResolvedValue([
          { reviewIteration: 0, topicId: 'topic-1' },
        ]);
        vi.mocked(initModelRuntimeFromDB).mockRejectedValue(new Error('skip'));
        mockBriefModel.findByTaskId.mockResolvedValue([]);

        await service.onTopicComplete({
          lastAssistantContent: 'Done',
          operationId: 'op-1',
          reason: 'done',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        expect(mockBriefModel.create).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'decision' }),
        );
      });

      it('should not run review when rubrics are empty', async () => {
        const mockReviewService = { review: vi.fn() };
        vi.mocked(TaskReviewService).mockImplementation(() => mockReviewService as any);

        mockTaskModel.getReviewConfig.mockReturnValue({
          enabled: true,
          rubrics: [], // empty rubrics
        });
        vi.mocked(initModelRuntimeFromDB).mockRejectedValue(new Error('skip'));
        mockBriefModel.findByTaskId.mockResolvedValue([]);
        mockTaskModel.shouldPauseOnTopicComplete.mockReturnValue(false);

        await service.onTopicComplete({
          lastAssistantContent: 'Done',
          operationId: 'op-1',
          reason: 'done',
          taskId: 'task-1',
          taskIdentifier: 'TASK-001',
          topicId: 'topic-1',
        });

        expect(mockReviewService.review).not.toHaveBeenCalled();
      });

      it('should continue without throwing when auto-review fails', async () => {
        const mockReviewService = {
          review: vi.fn().mockRejectedValue(new Error('Review service error')),
        };
        vi.mocked(TaskReviewService).mockImplementation(() => mockReviewService as any);

        mockTaskModel.getReviewConfig.mockReturnValue({
          enabled: true,
          rubrics: [{ criterion: 'Quality', weight: 1 }],
        });
        mockTaskTopicModel.findByTaskId.mockResolvedValue([]);
        vi.mocked(initModelRuntimeFromDB).mockRejectedValue(new Error('skip'));
        mockBriefModel.findByTaskId.mockResolvedValue([]);

        await expect(
          service.onTopicComplete({
            lastAssistantContent: 'Done',
            operationId: 'op-1',
            reason: 'done',
            taskId: 'task-1',
            taskIdentifier: 'TASK-001',
            topicId: 'topic-1',
          }),
        ).resolves.not.toThrow();
      });
    });
  });
});
