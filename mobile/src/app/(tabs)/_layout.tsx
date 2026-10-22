import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, useSegments } from 'expo-router';
import { ScrollTabBarProvider } from '../../context/ScrollTabBarContext';
import { ScreenGestureWrapper } from '../../components/ScreenGestureWrapper';
import { InstagramTabPager, getSavedActiveTab } from '../../components/InstagramTabPager';

export default function TabLayout() {
  const segments = useSegments();
  const routeTab = segments[1] as string | undefined;
  const currentTab = routeTab || getSavedActiveTab() || 'index';

  const isNestedScreen = currentTab === 'trainees' || currentTab === 'calendar';

  return (
    <ScrollTabBarProvider>
      {isNestedScreen ? (
        <ScreenGestureWrapper
          currentTab={currentTab}
          enableTabSwipe={false}
          enableBackSwipe={true}
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
