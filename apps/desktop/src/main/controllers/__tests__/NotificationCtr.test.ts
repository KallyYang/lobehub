import type { ShowDesktopNotificationParams } from '@lobechat/electron-client-ipc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { App } from '@/core/App';

import NotificationCtr from '../NotificationCtr';

const { ipcMainHandleMock, mockNotificationInstance, notificationCtorSpy } = vi.hoisted(() => ({
  ipcMainHandleMock: vi.fn(),
  mockNotificationInstance: {
    close: vi.fn(),
    on: vi.fn(),
    show: vi.fn(),
  },
  notificationCtorSpy: vi.fn(),
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock electron
vi.mock('electron', () => {
  class MockNotification {
    close = mockNotificationInstance.close;
    on = mockNotificationInstance.on;
    show = mockNotificationInstance.show;
    static isSupported = vi.fn(() => true);
    constructor(opts?: any) {
      notificationCtorSpy(opts);
    }
  }

  return {
    Notification: MockNotification,
    app: {
      setAppUserModelId: vi.fn(),
    },
    ipcMain: {
      handle: ipcMainHandleMock,
    },
  };
});

// Mock electron-is
vi.mock('electron-is', () => ({
  linux: vi.fn(() => false),
  macOS: vi.fn(() => false),
  windows: vi.fn(() => false),
}));

// Mock browserManager
const mockBrowserWindow = {
  focus: vi.fn(),
  isDestroyed: vi.fn(() => false),
  isFocused: vi.fn(() => true),
  isMinimized: vi.fn(() => false),
  isVisible: vi.fn(() => true),
};

const mockMainWindow = {
  browserWindow: mockBrowserWindow,
  show: vi.fn(),
};

const mockBrowserManager = {
  getMainWindow: vi.fn(() => mockMainWindow),
};

const mockApp = {
  browserManager: mockBrowserManager,
} as unknown as App;

describe('NotificationCtr', () => {
  let controller: NotificationCtr;

  beforeEach(() => {
    vi.clearAllMocks();
    ipcMainHandleMock.mockClear();
    vi.useFakeTimers();
    controller = new NotificationCtr(mockApp);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('afterAppReady', () => {
    it('should setup notifications when supported', async () => {
      const { Notification } = await import('electron');
      vi.mocked(Notification.isSupported).mockReturnValue(true);

      controller.afterAppReady();

      expect(Notification.isSupported).toHaveBeenCalled();
    });

    it('should not setup when notifications are not supported', async () => {
      const { Notification } = await import('electron');
      vi.mocked(Notification.isSupported).mockReturnValue(false);

      controller.afterAppReady();

      expect(Notification.isSupported).toHaveBeenCalled();
    });

    it('should set app user model ID on Windows', async () => {
      const { windows } = await import('electron-is');
      const { app, Notification } = await import('electron');
      vi.mocked(windows).mockReturnValue(true);
      vi.mocked(Notification.isSupported).mockReturnValue(true);

      controller.afterAppReady();

      expect(app.setAppUserModelId).toHaveBeenCalledWith('com.lobehub.chat');

      vi.mocked(windows).mockReturnValue(false);
    });

    it('should handle macOS platform', async () => {
      const { macOS } = await import('electron-is');
      const { Notification } = await import('electron');
      vi.mocked(macOS).mockReturnValue(true);
      vi.mocked(Notification.isSupported).mockReturnValue(true);

      // Should not throw
      expect(() => controller.afterAppReady()).not.toThrow();

      vi.mocked(macOS).mockReturnValue(false);
    });
  });

  describe('showDesktopNotification', () => {
    const params: ShowDesktopNotificationParams = {
      body: 'Test body',
      title: 'Test title',
    };

    it('should return error when notifications are not supported', async () => {
      const { Notification } = await import('electron');
      vi.mocked(Notification.isSupported).mockReturnValue(false);

      const result = await controller.showDesktopNotification(params);

      expect(result).toEqual({
        error: 'Desktop notifications not supported',
        success: false,
      });
    });

    it('should skip notification when window is visible and focused', async () => {
      const { Notification } = await import('electron');
      vi.mocked(Notification.isSupported).mockReturnValue(true);
      mockBrowserWindow.isVisible.mockReturnValue(true);
      mockBrowserWindow.isFocused.mockReturnValue(true);
      mockBrowserWindow.isMinimized.mockReturnValue(false);

      const result = await controller.showDesktopNotification(params);

      expect(result).toEqual({
        reason: 'Window is visible',
        skipped: true,
        success: true,
      });
    });

    it('should show notification when window is hidden', async () => {
      const { Notification } = await import('electron');
      vi.mocked(Notification.isSupported).mockReturnValue(true);
      mockBrowserWindow.isVisible.mockReturnValue(false);

      const promise = controller.showDesktopNotification(params);
      vi.advanceTimersByTime(100);
      const result = await promise;

      expect(notificationCtorSpy).toHaveBeenCalledWith({
        body: 'Test body',
        hasReply: false,
        silent: false,
        timeoutType: 'default',
        title: 'Test title',
        urgency: 'normal',
      });
      expect(result).toEqual({ success: true });
    });

    it('should show notification when window is minimized', async () => {
      const { Notification } = await import('electron');
      vi.mocked(Notification.isSupported).mockReturnValue(true);
      mockBrowserWindow.isVisible.mockReturnValue(true);
      mockBrowserWindow.isFocused.mockReturnValue(true);
      mockBrowserWindow.isMinimized.mockReturnValue(true);

      const promise = controller.showDesktopNotification(params);
      vi.advanceTimersByTime(100);
      const result = await promise;

      expect(notificationCtorSpy).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should show notification when window is not focused', async () => {
      const { Notification } = await import('electron');
      vi.mocked(Notification.isSupported).mockReturnValue(true);
      mockBrowserWindow.isVisible.mockReturnValue(true);
      mockBrowserWindow.isFocused.mockReturnValue(false);
      mockBrowserWindow.isMinimized.mockReturnValue(false);

      const promise = controller.showDesktopNotification(params);
      vi.advanceTimersByTime(100);
      const result = await promise;

      expect(notificationCtorSpy).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should pass silent option to notification', async () => {
      const { Notification } = await import('electron');
      vi.mocked(Notification.isSupported).mockReturnValue(true);
      mockBrowserWindow.isVisible.mockReturnValue(false);

      const paramsWithSilent: ShowDesktopNotificationParams = {
        ...params,
        silent: true,
      };

      const promise = controller.showDesktopNotification(paramsWithSilent);
      vi.advanceTimersByTime(100);
      await promise;

      expect(notificationCtorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          silent: true,
        }),
      );
    });

    it('should register click handler to show main window', async () => {
      const { Notification } = await import('electron');
      vi.mocked(Notification.isSupported).mockReturnValue(true);
      mockBrowserWindow.isVisible.mockReturnValue(false);

      const promise = controller.showDesktopNotification(params);
      vi.advanceTimersByTime(100);
      await promise;

      // Find the click handler from the shared mock
      const clickHandler = mockNotificationInstance.on.mock.calls.find(
        (call) => call[0] === 'click',
      )?.[1];

      expect(clickHandler).toBeDefined();

      // Simulate click
      clickHandler();

      expect(mockMainWindow.show).toHaveBeenCalled();
      expect(mockBrowserWindow.focus).toHaveBeenCalled();
    });

    it('should handle notification error', async () => {
      const { Notification } = await import('electron');
      vi.mocked(Notification.isSupported).mockReturnValue(true);
      mockBrowserWindow.isVisible.mockReturnValue(false);
      notificationCtorSpy.mockImplementationOnce(() => {
        throw new Error('Notification error');
      });

      const result = await controller.showDesktopNotification(params);

      expect(result).toEqual({
        error: 'Notification error',
        success: false,
      });
    });

    it('should use low urgency and non-blocking dispatch on Linux', async () => {
      const { Notification } = await import('electron');
      const electronIs = await import('electron-is');
      vi.mocked(Notification.isSupported).mockReturnValue(true);
      vi.mocked(electronIs.linux).mockReturnValue(true);
      mockBrowserWindow.isVisible.mockReturnValue(false);

      // On Linux the method should resolve immediately without needing timer advancement
      const result = await controller.showDesktopNotification(params);

      expect(notificationCtorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutType: 'never',
          urgency: 'low',
        }),
      );
      expect(result).toEqual({ success: true });

      vi.mocked(electronIs.linux).mockReturnValue(false);
    });

    it('should close previous notification before showing a new one', async () => {
      const { Notification } = await import('electron');
      vi.mocked(Notification.isSupported).mockReturnValue(true);
      mockBrowserWindow.isVisible.mockReturnValue(false);

      // Show first notification
      const p1 = controller.showDesktopNotification(params);
      vi.advanceTimersByTime(100);
      await p1;

      // Show second notification – should close the first
      const p2 = controller.showDesktopNotification(params);
      vi.advanceTimersByTime(100);
      await p2;

      expect(mockNotificationInstance.close).toHaveBeenCalled();
    });

    it('should handle unknown error type', async () => {
      const { Notification } = await import('electron');
      vi.mocked(Notification.isSupported).mockReturnValue(true);
      mockBrowserWindow.isVisible.mockReturnValue(false);
      notificationCtorSpy.mockImplementationOnce(() => {
        throw 'string error';
      });

      const result = await controller.showDesktopNotification(params);

      expect(result).toEqual({
        error: 'Unknown error',
        success: false,
      });
    });
  });

  describe('isMainWindowHidden', () => {
    it('should return false when window is visible and focused', () => {
      mockBrowserWindow.isVisible.mockReturnValue(true);
      mockBrowserWindow.isFocused.mockReturnValue(true);
      mockBrowserWindow.isMinimized.mockReturnValue(false);
      mockBrowserWindow.isDestroyed.mockReturnValue(false);

      const result = controller.isMainWindowHidden();

      expect(result).toBe(false);
    });

    it('should return true when window is not visible', () => {
      mockBrowserWindow.isVisible.mockReturnValue(false);
      mockBrowserWindow.isFocused.mockReturnValue(true);
      mockBrowserWindow.isMinimized.mockReturnValue(false);
      mockBrowserWindow.isDestroyed.mockReturnValue(false);

      const result = controller.isMainWindowHidden();

      expect(result).toBe(true);
    });

    it('should return true when window is minimized', () => {
      mockBrowserWindow.isVisible.mockReturnValue(true);
      mockBrowserWindow.isFocused.mockReturnValue(true);
      mockBrowserWindow.isMinimized.mockReturnValue(true);
      mockBrowserWindow.isDestroyed.mockReturnValue(false);

      const result = controller.isMainWindowHidden();

      expect(result).toBe(true);
    });

    it('should return true when window is not focused', () => {
      mockBrowserWindow.isVisible.mockReturnValue(true);
      mockBrowserWindow.isFocused.mockReturnValue(false);
      mockBrowserWindow.isMinimized.mockReturnValue(false);
      mockBrowserWindow.isDestroyed.mockReturnValue(false);

      const result = controller.isMainWindowHidden();

      expect(result).toBe(true);
    });

    it('should return true when window is destroyed', () => {
      mockBrowserWindow.isDestroyed.mockReturnValue(true);

      const result = controller.isMainWindowHidden();

      expect(result).toBe(true);
    });

    it('should return true on error', () => {
      mockBrowserManager.getMainWindow.mockImplementationOnce(() => {
        throw new Error('Window not available');
      });

      const result = controller.isMainWindowHidden();

      expect(result).toBe(true);
    });
  });
});
