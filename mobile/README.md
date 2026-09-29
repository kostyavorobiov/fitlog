# Workout Diary Mobile (React Native + Expo)

Мобільний застосунок для **Workout Diary**, побудований на **React Native**, **Expo (SDK 57)** та **Expo Router** з повною типізацією на **TypeScript**.

---

## 📁 Структура проєкту (`mobile/src/`)

```
mobile/
├── assets/                  # Іконки, сплеш-скріни, адаптивні іконки
├── src/
│   ├── app/                 # Expo Router файлова маршрутизація
│   │   ├── _layout.tsx      # Кореневий стек та провайдери теми/SafeArea
│   │   ├── (tabs)/          # Нижні вкладки застосунку
│   │   │   ├── _layout.tsx  # Tabs layout з іконками Ionicons
│   │   │   ├── index.tsx    # Вкладка "Тренування"
│   │   │   ├── exercises.tsx# Вкладка "Вправи"
│   │   │   ├── calendar.tsx # Вкладка "Календар"
│   │   │   └── profile.tsx  # Вкладка "Профіль"
│   │   └── +not-found.tsx   # 404 екран
│   ├── screens/             # Модульні екрани застосунку
│   │   ├── WorkoutsScreen.tsx   # Головний екран тренувань
│   │   ├── ExercisesScreen.tsx  # Каталог вправ та м'язових груп
│   │   ├── CalendarScreen.tsx   # Календарний розклад тренувань
│   │   ├── ProfileScreen.tsx    # Профіль користувача та налаштування
│   │   └── index.ts
│   ├── components/          # Базові UI компоненти
│   │   ├── Button.tsx       # Кнопка з варіантами (primary, outline, danger)
│   │   ├── Card.tsx         # Картка-контейнер з підтримкою темної теми
│   │   ├── Header.tsx       # Шапка екрану із заголовком та діями
│   │   ├── EmptyState.tsx   # Заглушка для порожніх списків
│   │   └── index.ts
│   ├── lib/                 # Бібліотеки та клієнти
│   │   ├── supabase.ts      # Клієнт Supabase для React Native (AsyncStorage)
│   │   ├── storage.ts       # Обертка над AsyncStorage для локального збереження
│   │   └── index.ts
│   ├── services/            # Сервісний шар
│   │   ├── workoutService.ts# Сервіс тренувань
│   │   ├── exerciseService.ts# Сервіс бази вправ
│   │   ├── authService.ts   # Сервіс авторизації та користувача
│   │   └── index.ts
│   ├── navigation/          # Навігаційні константи та типи
│   │   ├── routes.ts        # Конфігурація шляхів навігації
│   │   ├── types.ts         # Типізовані хуки та роути
│   │   └── index.ts
│   └── types/               # TypeScript типи та моделі даних
│       ├── workout.ts       # Моделі тренувань, вправ, сетів, користувачів
│       ├── navigation.ts    # Типи параметрів навігації
│       ├── declarations.d.ts# Декларації стилів та ассетів
│       └── index.ts
├── app.json                 # Конфігурація Expo
├── package.json             # Залежності та скрипти
└── tsconfig.json            # Налаштування TypeScript
```

---

## 🚀 Команди для першого запуску

### 1. Перехід до папки мобільного застосунку
```bash
cd mobile
```

### 2. Встановлення залежностей (якщо ще не встановлені)
```bash
npm install
```

### 3. Запуск застосунку в режимі розробки
```bash
npm start
# або
npx expo start
```

Після запуску Metro Bundler ви можете обрати:
- Натиснути **`i`** для запуску в iOS Simulator (потрібен macOS + Xcode).
- Натиснути **`a`** для запуску в Android Emulator (потрібен Android Studio).
- Натиснути **`w`** для запуску в браузері (Web версія Expo).
- Відсканувати QR-код за допомогою камери (iOS) або застосунку **Expo Go** (Android).

---

## 🔍 Перевірка якості коду

- **Перевірка типів TypeScript**:
  ```bash
  npm run typecheck
  ```

- **Тестова збірка production bundles (iOS, Android, Web)**:
  ```bash
  npm run build
  ```

---

## ⚙️ Налаштування оточення (Environment Variables)

Для підключення до Supabase створи файл `mobile/.env` (або `mobile/.env.local`):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
