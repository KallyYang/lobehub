import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import HeaderActions from './index';

vi.mock('@lobehub/ui', () => ({
  ActionIcon: () => <button data-testid="overflow-menu-button" />,
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/RightPanel/ToggleRightPanelButton', () => ({
  default: () => <button data-testid="toggle-right-panel-button" />,
}));

vi.mock('./useMenu', () => ({
  useMenu: () => ({
    menuItems: [],
  }),
}));

describe('Conversation header actions', () => {
  it('renders the right panel toggle affordance', () => {
    render(<HeaderActions />);

    expect(screen.getByTestId('toggle-right-panel-button')).toBeInTheDocument();
  });
});
