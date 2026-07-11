import type { MascotPose } from './marketing-mascot-3d';

export type MarketingMascotSceneId =
  | 'hero'
  | 'problem'
  | 'showcase'
  | 'for-who'
  | 'features'
  | 'themes'
  | 'domain'
  | 'how-it-works'
  | 'benefits'
  | 'pricing'
  | 'faq'
  | 'final-cta';

export interface MarketingMascotPlacement {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  bubble: 'start' | 'end' | 'top' | 'none';
}

export interface MarketingMascotScene {
  id: MarketingMascotSceneId;
  label: string;
  message: string;
  pose: MascotPose;
  desktop: MarketingMascotPlacement;
  tablet: MarketingMascotPlacement;
  mobile: MarketingMascotPlacement;
}

export const marketingMascotScenes: MarketingMascotScene[] = [
  {
    id: 'hero',
    label: 'البداية',
    message: 'أهلاً، سأرافقك داخل الرحلة بدل أن أبقى خارجها.',
    pose: 'welcome',
    desktop: { x: 0.16, y: 0.34, scale: 1.08, rotate: -5, bubble: 'end' },
    tablet: { x: 0.18, y: 0.32, scale: 0.9, rotate: -4, bubble: 'end' },
    mobile: { x: 0.68, y: 0.22, scale: 0.58, rotate: -3, bubble: 'none' },
  },
  {
    id: 'problem',
    label: 'الفوضى والحل',
    message: 'هنا أستمع للمشكلة، ثم أشير إلى التحول بعد النظام.',
    pose: 'think',
    desktop: { x: 0.82, y: 0.33, scale: 0.96, rotate: 2, bubble: 'start' },
    tablet: { x: 0.76, y: 0.3, scale: 0.82, rotate: 2, bubble: 'start' },
    mobile: { x: 0.17, y: 0.18, scale: 0.5, rotate: 2, bubble: 'none' },
  },
  {
    id: 'showcase',
    label: 'المنتج',
    message: 'الآن أوجّه النظر إلى المنتج وهو يعمل أمام الزائر.',
    pose: 'point',
    desktop: { x: 0.79, y: 0.42, scale: 0.9, rotate: 4, bubble: 'start' },
    tablet: { x: 0.75, y: 0.36, scale: 0.78, rotate: 3, bubble: 'start' },
    mobile: { x: 0.74, y: 0.18, scale: 0.48, rotate: 3, bubble: 'none' },
  },
  {
    id: 'for-who',
    label: 'لمن؟',
    message: 'كل بطاقة جمهور تحصل على تقديم صغير بدل المرور الصامت.',
    pose: 'guide',
    desktop: { x: 0.21, y: 0.48, scale: 0.88, rotate: -6, bubble: 'end' },
    tablet: { x: 0.24, y: 0.38, scale: 0.76, rotate: -5, bubble: 'end' },
    mobile: { x: 0.18, y: 0.2, scale: 0.48, rotate: -4, bubble: 'none' },
  },
  {
    id: 'features',
    label: 'الأدوات',
    message: 'هنا تصبح الحركة أسرع قليلًا، لأن الأدوات هي قلب التشغيل.',
    pose: 'celebrate',
    desktop: { x: 0.83, y: 0.28, scale: 0.84, rotate: -3, bubble: 'start' },
    tablet: { x: 0.76, y: 0.26, scale: 0.74, rotate: -3, bubble: 'start' },
    mobile: { x: 0.76, y: 0.17, scale: 0.47, rotate: -3, bubble: 'none' },
  },
  {
    id: 'themes',
    label: 'الثيمات',
    message: 'مع تغيّر الهوية، أدور بخفة كأنني أبدّل الواجهة معك.',
    pose: 'spark',
    desktop: { x: 0.18, y: 0.38, scale: 0.9, rotate: 7, bubble: 'end' },
    tablet: { x: 0.22, y: 0.32, scale: 0.78, rotate: 6, bubble: 'end' },
    mobile: { x: 0.18, y: 0.17, scale: 0.48, rotate: 4, bubble: 'none' },
  },
  {
    id: 'domain',
    label: 'الدومين',
    message: 'إشارة ثقة صغيرة عند SSL والدومين حتى تبدو الخطوة مفهومة.',
    pose: 'assure',
    desktop: { x: 0.72, y: 0.5, scale: 0.88, rotate: 2, bubble: 'start' },
    tablet: { x: 0.74, y: 0.43, scale: 0.76, rotate: 2, bubble: 'start' },
    mobile: { x: 0.75, y: 0.2, scale: 0.48, rotate: 2, bubble: 'none' },
  },
  {
    id: 'how-it-works',
    label: 'الخطوات',
    message: 'أمشي مع الخطوات، من الحساب إلى متجر منشور.',
    pose: 'guide',
    desktop: { x: 0.18, y: 0.47, scale: 0.82, rotate: -2, bubble: 'end' },
    tablet: { x: 0.23, y: 0.38, scale: 0.72, rotate: -2, bubble: 'end' },
    mobile: { x: 0.18, y: 0.18, scale: 0.46, rotate: -2, bubble: 'none' },
  },
  {
    id: 'benefits',
    label: 'القيمة',
    message: 'القيمة التجارية هنا: أقل فوضى، تشغيل أوضح، ونمو أهدأ.',
    pose: 'celebrate',
    desktop: { x: 0.23, y: 0.35, scale: 0.86, rotate: -4, bubble: 'end' },
    tablet: { x: 0.24, y: 0.29, scale: 0.74, rotate: -4, bubble: 'end' },
    mobile: { x: 0.18, y: 0.17, scale: 0.47, rotate: -3, bubble: 'none' },
  },
  {
    id: 'pricing',
    label: 'الخطط',
    message: 'هنا أهدأ: المقارنة تحتاج وضوحًا أكثر من الاستعراض.',
    pose: 'focus',
    desktop: { x: 0.78, y: 0.35, scale: 0.82, rotate: 3, bubble: 'start' },
    tablet: { x: 0.74, y: 0.3, scale: 0.72, rotate: 2, bubble: 'start' },
    mobile: { x: 0.76, y: 0.17, scale: 0.46, rotate: 2, bubble: 'none' },
  },
  {
    id: 'faq',
    label: 'الأسئلة',
    message: 'آخر الاعتراضات تحتاج طمأنة، لا ضجيجًا.',
    pose: 'assure',
    desktop: { x: 0.2, y: 0.45, scale: 0.84, rotate: -2, bubble: 'end' },
    tablet: { x: 0.23, y: 0.36, scale: 0.72, rotate: -2, bubble: 'end' },
    mobile: { x: 0.2, y: 0.17, scale: 0.46, rotate: -2, bubble: 'none' },
  },
  {
    id: 'final-cta',
    label: 'الانطلاق',
    message: 'نعود معًا إلى القرار: متجر واضح وجاهز للبيع.',
    pose: 'celebrate',
    desktop: { x: 0.78, y: 0.42, scale: 0.98, rotate: -5, bubble: 'start' },
    tablet: { x: 0.76, y: 0.36, scale: 0.82, rotate: -4, bubble: 'start' },
    mobile: { x: 0.73, y: 0.18, scale: 0.5, rotate: -4, bubble: 'none' },
  },
];

export const marketingMascotSceneById = marketingMascotScenes.reduce<
  Record<MarketingMascotSceneId, MarketingMascotScene>
>((items, scene) => ({ ...items, [scene.id]: scene }), {} as Record<MarketingMascotSceneId, MarketingMascotScene>);
