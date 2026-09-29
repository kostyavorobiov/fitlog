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
import { Header } from '../components/Header';
import { Card } from '../components/Card';

export const CalendarScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';

  const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}
    >
      <Header title="Календар" subtitle="Графік тренувань" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Calendar strip preview */}
        <Card style={styles.calendarCard}>
          <View style={styles.weekRow}>
            {daysOfWeek.map((day, idx) => (
              <View key={day} style={styles.dayCol}>
                <Text style={[styles.dayLabel, isDark ? styles.subDark : styles.subLight]}>
                  {day}
                </Text>
                <View
                  style={[
                    styles.dayCircle,
                    idx === 1 && (isDark ? styles.dayCircleActiveDark : styles.dayCircleActiveLight),
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      idx === 1
                        ? (isDark ? styles.textPrimaryDark : styles.textPrimaryLight)
                        : (isDark ? styles.textDark : styles.textLight),
                    ]}
                  >
                    {29 + idx > 30 ? (29 + idx) % 30 : 29 + idx}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Planned workouts */}
        <Card style={styles.emptyCard}>
          <Ionicons
            name="calendar-clear-outline"
            size={40}
            color={isDark ? '#71717a' : '#a1a1aa'}
            style={styles.emptyIcon}
          />
          <Text style={[styles.emptyTitle, isDark ? styles.textDark : styles.textLight]}>
            На сьогодні тренувань немає
          </Text>
          <Text style={[styles.emptyDesc, isDark ? styles.subDark : styles.subLight]}>
            Тут відображатиметься ваш розклад та історія за днями тижня.
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
  calendarCard: {
    padding: 16,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    alignItems: 'center',
    gap: 8,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActiveLight: {
    backgroundColor: '#18181b',
  },
  dayCircleActiveDark: {
    backgroundColor: '#f4f4f5',
  },
  dayNum: {
    fontSize: 14,
    fontWeight: '700',
  },
  textPrimaryLight: {
    color: '#ffffff',
  },
  textPrimaryDark: {
    color: '#09090b',
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
