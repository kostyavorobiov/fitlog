import React from 'react';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

export default function NotFoundScreen() {
  const isDark = useColorScheme() === 'dark';

  return (
    <>
      <Stack.Screen options={{ title: 'Не знайдено' }} />
      <View style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
        <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>
          Цієї сторінки не існує
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Повернутися до тренувань</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  bgLight: {
    backgroundColor: '#fafafa',
  },
  bgDark: {
    backgroundColor: '#09090b',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  textLight: {
    color: '#09090b',
  },
  textDark: {
    color: '#fafafa',
  },
  link: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
});
