import React from 'react';
import { View, StyleSheet, ViewProps, useColorScheme } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, style, ...props }) => {
  const isDark = useColorScheme() === 'dark';

  return (
    <View
      style={[
        styles.card,
        isDark ? styles.cardDark : styles.cardLight,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e7',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
});
