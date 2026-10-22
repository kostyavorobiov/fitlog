import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { WorkoutTemplate, TemplateService } from '../services/templateService';
import { useAuth } from '../context/AuthContext';
import { formatLocalDate, formatDateDDMMYYYY } from '../utils/date';
import { DatePickerModal } from './DatePickerModal';

export { formatLocalDate, formatDateDDMMYYYY };

interface CreateWorkoutModalProps {
  visible: boolean;
  initialDate?: string;
  onClose: () => void;
  onSubmit: (title: string, scheduledDate: string, notes: string, template?: WorkoutTemplate) => Promise<void> | void;
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

export const CreateWorkoutModal: React.FC<CreateWorkoutModalProps> = ({
  visible,
  initialDate,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuth();

  const [mode, setMode] = useState<'empty' | 'template'>('empty');
  const [title, setTitle] = useState<string>('');
  const [date, setDate] = useState<string>(initialDate || formatLocalDate());
  const [notes, setNotes] = useState<string>('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDate(initialDate || formatLocalDate());
      setNotes('');
      setMode('empty');
      setSelectedTemplate(null);

      if (user?.id) {
        setIsLoadingTemplates(true);
        TemplateService.getTemplates(user.id)
          .then((tpls) => {
            setTemplates(tpls);
          })
          .catch((err) => {
            console.warn('[CreateWorkoutModal] Failed to load templates:', err);
          })
          .finally(() => {
            setIsLoadingTemplates(false);
          });
      }
    }
  }, [visible, initialDate, user?.id]);

  const isSubmittingRef = React.useRef(false);

  const handleSubmit = async () => {
    if (isLoading || isSubmittingRef.current) return;

    if (mode === 'template') {
      if (!selectedTemplate) {
        Alert.alert('Помилка', 'Оберіть один із збережених шаблонів');
        return;
      }
      isSubmittingRef.current = true;
      try {
        const cleanDate = date.trim() || formatLocalDate();
        await onSubmit(
          title.trim() || selectedTemplate.title,
          cleanDate,
          notes.trim() || selectedTemplate.notes || '',
          selectedTemplate
        );
      } finally {
        isSubmittingRef.current = false;
      }
      return;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert('Помилка', 'Введіть назву тренування');
      return;
    }

    isSubmittingRef.current = true;
    try {
      const cleanDate = date.trim() || formatLocalDate();
      await onSubmit(cleanTitle, cleanDate, notes.trim());
    } finally {
      isSubmittingRef.current = false;
    }
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
                Створіть порожнє тренування або з шаблону
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* Segmented Mode Selector */}
          <View style={[styles.segmentContainer, isDark ? styles.segmentDark : styles.segmentLight]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setMode('empty')}
              style={[
                styles.segmentBtn,
                mode === 'empty' && styles.segmentBtnActive,
              ]}
            >
              <Ionicons
                name="barbell-outline"
                size={14}
                color={mode === 'empty' ? '#ffffff' : (isDark ? '#94A3B8' : '#64748B')}
              />
              <Text
                style={[
                  styles.segmentBtnText,
                  mode === 'empty' ? styles.segmentBtnTextActive : (isDark ? styles.subDark : styles.subLight),
                ]}
              >
                Порожнє
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setMode('template')}
              style={[
                styles.segmentBtn,
                mode === 'template' && styles.segmentBtnActive,
              ]}
            >
              <Ionicons
                name="bookmark-outline"
                size={14}
                color={mode === 'template' ? '#ffffff' : (isDark ? '#94A3B8' : '#64748B')}
              />
              <Text
                style={[
                  styles.segmentBtnText,
                  mode === 'template' ? styles.segmentBtnTextActive : (isDark ? styles.subDark : styles.subLight),
                ]}
              >
                З шаблону {templates.length > 0 ? `(${templates.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'template' ? (
            <View style={styles.templateSection}>
              {isLoadingTemplates ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
                    Завантаження шаблонів...
                  </Text>
                </View>
              ) : templates.length === 0 ? (
                <View style={[styles.emptyTemplatesBox, isDark ? styles.cardDark : styles.cardLight]}>
                  <Ionicons name="bookmark-outline" size={32} color={isDark ? '#64748b' : '#94a3b8'} />
                  <Text style={[styles.emptyTemplatesTitle, isDark ? styles.textDark : styles.textLight]}>
                    Немає збережених шаблонів
                  </Text>
                  <Text style={[styles.emptyTemplatesSub, isDark ? styles.subDark : styles.subLight]}>
                    Ви можете зберегти будь-яке тренування як шаблон, натиснувши «Шаблон» у верхньому меню редактора.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setMode('empty')}
                    style={styles.switchModeBtn}
                  >
                    <Text style={styles.switchModeBtnText}>Створити порожнє тренування</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.templateListWrap}>
                  <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
                    Оберіть шаблон:
                  </Text>
                  <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
                    {templates.map((tpl) => {
                      const isSelected = selectedTemplate?.id === tpl.id;
                      return (
                        <TouchableOpacity
                          key={tpl.id}
                          activeOpacity={0.7}
                          onPress={() => {
                            setSelectedTemplate(tpl);
                            setTitle(tpl.title);
                          }}
                          style={[
                            styles.templateCard,
                            isDark ? styles.cardDark : styles.cardLight,
                            isSelected && styles.templateCardSelected,
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.templateCardTitle, isDark ? styles.textDark : styles.textLight]}>
                              {tpl.title}
                            </Text>
                            <Text style={[styles.templateCardSub, isDark ? styles.subDark : styles.subLight]}>
                              {tpl.exercises?.length || 0} вправ • {tpl.exercises?.map((e) => e.exerciseName).filter(Boolean).slice(0, 3).join(', ')}
                            </Text>
                          </View>
                          <Ionicons
                            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={20}
                            color={isSelected ? '#2563EB' : (isDark ? '#64748b' : '#cbd5e1')}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          ) : (
            <>
              {/* Title Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
                  Назва тренування
                </Text>
                <TextInput
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                  placeholder="Наприклад: Груди та Тріцепс"
                  placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
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
            </>
          )}

          {/* Date Input with Interactive Calendar Picker */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
              Дата (ДД/ММ/РРРР)
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsDatePickerOpen(true)}
              style={[styles.input, styles.datePickerBtn, isDark ? styles.inputDark : styles.inputLight]}
              accessibilityRole="button"
              accessibilityLabel="Оберіть дату тренування"
            >
              <Ionicons name="calendar-outline" size={18} color="#2563EB" style={{ marginRight: 8 }} />
              <Text style={[styles.dateText, isDark ? styles.textDark : styles.textLight]}>
                {formatDateDDMMYYYY(date)}
              </Text>
            </TouchableOpacity>

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

            <DatePickerModal
              visible={isDatePickerOpen}
              selectedDate={date}
              onClose={() => setIsDatePickerOpen(false)}
              onSelectDate={(newIso: string) => {
                setDate(newIso);
                setIsDatePickerOpen(false);
              }}
            />
          </View>

          {/* Notes Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
              Примітки (необов’язково)
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="Цілі, самопочуття або план на тренування..."
              placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
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
              title={mode === 'template' ? 'Створити з шаблону' : 'Створити'}
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 14,
  },
  modalLight: {
    backgroundColor: '#ffffff',
  },
  modalDark: {
    backgroundColor: '#1d2939',
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
    borderRadius: 20,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
  },
  segmentLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  segmentDark: {
    backgroundColor: '#0b1220',
    borderColor: '#334155',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  segmentBtnTextActive: {
    color: '#ffffff',
  },
  templateSection: {
    gap: 8,
  },
  loadingBox: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
  },
  emptyTemplatesBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 6,
  },
  emptyTemplatesTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyTemplatesSub: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  switchModeBtn: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  switchModeBtnText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '600',
  },
  templateListWrap: {
    gap: 6,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 6,
    gap: 10,
  },
  templateCardSelected: {
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  templateCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  templateCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  cardLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  cardDark: {
    backgroundColor: '#0b1220',
    borderColor: '#334155',
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
    borderRadius: 14,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  inputLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#0f172a',
  },
  inputDark: {
    backgroundColor: '#0b1220',
    borderColor: '#334155',
    color: '#f8fafc',
  },
  textArea: {
    height: 56,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  presetsRow: {
    gap: 6,
    paddingVertical: 4,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
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
    borderRadius: 10,
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
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
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
});
