import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  useColorScheme as useRNColorScheme,
} from 'react-native';
import { useAppColorScheme } from '../context/ThemeContext';

export type UserAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface UserAvatarProps {
  src?: string | null;
  image?: string | null;
  alt?: string;
  name?: string;
  size?: UserAvatarSize | number;
  onPress?: () => void;
  style?: any;
}

const SIZE_MAP: Record<UserAvatarSize, { dimension: number; fontSize: number }> = {
  xs: { dimension: 24, fontSize: 9 },
  sm: { dimension: 34, fontSize: 12 },
  md: { dimension: 40, fontSize: 14 },
  lg: { dimension: 56, fontSize: 18 },
  xl: { dimension: 80, fontSize: 26 },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  image,
  size = 'md',
  onPress,
  style,
}) => {
  const scheme = useAppColorScheme();
  const isDark = scheme === 'dark';
  const [imageError, setImageError] = useState(false);

  const resolvedSrc = src || image;
  const hasValidImage = Boolean(
    resolvedSrc &&
    typeof resolvedSrc === 'string' &&
    resolvedSrc.trim().length > 0 &&
    !imageError
  );

  const sizeInfo =
    typeof size === 'number'
      ? { dimension: size, fontSize: Math.max(10, Math.round(size * 0.35)) }
      : SIZE_MAP[size] || SIZE_MAP.md;

  const avatarContent = hasValidImage ? (
    <Image
      source={{ uri: resolvedSrc! }}
      style={{
        width: sizeInfo.dimension,
        height: sizeInfo.dimension,
        borderRadius: sizeInfo.dimension / 2,
      }}
      onError={() => setImageError(true)}
      resizeMode="cover"
    />
  ) : (
    <View
      style={[
        styles.fallbackContainer,
        {
          width: sizeInfo.dimension,
          height: sizeInfo.dimension,
          borderRadius: sizeInfo.dimension / 2,
        },
        isDark ? styles.fallbackDark : styles.fallbackLight,
      ]}
    >
      <Text
        style={[
          styles.fallbackText,
          { fontSize: sizeInfo.fontSize },
          isDark ? styles.fallbackTextDark : styles.fallbackTextLight,
        ]}
      >
        WD
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[
          styles.touchable,
          {
            width: sizeInfo.dimension,
            height: sizeInfo.dimension,
            borderRadius: sizeInfo.dimension / 2,
          },
          isDark ? styles.touchableDark : styles.touchableLight,
          style,
        ]}
      >
        {avatarContent}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: sizeInfo.dimension,
          height: sizeInfo.dimension,
          borderRadius: sizeInfo.dimension / 2,
        },
        style,
      ]}
    >
      {avatarContent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchable: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  touchableLight: {
    borderColor: '#e4e4e7',
  },
  touchableDark: {
    borderColor: '#3f3f46',
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fallbackLight: {
    backgroundColor: '#f4f4f5',
    borderColor: '#d4d4d8',
  },
  fallbackDark: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
  },
  fallbackText: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  fallbackTextLight: {
    color: '#18181b',
  },
  fallbackTextDark: {
    color: '#fafafa',
  },
});
