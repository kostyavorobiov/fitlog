import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
  useColorScheme,
} from 'react-native';

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
          color={variant === 'primary' ? (isDark ? '#09090b' : '#ffffff') : '#71717a'}
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
    borderRadius: 10,
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
    backgroundColor: '#18181b',
  },
  primaryDark: {
    backgroundColor: '#f4f4f5',
  },
  textPrimaryLight: {
    color: '#ffffff',
  },
  textPrimaryDark: {
    color: '#09090b',
  },
  secondaryLight: {
    backgroundColor: '#f4f4f5',
  },
  secondaryDark: {
    backgroundColor: '#27272a',
  },
  textSecondaryLight: {
    color: '#18181b',
  },
  textSecondaryDark: {
    color: '#f4f4f5',
  },
  outlineLight: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    backgroundColor: 'transparent',
  },
  outlineDark: {
    borderWidth: 1,
    borderColor: '#3f3f46',
    backgroundColor: 'transparent',
  },
  textOutlineLight: {
    color: '#18181b',
  },
  textOutlineDark: {
    color: '#f4f4f5',
  },
  danger: {
    backgroundColor: '#ef4444',
  },
  textDanger: {
    color: '#ffffff',
  },
});
