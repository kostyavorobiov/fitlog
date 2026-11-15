import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { UserRole } from '../types/workout';

export const LoginScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { loginWithGoogle, loginWithEmail, registerWithEmail, loginAsDemo } = useAuth();
  const isCloudConnected = isSupabaseConfigured();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<UserRole>('athlete');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle Google OAuth
  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const res = await loginWithGoogle();
      if (!res.success && res.error) {
        setErrorMessage(res.error);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Помилка Google авторизації');
    } finally {
      setLoading(false);
    }
  };

  // Handle Email Login / Register
  const handleEmailSubmit = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Вкажіть email та пароль');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await loginWithEmail(email, password);
        if (!res.success && res.error) {
          setErrorMessage(res.error);
        }
      } else {
        if (!firstName.trim()) {
          setErrorMessage('Введіть ваше ім’я');
          setLoading(false);
          return;
        }
        const res = await registerWithEmail(email, password, firstName, lastName, role);
        if (!res.success && res.error) {
          setErrorMessage(res.error);
        }
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Помилка авторизації');
    } finally {
      setLoading(false);
    }
  };

  // Handle Quick Demo Login
  const handleDemoLogin = async (type: 'admin' | 'athlete' | 'coach') => {
    setErrorMessage(null);
    setLoading(true);
    try {
      await loginAsDemo(type);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Помилка демо-входу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Header */}
          <View style={styles.brandHeader}>
            <View style={[styles.logoCircle, { backgroundColor: colors.subCard, borderColor: colors.subCardBorder, borderWidth: 1 }]}>
              <Ionicons name="barbell" size={36} color={colors.accent} />
            </View>
            <Text style={[styles.brandTitle, { color: colors.text }]}>
              FitLog
            </Text>
            <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
              {t('auth.subtitle')}
            </Text>

            {/* Cloud Status Badge */}
            <View
              style={[
                styles.cloudBadge,
                isCloudConnected ? styles.cloudBadgeOnline : styles.cloudBadgeOffline,
              ]}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: isCloudConnected ? colors.success : colors.textSecondary },
                ]}
              />
              <Text
                style={[
                  styles.cloudBadgeText,
                  { color: isCloudConnected ? colors.success : colors.textSecondary },
                ]}
              >
                {isCloudConnected ? 'Supabase Cloud зв’язок готовий' : 'Офлайн / Тестовий режим'}
              </Text>
            </View>
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Google Sign In Card */}
          <Card style={styles.card}>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={loading}
              onPress={handleGoogleLogin}
              style={[styles.googleButton, { backgroundColor: colors.subCard, borderColor: colors.subCardBorder, borderWidth: 1 }]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={22} color="#ea4335" />
                  <Text style={[styles.googleText, { color: colors.text }]}>
                    {t('auth.google_signin')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={[styles.line, { backgroundColor: colors.cardBorder }]} />
              <Text style={[styles.dividerText, { color: colors.textSecondary }]}>
                {t('auth.or_email')}
              </Text>
              <View style={[styles.line, { backgroundColor: colors.cardBorder }]} />
            </View>

            {/* Auth Mode Toggle */}
            <View style={[styles.toggleContainer, { backgroundColor: colors.subCard, borderColor: colors.subCardBorder }]}>
              <TouchableOpacity
                onPress={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                style={[styles.toggleBtn, mode === 'login' && { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    mode === 'login' ? { color: colors.text, fontWeight: '700' } : { color: colors.textSecondary },
                  ]}
                >
                  {t('auth.title_login')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setMode('register');
                  setErrorMessage(null);
                }}
                style={[styles.toggleBtn, mode === 'register' && { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    mode === 'register' ? { color: colors.text, fontWeight: '700' } : { color: colors.textSecondary },
                  ]}
                >
                  {t('auth.title_register')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Registration Extra Fields */}
            {mode === 'register' && (
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {t('auth.first_name')}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.subCard, borderColor: colors.subCardBorder, color: colors.text }]}
                    placeholder={t('auth.first_name_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {t('auth.last_name')}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.subCard, borderColor: colors.subCardBorder, color: colors.text }]}
                    placeholder={t('auth.last_name_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>
            )}

            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {t('auth.email')}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.subCard, borderColor: colors.subCardBorder, color: colors.text }]}
                placeholder="athlete@example.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {t('auth.password')}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.subCard, borderColor: colors.subCardBorder, color: colors.text }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {/* Role Select for Registration */}
            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  {t('auth.role')}
                </Text>
                <View style={styles.roleRow}>
                  <TouchableOpacity
                    onPress={() => setRole('athlete')}
                    style={[
                      styles.roleChip,
                      role === 'athlete'
                        ? { backgroundColor: colors.accent, borderColor: colors.accent }
                        : { backgroundColor: colors.subCard, borderColor: colors.subCardBorder },
                    ]}
                  >
                    <Ionicons
                      name="fitness"
                      size={16}
                      color={role === 'athlete' ? colors.accentText : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.roleChipText,
                        role === 'athlete'
                          ? { color: colors.accentText, fontWeight: '700' }
                          : { color: colors.textSecondary },
                      ]}
                    >
                      {t('auth.role_athlete')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setRole('coach')}
                    style={[
                      styles.roleChip,
                      role === 'coach'
                        ? { backgroundColor: colors.accent, borderColor: colors.accent }
                        : { backgroundColor: colors.subCard, borderColor: colors.subCardBorder },
                    ]}
                  >
                    <Ionicons
                      name="people"
                      size={16}
                      color={role === 'coach' ? colors.accentText : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.roleChipText,
                        role === 'coach'
                          ? { color: colors.accentText, fontWeight: '700' }
                          : { color: colors.textSecondary },
                      ]}
                    >
                      {t('auth.role_coach')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Button
              title={mode === 'login' ? t('auth.btn_login') : t('auth.create_account')}
              loading={loading}
              onPress={handleEmailSubmit}
              style={{ marginTop: 8 }}
            />
          </Card>

          {/* Quick Demo Test Section */}
          <Card style={[styles.card, styles.demoCard]}>
            <View style={styles.demoHeader}>
              <Ionicons name="flash" size={18} color="#eab308" />
              <Text style={[styles.demoTitle, isDark ? styles.textDark : styles.textLight]}>
                Швидкий вхід (для розробки та тестів)
              </Text>
            </View>
            <Text style={[styles.demoSub, isDark ? styles.subDark : styles.subLight]}>
              Вхід безпосередньо з тестовим профілем без підтвердження пошти:
            </Text>

            <View style={styles.demoButtonsRow}>
              <TouchableOpacity
                onPress={() => handleDemoLogin('admin')}
                style={[styles.demoBtn, isDark ? styles.demoBtnDark : styles.demoBtnLight]}
              >
                <Ionicons name="shield-checkmark" size={16} color={isDark ? '#60a5fa' : '#2563eb'} />
                <Text style={[styles.demoBtnText, isDark ? styles.textDark : styles.textLight]}>
                  Костянтин (Адмін)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDemoLogin('athlete')}
                style={[styles.demoBtn, isDark ? styles.demoBtnDark : styles.demoBtnLight]}
              >
                <Ionicons name="barbell-outline" size={16} color={isDark ? '#60a5fa' : '#2563eb'} />
                <Text style={[styles.demoBtnText, isDark ? styles.textDark : styles.textLight]}>
                  Атлет Demo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDemoLogin('coach')}
                style={[styles.demoBtn, isDark ? styles.demoBtnDark : styles.demoBtnLight]}
              >
                <Ionicons name="school-outline" size={16} color={isDark ? '#60a5fa' : '#2563eb'} />
                <Text style={[styles.demoBtnText, isDark ? styles.textDark : styles.textLight]}>
                  Тренер Demo
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgLight: {
    backgroundColor: '#f8fafc',
  },
  bgDark: {
    backgroundColor: '#0b1220',
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  brandHeader: {
    alignItems: 'center',
    marginVertical: 12,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  logoDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  cloudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginTop: 10,
  },
  cloudBadgeOnline: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  cloudBadgeOffline: {
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
  },
  cloudBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: 12,
    borderRadius: 14,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    flex: 1,
  },
  card: {
    padding: 18,
    gap: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  googleLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  googleDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
  },
  googleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  line: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
  },
  toggleLight: {
    backgroundColor: '#f1f5f9',
  },
  toggleDark: {
    backgroundColor: '#263140',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: '#2563eb',
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: '#ffffff',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    color: '#0f172a',
  },
  inputDark: {
    backgroundColor: '#0b1220',
    borderColor: '#334155',
    color: '#f8fafc',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleChipActive: {
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  chipLight: {
    borderColor: '#e2e8f0',
  },
  chipDark: {
    borderColor: '#334155',
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  roleChipTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  demoCard: {
    borderStyle: 'dashed',
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  demoSub: {
    fontSize: 12,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  demoBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  demoBtnDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
  },
  demoBtnText: {
    fontSize: 12,
    fontWeight: '500',
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
  borderLight: {
    borderColor: '#e2e8f0',
  },
  borderDark: {
    borderColor: '#334155',
  },
});
