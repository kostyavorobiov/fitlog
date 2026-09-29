import React from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { Button } from '../components/Button';

export const WorkoutsScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}
    >
      <Header
        title="Тренування"
        subtitle="Workout Diary Mobile"
        rightAction={
          <Button
            title="+ Додати"
            variant="primary"
            style={styles.addButton}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banner */}
        <Card style={styles.bannerCard}>
          <View style={styles.bannerRow}>
            <View style={styles.bannerIcon}>
              <Ionicons name="barbell-outline" size={24} color="#f59e0b" />
            </View>
            <View style={styles.bannerText}>
              <Text style={[styles.bannerTitle, isDark ? styles.textDark : styles.textLight]}>
                Мобільний клієнт підготовлено
              </Text>
              <Text style={[styles.bannerSub, isDark ? styles.subDark : styles.subLight]}>
                Базова архітектура готова до синхронізації з вебверсією
              </Text>
            </View>
          </View>
        </Card>

        {/* Stats card */}
        <View style={styles.statsRow}>
          <Card style={styles.statBox}>
            <Text style={[styles.statValue, isDark ? styles.textDark : styles.textLight]}>0</Text>
            <Text style={[styles.statLabel, isDark ? styles.subDark : styles.subLight]}>Цього тижня</Text>
          </Card>
          <Card style={styles.statBox}>
            <Text style={[styles.statValue, isDark ? styles.textDark : styles.textLight]}>0</Text>
            <Text style={[styles.statLabel, isDark ? styles.subDark : styles.subLight]}>Всього тренувань</Text>
          </Card>
        </View>

        {/* Placeholder state */}
        <Card style={styles.emptyCard}>
          <Ionicons
            name="calendar-outline"
            size={40}
            color={isDark ? '#71717a' : '#a1a1aa'}
            style={styles.emptyIcon}
          />
          <Text style={[styles.emptyTitle, isDark ? styles.textDark : styles.textLight]}>
            Список тренувань порожній
          </Text>
          <Text style={[styles.emptyDesc, isDark ? styles.subDark : styles.subLight]}>
            Тут відображатимуться ваші заплановані та виконані тренування після підключення даних.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgLight: {
    backgroundColor: '#fafafa',
  },
  bgDark: {
    backgroundColor: '#09090b',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  addButton: {
    height: 36,
    paddingHorizontal: 12,
  },
  bannerCard: {
    padding: 16,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  bannerSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
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
});
