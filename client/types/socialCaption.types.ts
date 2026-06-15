export interface CaptionGenerateRequest {
  platform: string;
  goal: string;
  idea: string;
  segment?: string | null;
  brandName?: string | null;
  language: string;
  tone?: string | null;
  affiliateUrl?: string | null;
  variants: number;
  keywords?: string[];
  competitorAngles?: string[];
}

export interface CaptionVariant {
  platform: string;
  goal: string;
  language: string;
  segment?: string | null;
  content: string;
  hashtags: string[];
  charCount: number;
  charLimit: number;
  hookCutoff: number;
  withinLimit: boolean;
  withinHookCutoff: boolean;
  hookOnScreen?: string | null;
  visualSuggestion?: string | null;
  ctaLink?: string | null;
}

export interface CaptionGenerateResponse {
  captions: CaptionVariant[];
  detectedIndustries: string[];
  complianceNotes: string[];
  placeholders: string[];
}

export interface PlatformOption {
  value: string;
  label: string;
  charLimit: number;
  hookCutoff: number;
}
export interface GoalOption {
  value: string;
  label: string;
}
export interface LanguageOption {
  value: string;
  label: string;
}
export interface SocialCaptionOptions {
  platforms: PlatformOption[];
  goals: GoalOption[];
  languages: LanguageOption[];
}
