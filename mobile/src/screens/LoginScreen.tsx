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
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { UserRole } from '../types/workout';

export const LoginScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
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
    <SafeAreaView style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
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
            <View style={[styles.logoCircle, isDark ? styles.logoDark : styles.logoLight]}>
              <Ionicons name="barbell" size={36} color={isDark ? '#38bdf8' : '#0284c7'} />
            </View>
            <Text style={[styles.brandTitle, isDark ? styles.textDark : styles.textLight]}>
              Workout Diary
            </Text>
            <Text style={[styles.brandSubtitle, isDark ? styles.subDark : styles.subLight]}>
              Щоденник тренувань та синхронізація
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
                  { backgroundColor: isCloudConnected ? '#10b981' : '#f59e0b' },
                ]}
              />
              <Text
                style={[
                  styles.cloudBadgeText,
                  { color: isCloudConnected ? '#10b981' : '#f59e0b' },
                ]}
              >
                {isCloudConnected ? 'Supabase Cloud зв’язок готовий' : 'Офлайн / Тестовий режим'}
              </Text>
            </View>
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Google Sign In Card */}
          <Card style={styles.card}>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={loading}
              onPress={handleGoogleLogin}
              style={[styles.googleButton, isDark ? styles.googleDark : styles.googleLight]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={isDark ? '#ffffff' : '#000000'} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={22} color="#ea4335" />
                  <Text style={[styles.googleText, isDark ? styles.textDark : styles.textLight]}>
                    Увійти через Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={[styles.line, isDark ? styles.borderDark : styles.borderLight]} />
              <Text style={[styles.dividerText, isDark ? styles.subDark : styles.subLight]}>
                або через email
              </Text>
              <View style={[styles.line, isDark ? styles.borderDark : styles.borderLight]} />
            </View>

            {/* Auth Mode Toggle */}
            <View style={[styles.toggleContainer, isDark ? styles.toggleDark : styles.toggleLight]}>
              <TouchableOpacity
                onPress={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    mode === 'login' ? styles.toggleBtnTextActive : (isDark ? styles.subDark : styles.subLight),
                  ]}
                >
                  Вхід
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setMode('register');
                  setErrorMessage(null);
                }}
                style={[styles.toggleBtn, mode === 'register' && styles.toggleBtnActive]}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    mode === 'register' ? styles.toggleBtnTextActive : (isDark ? styles.subDark : styles.subLight),
                  ]}
                >
                  Реєстрація
                </Text>
              </TouchableOpacity>
            </View>

            {/* Registration Extra Fields */}
            {mode === 'register' && (
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
                    Ім’я
                  </Text>
                  <TextInput
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                    placeholder="Іван"
                    placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
                    Прізвище
                  </Text>
                  <TextInput
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                    placeholder="Франко"
                    placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>
            )}

            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
                Email
              </Text>
              <TextInput
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="athlete@example.com"
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
                Пароль
              </Text>
              <TextInput
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="••••••••"
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {/* Role Select for Registration */}
            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
                  Ваша роль
                </Text>
                <View style={styles.roleRow}>
                  <TouchableOpacity
                    onPress={() => setRole('athlete')}
                    style={[
                      styles.roleChip,
                      role === 'athlete' && styles.roleChipActive,
                      isDark ? styles.chipDark : styles.chipLight,
                    ]}
                  >
                    <Ionicons
                      name="fitness"
                      size={16}
                      color={role === 'athlete' ? '#0284c7' : (isDark ? '#a1a1aa' : '#71717a')}
                    />
                    <Text
                      style={[
                        styles.roleChipText,
                        role === 'athlete' && styles.roleChipTextActive,
                        isDark ? styles.textDark : styles.textLight,
                      ]}
                    >
                      Атлет
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setRole('coach')}
                    style={[
                      styles.roleChip,
                      role === 'coach' && styles.roleChipActive,
                      isDark ? styles.chipDark : styles.chipLight,
                    ]}
                  >
                    <Ionicons
                      name="people"
                      size={16}
                      color={role === 'coach' ? '#0284c7' : (isDark ? '#a1a1aa' : '#71717a')}
                    />
                    <Text
                      style={[
                        styles.roleChipText,
                        role === 'coach' && styles.roleChipTextActive,
                        isDark ? styles.textDark : styles.textLight,
                      ]}
                    >
                      Тренер
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Button
              title={mode === 'login' ? 'Увійти' : 'Створити акаунт'}
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
                <Ionicons name="shield-checkmark" size={16} color="#38bdf8" />
                <Text style={[styles.demoBtnText, isDark ? styles.textDark : styles.textLight]}>
                  Костянтин (Адмін)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDemoLogin('athlete')}
                style={[styles.demoBtn, isDark ? styles.demoBtnDark : styles.demoBtnLight]}
              >
                <Ionicons name="barbell-outline" size={16} color="#10b981" />
                <Text style={[styles.demoBtnText, isDark ? styles.textDark : styles.textLight]}>
                  Атлет Demo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDemoLogin('coach')}
                style={[styles.demoBtn, isDark ? styles.demoBtnDark : styles.demoBtnLight]}
              >
                <Ionicons name="school-outline" size={16} color="#a855f7" />
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
    backgroundColor: '#09090b',
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
    backgroundColor: '#e0f2fe',
  },
  logoDark: {
    backgroundColor: '#0c4a6e',
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
    borderRadius: 12,
    marginTop: 10,
  },
  cloudBadgeOnline: {
    backgroundColor: '#ecfdf5',
  },
  cloudBadgeOffline: {
    backgroundColor: '#fffbeb',
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
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    color: '#b91c1c',
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
    borderRadius: 10,
    borderWidth: 1,
  },
  googleLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  googleDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
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
    borderRadius: 8,
  },
  toggleLight: {
    backgroundColor: '#f1f5f9',
  },
  toggleDark: {
    backgroundColor: '#18181b',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#0284c7',
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
    borderRadius: 8,
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
    backgroundColor: '#18181b',
    borderColor: '#27272a',
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
    borderRadius: 8,
    borderWidth: 1,
  },
  roleChipActive: {
    borderColor: '#0284c7',
    backgroundColor: '#e0f2fe20',
  },
  chipLight: {
    borderColor: '#e2e8f0',
  },
  chipDark: {
    borderColor: '#27272a',
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  roleChipTextActive: {
    color: '#0284c7',
    fontWeight: '600',
  },
  demoCard: {
    backgroundColor: '#f8fafc50',
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
    borderRadius: 8,
    borderWidth: 1,
  },
  demoBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  demoBtnDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
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
    borderColor: '#27272a',
  },
});
