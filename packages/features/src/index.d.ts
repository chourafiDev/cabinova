/** Keys of the features the code implements — keep in sync with index.js (a test checks). */
export type FeatureKey =
  | 'appointments'
  | 'medical_records'
  | 'prescriptions'
  | 'advanced_stats'
  | 'sms_reminders'
  | 'multi_doctor'
  | 'multi_site'
  | 'priority_support';

export type FeatureDefinition = {
  /** Stable identifier the code checks; never changes once used. */
  key: FeatureKey;
  /** Shown in the admin and in the clinic app. */
  name: string;
  category: string;
  description: string;
};

export declare const FEATURES: readonly FeatureDefinition[];
export declare const FEATURE_KEYS: readonly FeatureKey[];
export declare function isFeatureKey(key: string): key is FeatureKey;
