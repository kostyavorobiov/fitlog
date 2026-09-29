import { Href, useRouter } from 'expo-router';

export type AppNavigationHref = Href;

export function useAppNavigation() {
  const router = useRouter();

  return {
    navigate: (href: AppNavigationHref) => router.push(href),
    replace: (href: AppNavigationHref) => router.replace(href),
    back: () => router.back(),
    canGoBack: () => router.canGoBack(),
  };
}
