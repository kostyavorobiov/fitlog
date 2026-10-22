import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  ...props
}) => {
  const isDark = useColorScheme() === 'dark';

  const getContainerStyle = () => {
    switch (variant) {
      case 'primary':
        return isDark ? styles.primaryDark : styles.primaryLight;
      case 'secondary':
        return isDark ? styles.secondaryDark : styles.secondaryLight;
      case 'outline':
        return isDark ? styles.outlineDark : styles.outlineLight;
      case 'danger':
        return styles.danger;
      default:
        return styles.primaryLight;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return isDark ? styles.textPrimaryDark : styles.textPrimaryLight;
      case 'secondary':
        return isDark ? styles.textSecondaryDark : styles.textSecondaryLight;
      case 'outline':
        return isDark ? styles.textOutlineDark : styles.textOutlineLight;
      case 'danger':
        return styles.textDanger;
      default:
        return styles.textPrimaryLight;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled || loading}
      style={[
        styles.base,
        getContainerStyle(),
        (disabled || loading) && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#ffffff' : (isDark ? '#94A3B8' : '#64748B')}
        />
      ) : (
        <Text style={[styles.textBase, getTextStyle()]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  textBase: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryLight: {
    backgroundColor: '#2563EB',
  },
  primaryDark: {
    backgroundColor: '#2563EB',
  },
  textPrimaryLight: {
    color: '#ffffff',
  },
  textPrimaryDark: {
    color: '#ffffff',
  },
  secondaryLight: {
    backgroundColor: '#F1F5F9',
  },
  secondaryDark: {
    backgroundColor: '#263140',
  },
  textSecondaryLight: {
    color: '#0F172A',
  },
  textSecondaryDark: {
    color: '#F8FAFC',
  },
  outlineLight: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: 'transparent',
  },
  outlineDark: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'transparent',
  },
  textOutlineLight: {
    color: '#0F172A',
  },
  textOutlineDark: {
    color: '#F8FAFC',
  },
  danger: {
    backgroundColor: '#ef4444',
  },
  textDanger: {
    color: '#ffffff',
  },
});
