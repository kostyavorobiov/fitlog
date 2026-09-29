import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, rightAction }) => {
  const isDark = useColorScheme() === 'dark';

  return (
    <View style={[styles.container, isDark ? styles.borderDark : styles.borderLight]}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, isDark ? styles.subDark : styles.subLight]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightAction ? <View style={styles.actionContainer}>{rightAction}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  borderLight: {
    borderBottomColor: '#f4f4f5',
  },
  borderDark: {
    borderBottomColor: '#27272a',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  textLight: {
    color: '#09090b',
  },
  textDark: {
    color: '#fafafa',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  subLight: {
    color: '#71717a',
  },
  subDark: {
    color: '#a1a1aa',
  },
  actionContainer: {
    marginLeft: 12,
  },
});
