import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { ScreenGestureWrapper } from '../../components/ScreenGestureWrapper';
import { InstagramTabPager, TAB_ORDER, TabName, getSavedActiveTab, setSavedActiveTab } from '../../components/InstagramTabPager';

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();
  const routeTab = segments[1] as string | undefined;

  const isNestedScreen = routeTab === 'calendar';
  const activeTab = (routeTab && routeTab !== 'index' && TAB_ORDER.includes(routeTab as any))
    ? (routeTab as TabName)
    : getSavedActiveTab();

  const handleNestedBack = () => {
    if (routeTab === 'calendar') {
      setSavedActiveTab('index');
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return isNestedScreen ? (
    <ScreenGestureWrapper
      currentTab={routeTab}
      enableTabSwipe={false}
      enableBackSwipe={true}
      onBack={handleNestedBack}
    >
      <View style={styles.container}>
        <Slot />
      </View>
    </ScreenGestureWrapper>
  ) : (
    <InstagramTabPager initialTab={activeTab} />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
