/**
 * 加密模块类型入口 (T2.1)
 *
 * 加密层专用类型统一在 @/types/crypto 中定义（T1.4 产出），
 * 此处仅作 barrel re-export，保持单一数据源，便于加密模块内部就近引用。
 *
 * @see TECHNICAL_DESIGN.md 第 3.5-3.6 节
 */
export type {
  EncryptedData,
  KdfParams,
  KdfConfig,
  StrengthResult,
} from '@/types/crypto';
