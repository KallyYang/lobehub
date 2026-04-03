import type {
  DesktopNotificationResult,
  ShowDesktopNotificationParams,
} from '@lobechat/electron-client-ipc';
import { app, Notification } from 'electron';
import { linux, macOS, windows } from 'electron-is';

import { getIpcContext } from '@/utils/ipc';
import { createLogger } from '@/utils/logger';

import { ControllerModule, IpcMethod } from './index';

const logger = createLogger('controllers:NotificationCtr');

export default class NotificationCtr extends ControllerModule {
  static override readonly groupName = 'notification';

  /**
   * Track active notifications so we can clean up properly.
   * On Linux/GNOME, lingering Notification objects can cause the rendering
   * thread to block when the user dismisses them, so we proactively close
   * the previous notification before creating a new one.
   */
  private activeNotification: Electron.Notification | null = null;

  @IpcMethod()
  async getNotificationPermissionStatus(): Promise<string> {
    if (!Notification.isSupported()) return 'denied';
    // Keep a stable status string for renderer-side UI mapping.
    // Screen3 expects macOS to return 'authorized' when granted.
    if (!macOS()) return 'authorized';

    // Electron 38 no longer exposes `systemPreferences.getNotificationSettings()` in types,
    // and some runtimes don't provide it at all. Use the renderer's Notification.permission
    // as a reliable fallback.
    const context = getIpcContext();
    const sender = context?.sender;
    if (!sender) return 'notDetermined';
    const permission = await sender.executeJavaScript('Notification.permission', true);
    return permission === 'granted' ? 'authorized' : 'denied';
  }

  @IpcMethod()
  async requestNotificationPermission(): Promise<void> {
    logger.debug('Requesting notification permission by sending a test notification');

    if (!Notification.isSupported()) {
      logger.warn('System does not support desktop notifications');
      return;
    }

    // On macOS, ask permission via Web Notification API first when possible.
    // This helps keep `Notification.permission` in sync for subsequent status checks.
    if (macOS()) {
      try {
        const mainWindow = this.app.browserManager.getMainWindow().browserWindow;
        await mainWindow.webContents.executeJavaScript('Notification.requestPermission()', true);
      } catch (error) {
        logger.debug(
          'Notification.requestPermission() failed or is unavailable, continuing with test notification',
          error,
        );
      }
    }

    const notification = new Notification({
      body: 'LobeHub can now send you notifications.',
      title: 'Notification Permission',
    });

    notification.show();
  }
  /**
   * Set up desktop notifications after the application is ready
   */
  afterAppReady() {
    this.setupNotifications();
  }

  /**
   * Set up desktop notification permissions and configuration
   */
  private setupNotifications() {
    logger.debug('Setting up desktop notifications');

    try {
      // Check notification support
      if (!Notification.isSupported()) {
        logger.warn('Desktop notifications are not supported on this platform');
        return;
      }

      // On macOS, we may need to explicitly request notification permissions
      if (macOS()) {
        logger.debug('macOS detected, notification permissions should be handled by system');
      }

      // Set app user model ID on Windows
      if (windows()) {
        app.setAppUserModelId('com.lobehub.chat');
        logger.debug('Set Windows App User Model ID for notifications');
      }

      if (linux()) {
        logger.debug(
          'Linux detected – notifications will use low urgency and non-blocking dispatch ' +
            'to work around GNOME Shell D-Bus freeze issues',
        );
      }

      logger.info('Desktop notifications setup completed');
    } catch (error) {
      logger.error('Failed to setup desktop notifications:', error);
    }
  }
  /**
   * Close and dereference the active notification to prevent resource leaks.
   * On Linux/GNOME this is critical: lingering Notification handles can cause
   * the rendering thread to block when the desktop environment tries to
   * dismiss them.
   */
  private cleanupActiveNotification() {
    if (this.activeNotification) {
      try {
        this.activeNotification.close();
      } catch {
        // Notification may already be closed / GC'd – safe to ignore.
      }
      this.activeNotification = null;
    }
  }

  /**
   * Show system desktop notification (only when window is hidden)
   */
  @IpcMethod()
  async showDesktopNotification(
    params: ShowDesktopNotificationParams,
  ): Promise<DesktopNotificationResult> {
    logger.debug('Received desktop notification request:', params);

    try {
      // Check notification support
      if (!Notification.isSupported()) {
        logger.warn('System does not support desktop notifications');
        return { error: 'Desktop notifications not supported', success: false };
      }

      // Check if window is hidden
      const isWindowHidden = this.isMainWindowHidden();

      if (!isWindowHidden) {
        logger.debug('Main window is visible, skipping desktop notification');
        return { reason: 'Window is visible', skipped: true, success: true };
      }

      // Close previous notification before creating a new one to avoid
      // resource accumulation (especially important on Linux/GNOME).
      this.cleanupActiveNotification();

      logger.info('Window is hidden, showing desktop notification:', params.title);

      const isLinux = linux();

      const notification = new Notification({
        body: params.body,
        hasReply: false,
        silent: params.silent || false,
        title: params.title,
        // On Linux/GNOME, use 'never' so Electron does not keep an internal
        // timer that races with the desktop-environment's own dismiss logic.
        // This avoids the freeze reported when the two conflict.
        timeoutType: isLinux ? 'never' : 'default',
        // Low urgency on Linux tells the notification daemon it is safe to
        // expire/collapse the bubble quickly, reducing the chance of D-Bus
        // round-trip blocking the main process.
        urgency: isLinux ? 'low' : 'normal',
      });

      notification.on('show', () => {
        logger.info('Notification shown');
      });

      notification.on('click', () => {
        logger.debug('User clicked notification, showing main window');
        const mainWindow = this.app.browserManager.getMainWindow();
        mainWindow.show();
        mainWindow.browserWindow.focus();
        this.cleanupActiveNotification();
      });

      notification.on('close', () => {
        logger.debug('Notification closed');
        // Dereference immediately so the next notification starts clean.
        this.activeNotification = null;
      });

      notification.on('failed', (error) => {
        logger.error('Notification display failed:', error);
        this.activeNotification = null;
      });

      this.activeNotification = notification;
      notification.show();

      // On Linux we return immediately – do NOT block the IPC response on a
      // setTimeout, because Electron's notification codepath on Linux goes
      // through D-Bus which can stall under GNOME Shell.
      if (isLinux) {
        logger.info('Linux: notification dispatched (non-blocking)');
        return { success: true };
      }

      // On other platforms keep the original 100ms grace period.
      return new Promise((resolve) => {
        setTimeout(() => {
          logger.info('Notification display call completed');
          resolve({ success: true });
        }, 100);
      });
    } catch (error) {
      logger.error('Failed to show desktop notification:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      };
    }
  }

  /**
   * Check if the main window is hidden
   */
  @IpcMethod()
  isMainWindowHidden(): boolean {
    try {
      const mainWindow = this.app.browserManager.getMainWindow();
      const browserWindow = mainWindow.browserWindow;

      // If window is destroyed, consider it hidden
      if (browserWindow.isDestroyed()) {
        return true;
      }

      // Check if window is visible and focused
      const isVisible = browserWindow.isVisible();
      const isFocused = browserWindow.isFocused();
      const isMinimized = browserWindow.isMinimized();

      logger.debug('Window state check:', { isFocused, isMinimized, isVisible });

      // Window is hidden if: not visible, minimized, or not focused
      return !isVisible || isMinimized || !isFocused;
    } catch (error) {
      logger.error('Failed to check window state:', error);
      return true; // Consider window hidden on error to ensure notifications can be shown
    }
  }
}
