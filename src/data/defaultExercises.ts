import { Exercise } from '../types/workout';

export const DEFAULT_EXERCISES: Omit<Exercise, 'id' | 'createdAt'>[] = [
  // Груди (Chest)
  {
    userId: null,
    name: 'Жим штанги лежачи на горизонтальній лаві',
    muscleGroup: 'chest',
    description: 'Базова багатосуглобова вправа для розвитку великих грудних мʼязів, передніх дельт та трицепсів.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Жим гантелей на похилій лаві (30°)',
    muscleGroup: 'chest',
    description: 'Акцент на верхню частину грудних мʼязів. Дозволяє досягти більшої амплітуди руху.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Віджимання на брусах (з акцентом на груди)',
    muscleGroup: 'chest',
    description: 'Нахил корпусу вперед для максимальної активації нижньої та середньої частини грудей.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Зведення рук у кросовері (метелик)',
    muscleGroup: 'chest',
    description: 'Ізолююча вправа для пікового скорочення та розтяжки грудних мʼязів.',
    isDefault: true,
  },

  // Спина (Back)
  {
    userId: null,
    name: 'Підтягування широким хватом',
    muscleGroup: 'back',
    description: 'Класична вправа з власною вагою для ширини найширших мʼязів спини.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Тяга штанги в нахилі до пояса',
    muscleGroup: 'back',
    description: 'Потужна базова вправа для товщини та щільності найширших, ромбоподібних і трапецій.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Тяга верхнього блоку до грудей',
    muscleGroup: 'back',
    description: 'Чудова альтернатива підтягуванням для контрольованої роботи найширших мʼязів спини.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Тяга горизонтального блоку до живота',
    muscleGroup: 'back',
    description: 'Сфокусована робота над середньою частиною спини та зведенням лопаток.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Класична станова тяга',
    muscleGroup: 'back',
    description: 'Глобальна силова вправа для розгиначів спини, сідниць, біцепсів стегон та трапецій.',
    isDefault: true,
  },

  // Ноги (Legs)
  {
    userId: null,
    name: 'Присідання зі штангою на спині',
    muscleGroup: 'legs',
    description: 'Король вправ для ніг. Розвиває квадрицепси, сідниці та мʼязи стабілізатори кору.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Жим ногами в тренажері 45°',
    muscleGroup: 'legs',
    description: 'Інтенсивне навантаження на ноги з мінімальним осьовим навантаженням на хребет.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Румунська тяга з гантелями/штангою',
    muscleGroup: 'legs',
    description: 'Цільове розтягнення та навантаження задньої поверхні стегна та сідничних мʼязів.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Випади з гантелями під час ходьби',
    muscleGroup: 'legs',
    description: 'Динамічна вправа для формування сідниць, квадрицепсів та поліпшення балансу.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Розгинання ніг у тренажері сидячи',
    muscleGroup: 'legs',
    description: 'Ізоляція прямого та латерального мʼязів квадрицепса.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Підйоми на носки стоячи (литки)',
    muscleGroup: 'legs',
    description: 'Розвиток литкових мʼязів для сильних та естетичних гомілок.',
    isDefault: true,
  },

  // Плечі (Shoulders)
  {
    userId: null,
    name: 'Армійський жим штанги стоячи (Overhead Press)',
    muscleGroup: 'shoulders',
    description: 'Фундаментальна вправа для сили переднього та середнього пучків дельт і стабілізаторів.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Махи гантелями в сторони (розведення стоячи)',
    muscleGroup: 'shoulders',
    description: 'Головна вправа для формування ширини плечей (середня дельта).',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Жим гантелей сидячи',
    muscleGroup: 'shoulders',
    description: 'Безпечний та концентрований жим над головою без участі ніг.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Тяга канатної рукоятки до обличчя (Face Pull)',
    muscleGroup: 'shoulders',
    description: 'Зміцнення задньої дельти, ротаторної манжети та покращення постави.',
    isDefault: true,
  },

  // Біцепс (Biceps)
  {
    userId: null,
    name: 'Підйом штанги на біцепс стоячи',
    muscleGroup: 'biceps',
    description: 'Класичний біомеханічний рух для нарощування маси двоголового мʼяза плеча.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Молоткові згинання з гантелями (Hammer Curls)',
    muscleGroup: 'biceps',
    description: 'Розвиток брахіалісу та плечопроменевого мʼяза передпліччя.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Концентровані згинання на лаві Скотта',
    muscleGroup: 'biceps',
    description: 'Виключає читінг, ізолюючи нижній та піковий відділ біцепса.',
    isDefault: true,
  },

  // Тріцепс (Triceps)
  {
    userId: null,
    name: 'Французький жим лежачи з EZ-грифом',
    muscleGroup: 'triceps',
    description: 'Глибока ізоляція довгої та медіальної голівок трицепса.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Розгинання рук на блоці донизу (канатом)',
    muscleGroup: 'triceps',
    description: 'Контрольоване скорочення латеральної голівки трицепса в піковій точці.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Жим штанги вузьким хватом',
    muscleGroup: 'triceps',
    description: 'Базова багатосуглобова силова вправа на трицепс та внутрішню частину грудей.',
    isDefault: true,
  },

  // Прес / Кор (Core)
  {
    userId: null,
    name: 'Підйом ніг у висі на турніку',
    muscleGroup: 'core',
    description: 'Ефективне навантаження на нижній відділ прямого мʼяза живота та клубово-поперековий мʼяз.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Скручування на римському стільці / килимку',
    muscleGroup: 'core',
    description: 'Базова робота над рельєфом верхніх кубиків преса з акцентом на округлення спини.',
    isDefault: true,
  },
  {
    userId: null,
    name: 'Планка на ліктях (ізометрична)',
    muscleGroup: 'core',
    description: 'Зміцнення поперечного мʼяза живота, спини та глибоких стабілізаторів корпусу.',
    isDefault: true,
  },
];
