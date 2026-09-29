import React from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { MUSCLE_GROUPS, MuscleGroup } from '../types/workout';

export const ExercisesScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}
    >
      <Header
        title="База вправ"
        subtitle="Каталог та власні вправи"
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
        <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
          М'язові групи
        </Text>

        <View style={styles.grid}>
          {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((groupKey) => {
            const info = MUSCLE_GROUPS[groupKey];
            return (
              <Card key={groupKey} style={styles.groupCard}>
                <View
                  style={[
                    styles.colorDot,
                    { backgroundColor: info.color },
                  ]}
                />
                <Text style={[styles.groupName, isDark ? styles.textDark : styles.textLight]}>
                  {info.nameUk}
                </Text>
              </Card>
            );
          })}
        </View>

        <Card style={styles.syncCard}>
          <Text style={[styles.syncTitle, isDark ? styles.textDark : styles.textLight]}>
            Каталог готовий до синхронізації
          </Text>
          <Text style={[styles.syncDesc, isDark ? styles.subDark : styles.subLight]}>
            Глобальні та власні вправи будуть завантажені з бази даних при підключенні сервісу.
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  groupCard: {
    width: '48%',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  groupName: {
    fontSize: 13,
    fontWeight: '600',
  },
  syncCard: {
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  syncTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  syncDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
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
