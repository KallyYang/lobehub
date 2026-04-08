import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AgentDocumentsGroup from './AgentDocumentsGroup';

const useClientDataSWR = vi.fn();

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
    <div {...props}>{children}</div>
  ),
  Markdown: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: (...args: unknown[]) => useClientDataSWR(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'workspacePanel.agentDocuments': 'Agent Documents',
          'workspacePanel.resources.empty': 'No agent documents yet',
          'workspacePanel.resources.error': 'Failed to load resources',
          'workspacePanel.resources.loading': 'Loading resources...',
          'workspacePanel.resources.previewError': 'Failed to load preview',
          'workspacePanel.resources.previewLoading': 'Loading preview...',
        }) as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('@/services/agentDocument', () => ({
  agentDocumentService: {
    getDocuments: vi.fn(),
    readDocument: vi.fn(),
  },
}));

vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: (state: { activeAgentId: string }) => unknown) =>
    selector({ activeAgentId: 'agent-1' }),
}));

vi.mock('@/features/AgentSkillDetail/FileTree', () => ({
  default: ({
    onSelectFile,
    resourceTree,
  }: {
    onSelectFile: (path: string) => void;
    resourceTree: Array<{ children?: Array<{ name: string; path: string }> }>;
  }) => (
    <div>
      {resourceTree.flatMap((node) =>
        (node.children || []).map((child) => (
          <button key={child.path} onClick={() => onSelectFile(child.path)}>
            {child.name}
          </button>
        )),
      )}
    </div>
  ),
}));

describe('AgentDocumentsGroup', () => {
  beforeEach(() => {
    useClientDataSWR.mockReset();
  });

  it('renders documents and lazy-loads preview on selection', async () => {
    useClientDataSWR.mockImplementation((key: unknown) => {
      if (Array.isArray(key) && key[0] === 'workspace-agent-documents') {
        return {
          data: [{ filename: 'brief.md', id: 'doc-1', templateId: 'claw', title: 'Brief' }],
          error: undefined,
          isLoading: false,
        };
      }

      if (Array.isArray(key) && key[0] === 'workspace-agent-document-preview') {
        return {
          data: { content: '# Brief', filename: 'brief.md', id: 'doc-1', title: 'Brief' },
          error: undefined,
          isLoading: false,
        };
      }

      return { data: undefined, error: undefined, isLoading: false };
    });

    render(<AgentDocumentsGroup />);

    expect(await screen.findByText('Brief')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Brief'));

    await waitFor(() => {
      expect(screen.getByText('# Brief')).toBeInTheDocument();
    });
  });
});
