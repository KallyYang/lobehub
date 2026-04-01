import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';

import Ai21Provider from './ai21';
import Ai302Provider from './ai302';
import Ai360Provider from './ai360';
import AiHubMixProvider from './aihubmix';
import AkashChatProvider from './akashchat';
import AnthropicProvider from './anthropic';
import AzureProvider from './azure';
import AzureAIProvider from './azureai';
import BaichuanProvider from './baichuan';
import BailianCodingPlanProvider from './bailianCodingPlan';
import BedrockProvider from './bedrock';
import BflProvider from './bfl';
import CerebrasProvider from './cerebras';
import CloudflareProvider from './cloudflare';
import CohereProvider from './cohere';
import CometAPIProvider from './cometapi';
import ComfyUIProvider from './comfyui';
import DeepSeekProvider from './deepseek';
import FalProvider from './fal';
import FireworksAIProvider from './fireworksai';
import GiteeAIProvider from './giteeai';
import GithubProvider from './github';
import GithubCopilotProvider from './githubCopilot';
import GLMCodingPlanProvider from './glmCodingPlan';
import GoogleProvider from './google';
import GroqProvider from './groq';
import HigressProvider from './higress';
import HuggingFaceProvider from './huggingface';
import HunyuanProvider from './hunyuan';
import InfiniAIProvider from './infiniai';
import InternLMProvider from './internlm';
import JinaProvider from './jina';
import KimiCodingPlanProvider from './kimiCodingPlan';
import LMStudioProvider from './lmstudio';
import LobeHubProvider from './lobehub';
import LongCatProvider from './longcat';
import MinimaxProvider from './minimax';
import MinimaxCodingPlanProvider from './minimaxCodingPlan';
import MistralProvider from './mistral';
import ModelScopeProvider from './modelscope';
import MoonshotProvider from './moonshot';
import NebiusProvider from './nebius';
import NewAPIProvider from './newapi';
import NovitaProvider from './novita';
import NvidiaProvider from './nvidia';
import OllamaProvider from './ollama';
import OllamaCloudProvider from './ollamacloud';
import OpenAIProvider from './openai';
import OpenRouterProvider from './openrouter';
import PerplexityProvider from './perplexity';
import PPIOProvider from './ppio';
import QiniuProvider from './qiniu';
import QwenProvider from './qwen';
import ReplicateProvider from './replicate';
import SambaNovaProvider from './sambanova';
import Search1APIProvider from './search1api';
import SenseNovaProvider from './sensenova';
import SiliconCloudProvider from './siliconcloud';
import SparkProvider from './spark';
import StepfunProvider from './stepfun';
import StraicoProvider from './straico';
import TaichuProvider from './taichu';
import TencentcloudProvider from './tencentcloud';
import TogetherAIProvider from './togetherai';
import UpstageProvider from './upstage';
import V0Provider from './v0';
import VercelAIGatewayProvider from './vercelaigateway';
import VertexAIProvider from './vertexai';
import VLLMProvider from './vllm';
import VolcengineProvider from './volcengine';
import VolcengineCodingPlanProvider from './volcengineCodingPlan';
import WenxinProvider from './wenxin';
import XAIProvider from './xai';
import XiaomiMiMoProvider from './xiaomimimo';
import XinferenceProvider from './xinference';
import ZenMuxProvider from './zenmux';
import ZeroOneProvider from './zeroone';
import ZhiPuProvider from './zhipu';

type ProviderRuntimeConfig = {
  defaultShowBrowserRequest?: boolean;
  disableBrowserRequest: boolean;
  responseAnimation?: unknown;
  sdkType?: string;
  supportResponsesApi?: boolean;
};

type ProviderCardWithRuntimeConfig = {
  defaultShowBrowserRequest?: boolean;
  disableBrowserRequest?: boolean;
  id: string;
  settings?: {
    defaultShowBrowserRequest?: boolean;
    disableBrowserRequest?: boolean;
    responseAnimation?: unknown;
    sdkType?: string;
    supportResponsesApi?: boolean;
  };
};

const providerCards = [
  ...(ENABLE_BUSINESS_FEATURES ? [LobeHubProvider] : []),
  AnthropicProvider,
  GoogleProvider,
  GLMCodingPlanProvider,
  KimiCodingPlanProvider,
  OpenAIProvider,
  DeepSeekProvider,
  XinferenceProvider,
  MoonshotProvider,
  BedrockProvider,
  BailianCodingPlanProvider,
  VertexAIProvider,
  AzureProvider,
  AzureAIProvider,
  AiHubMixProvider,
  OpenRouterProvider,
  FalProvider,
  OllamaProvider,
  OllamaCloudProvider,
  VLLMProvider,
  ComfyUIProvider,
  HuggingFaceProvider,
  CloudflareProvider,
  GithubProvider,
  GithubCopilotProvider,
  NewAPIProvider,
  BflProvider,
  NovitaProvider,
  PPIOProvider,
  Ai302Provider,
  NvidiaProvider,
  TogetherAIProvider,
  FireworksAIProvider,
  GroqProvider,
  PerplexityProvider,
  MistralProvider,
  ModelScopeProvider,
  Ai21Provider,
  UpstageProvider,
  XAIProvider,
  JinaProvider,
  SambaNovaProvider,
  CohereProvider,
  V0Provider,
  QwenProvider,
  WenxinProvider,
  TencentcloudProvider,
  HunyuanProvider,
  ZhiPuProvider,
  SiliconCloudProvider,
  ZeroOneProvider,
  SparkProvider,
  SenseNovaProvider,
  StepfunProvider,
  BaichuanProvider,
  VolcengineProvider,
  VolcengineCodingPlanProvider,
  MinimaxProvider,
  MinimaxCodingPlanProvider,
  LMStudioProvider,
  InternLMProvider,
  HigressProvider,
  GiteeAIProvider,
  TaichuProvider,
  Ai360Provider,
  Search1APIProvider,
  InfiniAIProvider,
  AkashChatProvider,
  QiniuProvider,
  ReplicateProvider,
  NebiusProvider,
  CometAPIProvider,
  VercelAIGatewayProvider,
  CerebrasProvider,
  ZenMuxProvider,
  StraicoProvider,
  XiaomiMiMoProvider,
  LongCatProvider,
] as const satisfies readonly ProviderCardWithRuntimeConfig[];

const createProviderRuntimeConfig = (
  provider: ProviderCardWithRuntimeConfig,
): ProviderRuntimeConfig => ({
  ...(provider.defaultShowBrowserRequest || provider.settings?.defaultShowBrowserRequest
    ? {
        defaultShowBrowserRequest:
          provider.defaultShowBrowserRequest || provider.settings?.defaultShowBrowserRequest,
      }
    : {}),
  disableBrowserRequest:
    !!provider.disableBrowserRequest || !!provider.settings?.disableBrowserRequest,
  ...(provider.settings?.responseAnimation
    ? { responseAnimation: provider.settings.responseAnimation }
    : {}),
  ...(provider.settings?.sdkType ? { sdkType: provider.settings.sdkType } : {}),
  ...(provider.settings?.supportResponsesApi
    ? { supportResponsesApi: provider.settings.supportResponsesApi }
    : {}),
});

export const PROVIDER_RUNTIME_CONFIG = Object.fromEntries(
  providerCards.map((provider) => [provider.id, createProviderRuntimeConfig(provider)]),
) as Record<string, ProviderRuntimeConfig>;

export const getProviderRuntimeConfig = (id: string) => PROVIDER_RUNTIME_CONFIG[id];

export const isProviderDisableBrowserRequest = (id: string) =>
  !!getProviderRuntimeConfig(id)?.disableBrowserRequest;
