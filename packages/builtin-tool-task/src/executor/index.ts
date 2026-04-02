import type { BuiltinToolContext, BuiltinToolResult } from '@lobechat/types';
import { BaseExecutor } from '@lobechat/types';

import { TaskIdentifier } from '../manifest';
import { TaskApiName } from '../types';

class TaskExecutor extends BaseExecutor<typeof TaskApiName> {
  readonly identifier = TaskIdentifier;
  protected readonly apiEnum = TaskApiName;

  // TODO (LOBE-6597): wire to store.createTask()
  createTask = async (_params: any, _ctx?: BuiltinToolContext): Promise<BuiltinToolResult> => {
    return { content: 'Not implemented: createTask', success: false };
  };

  // TODO (LOBE-6597): wire to store.deleteTask()
  deleteTask = async (_params: any, _ctx?: BuiltinToolContext): Promise<BuiltinToolResult> => {
    return { content: 'Not implemented: deleteTask', success: false };
  };

  // TODO (LOBE-6597): wire to store.updateTask() + addDependency/removeDependency
  editTask = async (_params: any, _ctx?: BuiltinToolContext): Promise<BuiltinToolResult> => {
    return { content: 'Not implemented: editTask', success: false };
  };

  // TODO (LOBE-6597): wire to service.list() or store.tasks
  listTasks = async (_params: any, _ctx?: BuiltinToolContext): Promise<BuiltinToolResult> => {
    return { content: 'Not implemented: listTasks', success: false };
  };

  // TODO (LOBE-6597): wire to lifecycle slice actions (runTask/pauseTask/cancelTask etc.)
  updateTaskStatus = async (
    _params: any,
    _ctx?: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    return { content: 'Not implemented: updateTaskStatus', success: false };
  };

  // TODO (LOBE-6597): wire to service.detail() or store.taskDetailMap
  viewTask = async (_params: any, _ctx?: BuiltinToolContext): Promise<BuiltinToolResult> => {
    return { content: 'Not implemented: viewTask', success: false };
  };
}

export const taskExecutor = new TaskExecutor();
