import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { ScrollTabBarProvider } from '../../context/ScrollTabBarContext';
import { ScreenGestureWrapper } from '../../components/ScreenGestureWrapper';
import { InstagramTabPager, getSavedActiveTab, setSavedActiveTab } from '../../components/InstagramTabPager';

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();
  const routeTab = segments[1] as string | undefined;
  const currentTab = routeTab || getSavedActiveTab() || 'index';

  const isNestedScreen = currentTab === 'trainees' || currentTab === 'calendar';

  const handleNestedBack = () => {
    if (currentTab === 'trainees') {
      setSavedActiveTab('profile');
      router.replace('/(tabs)/profile');
    } else if (currentTab === 'calendar') {
      setSavedActiveTab('index');
      router.replace('/(tabs)');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <ScrollTabBarProvider>
      {isNestedScreen ? (
        <ScreenGestureWrapper
          currentTab={currentTab}
          enableTabSwipe={false}
          enableBackSwipe={true}
          onBack={handleNestedBack}
        >
          <View style={styles.container}>
            <Slot />
          </View>
        </ScreenGestureWrapper>
      ) : (
        <InstagramTabPager initialTab={currentTab} />
      )}
    </ScrollTabBarProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
