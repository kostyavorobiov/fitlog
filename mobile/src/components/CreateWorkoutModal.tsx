import React, { useState, useEffect, useRef } from 'react';
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
  TouchableWithoutFeedback,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
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
  modalTitle?: string;
  modalSub?: string;
  templateUserId?: string;
}

export const CreateWorkoutModal: React.FC<CreateWorkoutModalProps> = ({
  visible,
  initialDate,
  onClose,
  onSubmit,
  isLoading = false,
  modalTitle,
  modalSub,
  templateUserId,
}) => {
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuth();

  const [mode, setMode] = useState<'empty' | 'template'>('empty');
  const [title, setTitle] = useState<string>('');
  const [date, setDate] = useState<string>(initialDate || formatLocalDate());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDate(initialDate || formatLocalDate());
      setMode('empty');
      setSelectedTemplate(null);

      const effectiveUserId = templateUserId || user?.id;
      if (effectiveUserId) {
        setIsLoadingTemplates(true);
        TemplateService.getTemplates(effectiveUserId)
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
  }, [visible, initialDate, user?.id, templateUserId]);

  const isSubmittingRef = useRef(false);

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
          selectedTemplate.notes || '',
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
      await onSubmit(cleanTitle, cleanDate, '');
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardWrap}
          >
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalCard, isDark ? styles.cardDark : styles.cardLight]}>
                {/* Header */}
                <View style={styles.headerRow}>
                  <View style={styles.headerLeft}>
                    <View style={[styles.iconBadge, isDark ? styles.iconBadgeDark : styles.iconBadgeLight]}>
                      <Ionicons
                        name="barbell"
                        size={22}
                        color={isDark ? '#60A5FA' : '#2563EB'}
                      />
                    </View>
                    <View style={styles.headerTextWrap}>
                      <Text style={[styles.modalTitle, isDark ? styles.textDark : styles.textLight]}>
                        {modalTitle || 'Нове тренування'}
                      </Text>
                      <Text style={[styles.modalSub, isDark ? styles.subDark : styles.subLight]}>
                        {modalSub || 'Створіть порожнє або з збереженого шаблону'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Закрити"
                  >
                    <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
                  </TouchableOpacity>
                </View>

                {/* Mode Selector Segment */}
                <View style={[styles.segmentContainer, isDark ? styles.segmentDark : styles.segmentLight]}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setMode('empty')}
                    style={[
                      styles.segmentBtn,
                      mode === 'empty' && (isDark ? styles.segmentBtnActiveDark : styles.segmentBtnActiveLight),
                    ]}
                  >
                    <Ionicons
                      name="barbell-outline"
                      size={15}
                      color={mode === 'empty' ? (isDark ? '#60A5FA' : '#2563EB') : (isDark ? '#94A3B8' : '#64748B')}
                    />
                    <Text
                      style={[
                        styles.segmentBtnText,
                        mode === 'empty'
                          ? (isDark ? styles.segmentTextActiveDark : styles.segmentTextActiveLight)
                          : (isDark ? styles.subDark : styles.subLight),
                      ]}
                    >
                      Нове тренування
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setMode('template')}
                    style={[
                      styles.segmentBtn,
                      mode === 'template' && (isDark ? styles.segmentBtnActiveDark : styles.segmentBtnActiveLight),
                    ]}
                  >
                    <Ionicons
                      name="bookmark-outline"
                      size={15}
                      color={mode === 'template' ? (isDark ? '#60A5FA' : '#2563EB') : (isDark ? '#94A3B8' : '#64748B')}
                    />
                    <Text
                      style={[
                        styles.segmentBtnText,
                        mode === 'template'
                          ? (isDark ? styles.segmentTextActiveDark : styles.segmentTextActiveLight)
                          : (isDark ? styles.subDark : styles.subLight),
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
                      <View style={[styles.emptyTemplatesBox, isDark ? styles.innerBoxDark : styles.innerBoxLight]}>
                        <Ionicons name="bookmark-outline" size={28} color={isDark ? '#64748b' : '#94a3b8'} />
                        <Text style={[styles.emptyTemplatesTitle, isDark ? styles.textDark : styles.textLight]}>
                          Немає збережених шаблонів
                        </Text>
                        <Text style={[styles.emptyTemplatesSub, isDark ? styles.subDark : styles.subLight]}>
                          Збережіть будь-яке тренування як шаблон у верхньому меню редактора.
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
                        <Text style={[styles.inputLabel, isDark ? styles.labelDark : styles.labelLight]}>
                          Оберіть шаблон *
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
                                  isDark ? styles.templateCardDark : styles.templateCardLight,
                                  isSelected && styles.templateCardSelected,
                                ]}
                              >
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                  <Text style={[styles.templateCardTitle, isDark ? styles.textDark : styles.textLight]} numberOfLines={1}>
                                    {tpl.title}
                                  </Text>
                                  <Text style={[styles.templateCardSub, isDark ? styles.subDark : styles.subLight]} numberOfLines={1}>
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
                  /* Title Field (without quick presets) */
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.inputLabel, isDark ? styles.labelDark : styles.labelLight]}>
                      Назва тренування *
                    </Text>
                    <TextInput
                      style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                      placeholder="наприклад: Груди та Тріцепс"
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      value={title}
                      onChangeText={setTitle}
                      autoFocus
                    />
                  </View>
                )}

                {/* Date Field */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.inputLabel, isDark ? styles.labelDark : styles.labelLight]}>
                    Дата тренування
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setIsDatePickerOpen(true)}
                    style={[styles.input, styles.datePickerBtn, isDark ? styles.inputDark : styles.inputLight]}
                    accessibilityRole="button"
                    accessibilityLabel="Оберіть дату тренування"
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={isDark ? '#60A5FA' : '#2563EB'}
                      style={{ marginRight: 10 }}
                    />
                    <Text style={[styles.dateText, isDark ? styles.textDark : styles.textLight]}>
                      {formatDateDDMMYYYY(date)}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Actions: Cancel and Create */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={onClose}
                    disabled={isLoading}
                    style={[styles.actionBtn, isDark ? styles.cancelBtnDark : styles.cancelBtnLight]}
                  >
                    <Text style={[styles.cancelBtnText, isDark ? styles.cancelTextDark : styles.cancelTextLight]}>
                      Скасувати
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSubmit}
                    disabled={isLoading}
                    style={[styles.actionBtn, styles.createBtn]}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="add" size={19} color="#ffffff" />
                        <Text style={styles.createBtnText}>
                          {mode === 'template' ? 'Створити' : 'Створити'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>

      <DatePickerModal
        visible={isDatePickerOpen}
        selectedDate={date}
        onClose={() => setIsDatePickerOpen(false)}
        onSelectDate={(newIso: string) => {
          setDate(newIso);
          setIsDatePickerOpen(false);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  keyboardWrap: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#E2E8F0',
  },
  cardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    gap: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  iconBadgeDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  headerTextWrap: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
  },
  textLight: {
    color: '#0F172A',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subLight: {
    color: '#64748B',
  },
  subDark: {
    color: '#94A3B8',
  },
  labelLight: {
    color: '#334155',
  },
  labelDark: {
    color: '#E2E8F0',
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    marginTop: 16,
  },
  segmentLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  segmentDark: {
    backgroundColor: '#0F172A',
    borderColor: '#243247',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
  },
  segmentBtnActiveLight: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnActiveDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentTextActiveLight: {
    color: '#2563EB',
    fontWeight: '700',
  },
  segmentTextActiveDark: {
    color: '#60A5FA',
    fontWeight: '700',
  },
  fieldGroup: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  inputLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    color: '#0F172A',
  },
  inputDark: {
    backgroundColor: '#0F172A',
    borderColor: '#243247',
    color: '#F8FAFC',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  templateSection: {
    marginTop: 14,
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
  },
  innerBoxLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  innerBoxDark: {
    backgroundColor: '#0F172A',
    borderColor: '#243247',
  },
  emptyTemplatesBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 6,
    textAlign: 'center',
  },
  emptyTemplatesTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyTemplatesSub: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  switchModeBtn: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  switchModeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  templateListWrap: {
    gap: 8,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  templateCardLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  templateCardDark: {
    backgroundColor: '#0F172A',
    borderColor: '#243247',
  },
  templateCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  templateCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  templateCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnLight: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnDark: {
    backgroundColor: '#243247',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelTextLight: {
    color: '#334155',
  },
  cancelTextDark: {
    color: '#F1F5F9',
  },
  createBtn: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
