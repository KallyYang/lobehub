import { isDesktop } from '@lobechat/const';
import { type MenuProps } from '@lobehub/ui';
import { ActionIcon, DropdownMenu, Flexbox, Text } from '@lobehub/ui';
import { Avatar } from 'antd';
import { cssVar } from 'antd-style';
import { ArrowRight, ChevronDown, ChevronRight, Plus, Unlink } from 'lucide-react';
import { type CSSProperties, useCallback, useState } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { modal, notification } from '@/components/AntdStaticMethods';
import AuthIcons from '@/components/AuthIcons';
import { isBuiltinProvider, normalizeProviderId } from '@/libs/better-auth/utils/client';
import { useServerConfigStore } from '@/store/serverConfig';
import { serverConfigSelectors } from '@/store/serverConfig/selectors';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';

const providerNameStyle: CSSProperties = {
  textTransform: 'capitalize',
};

/** Allowlisted OIDC profile claim keys to display in expanded details */
const VISIBLE_CLAIM_KEYS = new Set([
  'given_name',
  'family_name',
  'nickname',
  'preferred_username',
  'login', // GitHub username
  'email_verified',
  'phone_number',
  'phone_number_verified',
  'locale',
  'zoneinfo',
  'gender',
  'birthdate',
  'company',
  'location',
  'bio',
  'blog',
  'html_url',
  'profile', // profile URL
  'updated_at',
]);

const isUrl = (value: unknown): value is string =>
  typeof value === 'string' && (value.startsWith('https://') || value.startsWith('http://'));

/** Convert snake_case claim key to a readable label */
const formatClaimLabel = (key: string): string =>
  key.replaceAll('_', ' ').replaceAll(/\b\w/g, (c) => c.toUpperCase());

/** Format claim value for display */
const formatClaimValue = (key: string, value: unknown): string => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === 'updated_at' || key === 'created_at') {
    const date = new Date(value as string | number);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const breakAllStyle: CSSProperties = { wordBreak: 'break-all' };

export const SSOProvidersList = memo(() => {
  const isLogin = useUserStore(authSelectors.isLogin);
  const providers = useUserStore(authSelectors.authProviders);
  const hasPasswordAccount = useUserStore(authSelectors.hasPasswordAccount);
  const refreshAuthProviders = useUserStore((s) => s.refreshAuthProviders);
  const oAuthSSOProviders = useServerConfigStore(serverConfigSelectors.oAuthSSOProviders);
  const { t } = useTranslation('auth');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Allow unlink if user has multiple SSO providers OR has email/password login
  const allowUnlink = providers.length > 1 || hasPasswordAccount;
  const enableAuthActions = !isDesktop && isLogin;

  // Get linked provider IDs for filtering
  const linkedProviderIds = useMemo(() => {
    return new Set(providers.map((item) => item.provider));
  }, [providers]);

  // Get available providers for linking (filter out already linked)
  // Normalize provider IDs when comparing to handle aliases (e.g. microsoft-entra-id → microsoft)
  const availableProviders = useMemo(() => {
    return (oAuthSSOProviders || []).filter(
      (provider) => !linkedProviderIds.has(normalizeProviderId(provider)),
    );
  }, [oAuthSSOProviders, linkedProviderIds]);

  const handleUnlinkSSO = async (provider: string) => {
    // Better-auth link/unlink operations are not available on desktop
    if (isDesktop) return;

    // Prevent unlink if this is the only login method
    if (!allowUnlink) {
      notification.error({
        message: t('profile.sso.unlink.forbidden'),
      });
      return;
    }
    modal.confirm({
      content: t('profile.sso.unlink.description', { provider }),
      okButtonProps: {
        danger: true,
      },
      onOk: async () => {
        const { unlinkAccount } = await import('@/libs/better-auth/auth-client');
        await unlinkAccount({ providerId: provider });
        refreshAuthProviders();
      },
      title: <span style={providerNameStyle}>{t('profile.sso.unlink.title', { provider })}</span>,
    });
  };

  const handleLinkSSO = async (provider: string) => {
    if (!enableAuthActions) return;

    const normalizedProvider = normalizeProviderId(provider);
    const { linkSocial, oauth2 } = await import('@/libs/better-auth/auth-client');

    if (isBuiltinProvider(normalizedProvider)) {
      // Use better-auth native linkSocial API for built-in providers
      await linkSocial({
        callbackURL: '/profile',
        provider: normalizedProvider as any,
      });
      return;
    }

    await oauth2.link({
      callbackURL: '/profile',
      providerId: normalizedProvider,
    });
  };

  // Dropdown menu items for linking new providers
  const linkMenuItems: MenuProps['items'] = availableProviders.map((provider) => ({
    icon: AuthIcons(provider, 16),
    key: provider,
    label: <span style={providerNameStyle}>{provider}</span>,
    onClick: () => handleLinkSSO(provider),
  }));

  return (
    <Flexbox gap={8}>
      {providers.map((item) => {
        const itemKey = [item.provider, item.providerAccountId].join('-');
        const isExpanded = expandedKeys.has(itemKey);

        // Filter claims: only show allowlisted keys with non-empty values
        const visibleClaims = item.claims
          ? Object.entries(item.claims).filter(
              ([key, value]) =>
                VISIBLE_CLAIM_KEYS.has(key) &&
                value !== null &&
                value !== undefined &&
                value !== '',
            )
          : [];
        const hasDetails = visibleClaims.length > 0;

        return (
          <Flexbox gap={4} key={itemKey}>
            <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
              <Flexbox
                horizontal
                align={'center'}
                gap={6}
                style={{ cursor: hasDetails ? 'pointer' : undefined, fontSize: 12 }}
                onClick={hasDetails ? () => toggleExpand(itemKey) : undefined}
              >
                {hasDetails && (
                  <ActionIcon
                    icon={isExpanded ? ChevronDown : ChevronRight}
                    size={{ blockSize: 18 }}
                  />
                )}
                {AuthIcons(item.provider, 16)}
                {item.image && <Avatar size={20} src={item.image} />}
                <span style={providerNameStyle}>{item.provider}</span>
                {(item.email || item.name) && (
                  <Text fontSize={11} type="secondary">
                    ·{' '}
                    {item.name && item.email
                      ? `${item.name} (${item.email})`
                      : (item.name ?? item.email)}
                  </Text>
                )}
              </Flexbox>
              {!isDesktop && (
                <ActionIcon
                  disabled={!allowUnlink}
                  icon={Unlink}
                  size={'small'}
                  onClick={() => handleUnlinkSSO(item.provider)}
                />
              )}
            </Flexbox>

            {/* Expanded claims detail */}
            {isExpanded && hasDetails && (
              <Flexbox
                gap={6}
                style={{
                  background: cssVar.colorFillQuaternary,
                  borderRadius: 6,
                  fontSize: 12,
                  marginLeft: 18,
                  padding: '8px 12px',
                }}
              >
                {visibleClaims.map(([key, value]) => (
                  <Flexbox horizontal align={'baseline'} gap={8} key={key}>
                    <Text fontSize={11} style={{ flexShrink: 0, minWidth: 100 }} type="secondary">
                      {formatClaimLabel(key)}
                    </Text>
                    {isUrl(value) ? (
                      <a
                        href={value}
                        rel="noopener noreferrer"
                        style={breakAllStyle}
                        target="_blank"
                      >
                        <Text fontSize={11}>{value}</Text>
                      </a>
                    ) : (
                      <Text fontSize={11} style={breakAllStyle}>
                        {formatClaimValue(key, value)}
                      </Text>
                    )}
                  </Flexbox>
                ))}
              </Flexbox>
            )}
          </Flexbox>
        );
      })}

      {/* Link Account Button - Only show for logged in users with available providers */}
      {enableAuthActions && availableProviders.length > 0 && (
        <DropdownMenu items={linkMenuItems} popupProps={{ style: { maxWidth: '200px' } }}>
          <Flexbox horizontal align={'center'} gap={6} style={{ cursor: 'pointer', fontSize: 12 }}>
            <Plus size={14} />
            <span>{t('profile.sso.link.button')}</span>
            <ArrowRight size={14} />
          </Flexbox>
        </DropdownMenu>
      )}
    </Flexbox>
  );
});

export default SSOProvidersList;
