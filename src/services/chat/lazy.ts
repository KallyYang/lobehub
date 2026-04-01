const loadChatServiceModule = () => import('./index');

let chatServiceModulePromise: ReturnType<typeof loadChatServiceModule> | undefined;

export const getChatService = async () => {
  if (!chatServiceModulePromise) {
    chatServiceModulePromise = loadChatServiceModule();
  }

  const { chatService } = await chatServiceModulePromise;

  return chatService;
};
