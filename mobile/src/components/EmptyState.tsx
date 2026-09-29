import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'barbell-outline',
  title,
  description,
  actionTitle,
  onAction,
}) => {
  const isDark = useColorScheme() === 'dark';

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, isDark ? styles.iconCircleDark : styles.iconCircleLight]}>
        <Ionicons name={icon} size={32} color={isDark ? '#e4e4e7' : '#27272a'} />
      </View>
      <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>{title}</Text>
      <Text style={[styles.description, isDark ? styles.subDark : styles.subLight]}>
        {description}
      </Text>
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCircleLight: {
    backgroundColor: '#f4f4f5',
  },
  iconCircleDark: {
    backgroundColor: '#27272a',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  textLight: {
    color: '#09090b',
  },
  textDark: {
    color: '#fafafa',
  },
  subLight: {
    color: '#71717a',
  },
  subDark: {
    color: '#a1a1aa',
  },
  button: {
    marginTop: 20,
    minWidth: 160,
  },
});
