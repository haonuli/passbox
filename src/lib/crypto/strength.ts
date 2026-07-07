/**
 * 密码强度评估模块 (T5.2)
 *
 * 使用 zxcvbn-ts 实现密码强度评估：
 * 综合长度、字符多样性、常见弱密码字典、模式检测。
 * 输出评分（0-4）和标签（弱/中/强）+ 改进建议。
 *
 * @see TASK_BREAKDOWN T5.2 验收标准
 */
import { zxcvbn } from 'zxcvbn-ts';

/** 强度标签 */
export type StrengthLabel = 'weak' | 'fair' | 'strong';

/** 强度评估结果 */
export interface PasswordStrengthResult {
  /** 0-4 分，0 最弱，4 最强 */
  score: 0 | 1 | 2 | 3 | 4;
  /** 弱 / 中 / 强 */
  label: StrengthLabel;
  /** 改进建议列表 */
  suggestions: string[];
  /** 预估破解时间描述 */
  crackTimeDisplay: string;
}

/**
 * 将 zxcvbn 分数映射为标签。
 * 0-1 → weak, 2 → fair, 3-4 → strong
 */
function scoreToLabel(score: number): StrengthLabel {
  if (score <= 1) return 'weak';
  if (score <= 2) return 'fair';
  return 'strong';
}

/**
 * 评估密码强度。
 *
 * 在浏览器端本地完成，不上传密码明文。
 *
 * @param password 待评估的密码
 * @returns 强度评估结果
 */
export function assessPassword(password: string): PasswordStrengthResult {
  if (password.length === 0) {
    return {
      score: 0,
      label: 'weak',
      suggestions: [],
      crackTimeDisplay: '',
    };
  }

  const result = zxcvbn(password);

  // 将英文建议翻译为中文
  const suggestions = (result.feedback.suggestions || []).map((s: string) => {
    if (s.includes('Add another word') || s.includes('another word')) return '增加密码长度';
    if (s.includes('Capitalization')) return '混合使用大小写字母';
    if (s.includes('numbers')) return '加入数字';
    if (s.includes('symbols')) return '加入特殊符号';
    if (s.includes('predictable')) return '避免使用常见模式（如键盘序列、重复字符）';
    if (s.includes('reversed')) return '避免使用逆序的常见词';
    if (s.includes('common')) return '避免使用常见密码';
    return s;
  });

  // 警告信息也加入建议
  if (result.feedback.warning) {
    const warning = result.feedback.warning;
    let warningZh = warning;
    if (warning.includes('common')) warningZh = '这是一个非常常见的密码';
    if (warning.includes('keyboard')) warningZh = '这是键盘上的常见序列';
    if (warning.includes('repeat')) warningZh = '包含重复字符';
    if (warning.includes('sequence')) warningZh = '包含常见序列（如 abc、123）';
    suggestions.unshift(warningZh);
  }

  return {
    score: result.score,
    label: scoreToLabel(result.score),
    suggestions: suggestions.length > 0 ? suggestions : [],
    crackTimeDisplay: result.crack_times_display?.offline_slow_hashing_1e5_per_second || '',
  };
}
