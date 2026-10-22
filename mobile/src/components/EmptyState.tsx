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
        <Ionicons name={icon} size={32} color={isDark ? '#60a5fa' : '#2563eb'} />
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
    backgroundColor: '#f1f5f9',
  },
  iconCircleDark: {
    backgroundColor: '#1d2939',
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
    color: '#0f172a',
  },
  textDark: {
    color: '#f8fafc',
  },
  subLight: {
    color: '#64748b',
  },
  subDark: {
    color: '#94a3b8',
  },
  button: {
    marginTop: 20,
    minWidth: 160,
  },
});
