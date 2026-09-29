import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

interface CreateWorkoutModalProps {
  visible: boolean;
  initialDate?: string;
  onClose: () => void;
  onSubmit: (title: string, scheduledDate: string, notes: string) => Promise<void> | void;
  isLoading?: boolean;
}

const TITLE_PRESETS = [
  'Груди та Тріцепс',
  'Спина та Біцепс',
  'День ніг',
  'Плечі та Прес',
  'Full Body',
  'Кардіо + Кор',
];

import { formatLocalDate } from '../utils/date';

export { formatLocalDate };

export const CreateWorkoutModal: React.FC<CreateWorkoutModalProps> = ({
  visible,
  initialDate,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const isDark = useColorScheme() === 'dark';

  const [title, setTitle] = useState<string>('');
  const [date, setDate] = useState<string>(initialDate || formatLocalDate());
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDate(initialDate || formatLocalDate());
      setNotes('');
    }
  }, [visible, initialDate]);

  const handleSubmit = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert('Помилка', 'Введіть назву тренування');
      return;
    }

    const cleanDate = date.trim() || formatLocalDate();
    await onSubmit(cleanTitle, cleanDate, notes.trim());
  };

  const setOffsetDate = (offsetDays: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    setDate(formatLocalDate(dt));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalContent, isDark ? styles.modalDark : styles.modalLight]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, isDark ? styles.textDark : styles.textLight]}>
                Нове тренування
              </Text>
              <Text style={[styles.modalSub, isDark ? styles.subDark : styles.subLight]}>
                Оберіть назву та дату запланованого тренування
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={isDark ? '#a1a1aa' : '#71717a'} />
            </TouchableOpacity>
          </View>

          {/* Title Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
              Назва тренування
            </Text>
            <TextInput
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="Наприклад: Груди та Тріцепс"
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />

            {/* Presets */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetsRow}
            >
              {TITLE_PRESETS.map((preset) => {
                const isSelected = title === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    activeOpacity={0.7}
                    onPress={() => setTitle(preset)}
                    style={[
                      styles.presetChip,
                      isSelected ? styles.presetChipActive : (isDark ? styles.chipDark : styles.chipLight),
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        isSelected ? styles.presetChipTextActive : (isDark ? styles.subDark : styles.subLight),
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Date Input with Quick Chips */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
              Дата (РРРР-ММ-ДД)
            </Text>
            <TextInput
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
              placeholder={formatLocalDate()}
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              value={date}
              onChangeText={setDate}
            />
            <View style={styles.quickDateRow}>
              <TouchableOpacity
                onPress={() => setOffsetDate(0)}
                style={[styles.quickChip, isDark ? styles.chipDark : styles.chipLight]}
              >
                <Text style={[styles.quickChipText, isDark ? styles.textDark : styles.textLight]}>
                  Сьогодні
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setOffsetDate(1)}
                style={[styles.quickChip, isDark ? styles.chipDark : styles.chipLight]}
              >
                <Text style={[styles.quickChipText, isDark ? styles.textDark : styles.textLight]}>
                  Завтра
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setOffsetDate(-1)}
                style={[styles.quickChip, isDark ? styles.chipDark : styles.chipLight]}
              >
                <Text style={[styles.quickChipText, isDark ? styles.textDark : styles.textLight]}>
                  Вчора
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notes Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
              Примітки (необов’язково)
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="Цілі, самопочуття або план на тренування..."
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              multiline
              numberOfLines={2}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Actions */}
          <View style={styles.modalActionsRow}>
            <Button
              title="Скасувати"
              variant="outline"
              onPress={onClose}
              style={{ flex: 1 }}
              disabled={isLoading}
            />
            <Button
              title="Створити"
              variant="primary"
              loading={isLoading}
              onPress={handleSubmit}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 16,
  },
  modalLight: {
    backgroundColor: '#ffffff',
  },
  modalDark: {
    backgroundColor: '#18181b',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  inputLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#09090b',
  },
  inputDark: {
    backgroundColor: '#09090b',
    borderColor: '#27272a',
    color: '#fafafa',
  },
  textArea: {
    height: 60,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  presetsRow: {
    gap: 6,
    paddingVertical: 4,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#ffffff',
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chipLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  chipDark: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
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
