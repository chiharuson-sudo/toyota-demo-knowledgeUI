import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
// @ts-expect-error d3-sankey has no type definitions
import { sankey, sankeyLinkHorizontal } from "d3-sankey";

// ========== 型定義 ==========
type Perspective =
  | "①判断ルール" | "②社内ルール" | "③技術的注意点"
  | "④設計思想" | "⑤絶対注意" | "⑥前提条件"
  | "⑦検討漏れ" | "⑧再発防止" | "⑨影響範囲";

type TechDomain =
  | "電力変換" | "組み込みソフト" | "通信/車載NW"
  | "機能安全/信頼性" | "回路/実装";

type CustomerLayer =
  | "故障モード・故障原因" | "設計・製造の因果関係" | "評価基準"
  | "対策・設計ノウハウ" | "設計チェックリスト" | "横展開・波及リスク";

type KnowledgeNode = {
  id: string;
  title: string;
  perspective: Perspective;
  product: string;
  domain: TechDomain;
  source: string;
  customerLayers: CustomerLayer[];
};

type RelationshipEdge = {
  from: string;
  to: string;
  type: "因果" | "前提" | "波及" | "対策";
  description: string;
};

// ========== カラー ==========
const colors = {
  bg: "#0F172A",
  surface: "#1E293B",
  surfaceHover: "#334155",
  border: "#334155",
  textPrimary: "#F1F5F9",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  accent: "#3B82F6",
};

const perspectiveColors: Record<Perspective, string> = {
  "①判断ルール": "#3B82F6",
  "②社内ルール": "#10B981",
  "③技術的注意点": "#6B7280",
  "④設計思想": "#8B5CF6",
  "⑤絶対注意": "#EF4444",
  "⑥前提条件": "#F59E0B",
  "⑦検討漏れ": "#F97316",
  "⑧再発防止": "#D97706",
  "⑨影響範囲": "#EC4899",
};

const edgeStyles: Record<"因果" | "前提" | "波及" | "対策", { color: string; dash: string | null }> = {
  "因果": { color: "#DC2626", dash: null },
  "前提": { color: "#60A5FA", dash: "6,3" },
  "波及": { color: "#FBBF24", dash: "3,3" },
  "対策": { color: "#34D399", dash: null },
};

const layerColors: Record<CustomerLayer, string> = {
  "故障モード・故障原因": "#F87171",
  "設計・製造の因果関係": "#FB923C",
  "評価基準": "#FBBF24",
  "対策・設計ノウハウ": "#34D399",
  "設計チェックリスト": "#60A5FA",
  "横展開・波及リスク": "#C084FC",
};

// ========== ノード一覧（45件） ==========
const NODES: KnowledgeNode[] = [
  { id: "K1", title: "AD変換：ポート安定待ち時間等の考慮が必須", perspective: "③技術的注意点", product: "コンバータ", domain: "電力変換", source: "設計チェック-20251104", customerLayers: ["設計・製造の因果関係"] },
  { id: "K2", title: "AD変換異常時：タイムアウト異常対応が仕様書で定義", perspective: "①判断ルール", product: "コンバータ", domain: "電力変換", source: "設計チェック-20251104", customerLayers: ["評価基準"] },
  { id: "K3", title: "AD変換結果取得は変換完了フラグ確認後に実施", perspective: "②社内ルール", product: "コンバータ", domain: "電力変換", source: "設計チェック-20251104", customerLayers: ["設計チェックリスト"] },
  { id: "K4", title: "サンプルホールド回路はAD変換の基本回路で全方式に必須", perspective: "⑤絶対注意", product: "コンバータ", domain: "電力変換", source: "設計チェック-20251104", customerLayers: ["対策・設計ノウハウ", "設計チェックリスト"] },
  { id: "K5", title: "低電圧検出時にパルスあり異常フラグをクリアする", perspective: "⑤絶対注意", product: "コンバータ", domain: "電力変換", source: "設計チェック-20250923", customerLayers: ["対策・設計ノウハウ"] },
  { id: "K6", title: "イニシャルチェック中の電圧変動パターンを評価に含める", perspective: "⑧再発防止", product: "コンバータ", domain: "電力変換", source: "設計チェック-20250923", customerLayers: ["故障モード・故障原因"] },
  { id: "K7", title: "強制加電圧時のマイコン端子制御", perspective: "④設計思想", product: "コンバータ", domain: "電力変換", source: "設計チェック-20250923", customerLayers: ["設計・製造の因果関係", "対策・設計ノウハウ"] },
  { id: "K8", title: "状態遷移条件と処理内容の明確化", perspective: "①判断ルール", product: "コンバータ", domain: "電力変換", source: "設計チェック-20250923", customerLayers: ["評価基準"] },
  { id: "K9", title: "パワーサイクル対策で基板銅箔部に金メッキ追加", perspective: "③技術的注意点", product: "コンバータ", domain: "回路/実装", source: "スタッフ週報-20250729", customerLayers: ["設計・製造の因果関係", "対策・設計ノウハウ"] },
  { id: "K10", title: "マイコンリセット時のポート状態はハイインピーダンス", perspective: "①判断ルール", product: "充電器", domain: "電力変換", source: "設計チェック-20251007", customerLayers: ["評価基準", "設計・製造の因果関係"] },
  { id: "K11", title: "リセット時のハイインピーダンスが外部回路に与える影響", perspective: "⑨影響範囲", product: "充電器", domain: "電力変換", source: "設計チェック-20251007", customerLayers: ["横展開・波及リスク"] },
  { id: "K12", title: "リセット時の動作を設計書に明記し外部回路設計者と認識合わせ", perspective: "②社内ルール", product: "充電器", domain: "電力変換", source: "設計チェック-20251007", customerLayers: ["設計チェックリスト"] },
  { id: "K13", title: "リセット時の誤動作防止にはプルダウン抵抗設計が重要", perspective: "⑤絶対注意", product: "充電器", domain: "電力変換", source: "設計チェック-20251007", customerLayers: ["対策・設計ノウハウ"] },
  { id: "K14", title: "割り込み禁止による順序維持と処理負荷の考慮", perspective: "①判断ルール", product: "コンバータ", domain: "組み込みソフト", source: "設計チェック-20260113", customerLayers: ["評価基準"] },
  { id: "K15", title: "単体テストツールによる最適化抑制のフィードバック", perspective: "②社内ルール", product: "コンバータ", domain: "組み込みソフト", source: "設計チェック-20260113", customerLayers: ["設計チェックリスト"] },
  { id: "K16", title: "配列のvolatile宣言による最適化抑制", perspective: "③技術的注意点", product: "コンバータ", domain: "組み込みソフト", source: "設計チェック-20260113", customerLayers: ["設計・製造の因果関係"] },
  { id: "K17", title: "コンパイラ最適化のアズイフルールと副作用の扱い", perspective: "④設計思想", product: "共通", domain: "組み込みソフト", source: "設計チェック-20260113", customerLayers: ["設計・製造の因果関係", "対策・設計ノウハウ"] },
  { id: "K18", title: "割り込みとメインで共有する変数の順序依存", perspective: "⑤絶対注意", product: "共通", domain: "組み込みソフト", source: "設計チェック-20260113", customerLayers: ["対策・設計ノウハウ", "故障モード・故障原因"] },
  { id: "K19", title: "D-MIPS値による処理速度見積もりの限界と注意点", perspective: "③技術的注意点", product: "共通", domain: "組み込みソフト", source: "設計チェック-20251202", customerLayers: ["設計・製造の因果関係"] },
  { id: "K20", title: "スタックのベリファイチェック時は関数ジャンプ先に注意", perspective: "③技術的注意点", product: "共通", domain: "組み込みソフト", source: "設計チェック-20251202", customerLayers: ["設計・製造の因果関係"] },
  { id: "K21", title: "スタック領域の静的・動的見積もり方法", perspective: "③技術的注意点", product: "共通", domain: "組み込みソフト", source: "設計チェック-20251202", customerLayers: ["設計・製造の因果関係"] },
  { id: "K22", title: "使用メモリ・スタック量の妥当性確認は必須", perspective: "⑤絶対注意", product: "共通", domain: "組み込みソフト", source: "設計チェック-20251202", customerLayers: ["対策・設計ノウハウ", "設計チェックリスト"] },
  { id: "K23", title: "処理時間を実測し周期時間内完了を確認すること", perspective: "⑤絶対注意", product: "共通", domain: "組み込みソフト", source: "設計チェック-20251202", customerLayers: ["対策・設計ノウハウ", "設計チェックリスト"] },
  { id: "K24", title: "テイラーリングは製品担当と合意した内容を記録する", perspective: "④設計思想", product: "共通", domain: "組み込みソフト", source: "設計チェック-20251202", customerLayers: ["対策・設計ノウハウ"] },
  { id: "K25", title: "テイラーリング方針とテスト項目の相関確認は必須", perspective: "⑤絶対注意", product: "共通", domain: "組み込みソフト", source: "設計チェック-20251202", customerLayers: ["設計チェックリスト"] },
  { id: "K26", title: "ソフトウェア変更時は客先と必ず合意を取る", perspective: "⑤絶対注意", product: "共通", domain: "組み込みソフト", source: "設計チェック-20251021", customerLayers: ["対策・設計ノウハウ", "設計チェックリスト"] },
  { id: "K27", title: "ソフトウェア設計変更は影響分析後に起票", perspective: "①判断ルール", product: "共通", domain: "組み込みソフト", source: "設計チェック-20251021", customerLayers: ["評価基準"] },
  { id: "K28", title: "変更内容の詳細記載と保管は必須", perspective: "⑤絶対注意", product: "共通", domain: "組み込みソフト", source: "設計チェック-20251021", customerLayers: ["設計チェックリスト"] },
  { id: "K29", title: "変更箇所と変更元の明確化は必須", perspective: "⑤絶対注意", product: "共通", domain: "組み込みソフト", source: "設計チェック-20251021", customerLayers: ["設計チェックリスト"] },
  { id: "K30", title: "変更管理表に変更箇所を明確に記載し帳票連携を徹底", perspective: "⑤絶対注意", product: "共通", domain: "組み込みソフト", source: "設計チェック-20251021", customerLayers: ["設計チェックリスト"] },
  { id: "K31", title: "設計書・変更管理表の記載内容は必ず一致させる", perspective: "⑤絶対注意", product: "共通", domain: "組み込みソフト", source: "設計チェック-20251021", customerLayers: ["設計チェックリスト"] },
  { id: "K32", title: "変更要求管理台帳で一元管理する", perspective: "②社内ルール", product: "共通", domain: "組み込みソフト", source: "設計チェック-20250909", customerLayers: ["設計チェックリスト"] },
  { id: "K33", title: "変更要求管理台帳のベースライン記載は必須", perspective: "⑤絶対注意", product: "共通", domain: "組み込みソフト", source: "設計チェック-20250909", customerLayers: ["設計チェックリスト"] },
  { id: "K34", title: "変更要求管理台帳の分割は規模と機種派生で判断", perspective: "①判断ルール", product: "共通", domain: "組み込みソフト", source: "設計チェック-20250909", customerLayers: ["評価基準"] },
  { id: "K35", title: "台帳作成の考え方シートが未整備で課題", perspective: "⑦検討漏れ", product: "共通", domain: "組み込みソフト", source: "設計チェック-20250909", customerLayers: ["設計チェックリスト"] },
  { id: "K36", title: "シリアル通信のエラー検出方式と判定基準", perspective: "①判断ルール", product: "共通", domain: "通信/車載NW", source: "設計チェック-20251223", customerLayers: ["評価基準"] },
  { id: "K37", title: "通信異常検出後のフェールセーフは上位システムと合意必須", perspective: "②社内ルール", product: "共通", domain: "通信/車載NW", source: "設計チェック-20251223", customerLayers: ["設計チェックリスト"] },
  { id: "K38", title: "通信異常判定ロジックのエラーフラグ上書きに注意", perspective: "⑤絶対注意", product: "共通", domain: "通信/車載NW", source: "設計チェック-20251223", customerLayers: ["故障モード・故障原因", "対策・設計ノウハウ"] },
  { id: "K39", title: "エラーフラグ上書きによる判定漏れ防止設計", perspective: "⑧再発防止", product: "コンバータ", domain: "通信/車載NW", source: "設計チェック-20251223", customerLayers: ["故障モード・故障原因"] },
  { id: "K40", title: "FMEAは故障モード影響解析でリスク評価と対策が必須", perspective: "④設計思想", product: "共通", domain: "機能安全/信頼性", source: "設計チェック-20250826", customerLayers: ["設計・製造の因果関係", "対策・設計ノウハウ"] },
  { id: "K41", title: "FMEAは社内標準・業界規格に準拠し最新フォーマット使用", perspective: "②社内ルール", product: "共通", domain: "機能安全/信頼性", source: "設計チェック-20250826", customerLayers: ["設計チェックリスト"] },
  { id: "K42", title: "FMEAは未然防止のため事前リスク評価が必須", perspective: "⑤絶対注意", product: "共通", domain: "機能安全/信頼性", source: "設計チェック-20250826", customerLayers: ["対策・設計ノウハウ", "故障モード・故障原因"] },
  { id: "K43", title: "サイバーセキュリティ要求はFMEAで重点管理項目として工程に申し送り", perspective: "⑤絶対注意", product: "充電器", domain: "通信/車載NW", source: "設計チェック-20250826", customerLayers: ["対策・設計ノウハウ", "横展開・波及リスク"] },
  { id: "K44", title: "NG品試験時は必ず組長・課長に相談", perspective: "②社内ルール", product: "共通", domain: "回路/実装", source: "スタッフ週報-20250729", customerLayers: ["設計チェックリスト"] },
  { id: "K45", title: "断面観察指示書は正式シートのみ使用", perspective: "②社内ルール", product: "共通", domain: "回路/実装", source: "スタッフ週報-20250729", customerLayers: ["設計チェックリスト"] },
];

// ========== エッジ一覧（21件） ==========
const EDGES: RelationshipEdge[] = [
  { from: "K1", to: "K4", type: "前提", description: "AD変換の時間的注意点がサンプルホールド必須の前提" },
  { from: "K8", to: "K5", type: "前提", description: "状態遷移条件の明確化がフラグクリアの前提" },
  { from: "K6", to: "K8", type: "対策", description: "電圧変動パターン評価追加が状態遷移条件明確化の対策" },
  { from: "K10", to: "K11", type: "波及", description: "リセット時ハイインピーダンスが外部回路に波及" },
  { from: "K11", to: "K13", type: "対策", description: "外部回路波及リスクに対しプルダウン抵抗が対策" },
  { from: "K13", to: "K12", type: "前提", description: "プルダウン抵抗設計の徹底は設計書明記と認識合わせが前提" },
  { from: "K2", to: "K3", type: "対策", description: "AD変換異常時の判断ルールが結果取得の社内ルールの対策" },
  { from: "K16", to: "K14", type: "前提", description: "volatile宣言は割り込み禁止による順序維持の前提" },
  { from: "K15", to: "K14", type: "対策", description: "単体テストのフィードバックが最適化抑制の対策" },
  { from: "K17", to: "K18", type: "前提", description: "アズイフルールの理解が順序依存の絶対注意の前提" },
  { from: "K22", to: "K21", type: "前提", description: "メモリ妥当性確認はスタック見積もり方法の理解が前提" },
  { from: "K22", to: "K20", type: "前提", description: "メモリ妥当性確認はベリファイチェック注意点の理解が前提" },
  { from: "K23", to: "K19", type: "前提", description: "処理時間実測はD-MIPS限界の理解が前提" },
  { from: "K25", to: "K24", type: "前提", description: "テスト項目相関確認はテイラーリング設計思想が前提" },
  { from: "K30", to: "K29", type: "波及", description: "帳票変更漏れが変更箇所明確化の必要性に波及" },
  { from: "K34", to: "K35", type: "前提", description: "台帳分割判断の前提として考え方シートが未整備" },
  { from: "K32", to: "K33", type: "前提", description: "台帳一元管理が台帳ベースライン記載の前提" },
  { from: "K36", to: "K37", type: "前提", description: "通信異常判定方式の選定は上位システム合意が前提" },
  { from: "K39", to: "K38", type: "前提", description: "エラーフラグ上書き防止が判定漏れ防止の前提" },
  { from: "K41", to: "K42", type: "前提", description: "社内標準準拠が未然防止の事前リスク評価の前提" },
  { from: "K40", to: "K42", type: "前提", description: "FMEAリスク評価の設計思想が未然防止の前提" },
];

// ========== 顧客オントロジー対応（サンキー用は件数を観点ごとに分割） ==========
const ONTOLOGY_MAPPING = [
  { customerLayer: "故障モード・故障原因" as CustomerLayer, customerDesc: "過去の市場クレーム・不具合データ、故障モード辞書、類似構造からの横展開", perspectives: ["⑧再発防止", "⑤絶対注意"] as Perspective[], count: 17, perspectiveCounts: { "⑧再発防止": 2, "⑤絶対注意": 15 }, bridge: "会議中の過去不具合議論から⑧再発防止を抽出し、そこから導かれた必須対策を⑤絶対注意として構造化", examples: ["エラーフラグ上書き防止(⑧)→判定漏れ注意(⑤)", "電圧変動パターン評価追加(⑧)→状態遷移明確化(①)"] },
  { customerLayer: "設計・製造の因果関係" as CustomerLayer, customerDesc: "材料特性と劣化メカニズム、製造工程と品質特性の関係、環境条件と故障モードの関係", perspectives: ["③技術的注意点", "④設計思想"] as Perspective[], count: 11, perspectiveCounts: { "③技術的注意点": 7, "④設計思想": 4 }, bridge: "技術的メカニズムの議論を③技術的注意点として抽出し、「なぜそうするか」の背景知識を④設計思想として分離", examples: ["AD変換時間考慮(③)", "アズイフルール(④)", "パワーサイクル対策の金メッキ(③)"] },
  { customerLayer: "評価基準" as CustomerLayer, customerDesc: "影響度・発生度・検出度の評価基準、法規制・安全規格との紐付け", perspectives: ["①判断ルール", "⑥前提条件"] as Perspective[], count: 7, perspectiveCounts: { "①判断ルール": 7, "⑥前提条件": 0 }, bridge: "条件分岐・判定基準を①判断ルールとして抽出。暗黙の制約は⑥前提条件（今後のVTT追加で増加見込み）", examples: ["通信異常判定基準(①)", "状態遷移条件(①)", "リセット時ポート状態(①)"] },
  { customerLayer: "対策・設計ノウハウ" as CustomerLayer, customerDesc: "過去に効果のあった設計対策パターン集、ベテラン設計者の暗黙知、検証方法と検出能力", perspectives: ["⑤絶対注意", "④設計思想", "⑧再発防止"] as Perspective[], count: 21, perspectiveCounts: { "⑤絶対注意": 10, "④設計思想": 6, "⑧再発防止": 5 }, bridge: "ベテランの暗黙知が会議で言語化される瞬間を捉え、必須対策→⑤、設計理由→④、過去事例→⑧として構造化", examples: ["volatile宣言(③→④)", "プルダウン抵抗(⑤)", "テイラーリング方針(④→⑤)"] },
  { customerLayer: "設計チェックリスト" as CustomerLayer, customerDesc: "製品カテゴリ別・開発フェーズ別のチェック項目、過去DRの指摘事項と対応履歴", perspectives: ["②社内ルール", "⑤絶対注意", "⑦検討漏れ"] as Perspective[], count: 24, perspectiveCounts: { "②社内ルール": 8, "⑤絶対注意": 15, "⑦検討漏れ": 1 }, bridge: "社内手続き→②、必須チェック→⑤として体系化。「これも確認が必要」→⑦が動的なチェックリスト拡張として機能", examples: ["FMEA標準準拠(②)", "テスト相関確認(⑤)", "考え方シート未整備(⑦)"] },
  { customerLayer: "横展開・波及リスク" as CustomerLayer, customerDesc: "他製品への波及リスク検出、類似構造からの故障モード横展開", perspectives: ["⑨影響範囲"] as Perspective[], count: 1, perspectiveCounts: { "⑨影響範囲": 1 }, bridge: "変更の他工程・他製品への影響を⑨影響範囲として抽出。設計レビュー・DR会議VTT追加で大幅増加見込み", examples: ["リセット時の外部回路波及(⑨)"] },
];

// 御社リレーションと抽出関係の対応
const RELATION_MAPPING = [
  { customerRelation: "部品 →[発生しうる]→ 故障モード", extractRelation: "前提" as const, count: 15, example: "③AD変換時間 →(前提)→ ⑤サンプルホールド必須" },
  { customerRelation: "故障モード →[原因は]→ 故障原因", extractRelation: "因果" as const, count: 0, example: "（今後DR会議VTT追加で増加見込み）" },
  { customerRelation: "故障モード →[対策は]→ 対策", extractRelation: "対策" as const, count: 4, example: "⑧評価パターン追加 →(対策)→ ①状態遷移明確化" },
  { customerRelation: "故障モード →[影響は]→ 影響", extractRelation: "波及" as const, count: 2, example: "①リセット時ポート →(波及)→ ⑨外部回路影響" },
];

// ========== ドメイン→forceX/Y の目安位置（0-1） ==========
const domainPositions: Record<TechDomain, { x: number; y: number }> = {
  "電力変換": { x: 0.2, y: 0.5 },
  "組み込みソフト": { x: 0.75, y: 0.25 },
  "通信/車載NW": { x: 0.5, y: 0.15 },
  "機能安全/信頼性": { x: 0.7, y: 0.7 },
  "回路/実装": { x: 0.5, y: 0.9 },
};

const PERSPECTIVES: Perspective[] = ["①判断ルール", "②社内ルール", "③技術的注意点", "④設計思想", "⑤絶対注意", "⑥前提条件", "⑦検討漏れ", "⑧再発防止", "⑨影響範囲"];
const DOMAINS: TechDomain[] = ["電力変換", "組み込みソフト", "通信/車載NW", "機能安全/信頼性", "回路/実装"];
const PRODUCTS = ["全て", "コンバータ", "充電器", "共通"];
const REL_TYPES = ["因果", "前提", "波及", "対策"] as const;

// ========== タブ1: ナレッジグラフ ==========
function KnowledgeGraphTab({
  filterPerspectives,
  filterDomain,
  filterProduct,
  filterRelTypes,
  setFilterPerspectives,
  setFilterDomain,
  setFilterProduct,
  setFilterRelTypes,
  selectedId,
  onSelectNode,
}: {
  filterPerspectives: Set<Perspective>;
  filterDomain: string;
  filterProduct: string;
  filterRelTypes: Set<string>;
  setFilterPerspectives: (s: Set<Perspective>) => void;
  setFilterDomain: (s: string) => void;
  setFilterProduct: (s: string) => void;
  setFilterRelTypes: (s: Set<string>) => void;
  selectedId: string | null;
  onSelectNode: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);

  type D3Node = d3.SimulationNodeDatum & { id: string; radius: number; perspective: Perspective; domain: TechDomain; title: string; customerLayers: CustomerLayer[] };
  type D3Link = d3.SimulationLinkDatum<D3Node> & { type: "因果" | "前提" | "波及" | "対策"; source: D3Node; target: D3Node };

  const filtered = useMemo(() => {
    const nodeIds = new Set(NODES.filter(n => {
      if (filterPerspectives.size && !filterPerspectives.has(n.perspective)) return false;
      if (filterDomain !== "全て" && n.domain !== filterDomain) return false;
      if (filterProduct !== "全て" && n.product !== filterProduct) return false;
      return true;
    }).map(n => n.id));
    const edges = EDGES.filter(e => {
      if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) return false;
      if (filterRelTypes.size && !filterRelTypes.has(e.type)) return false;
      return true;
    });
    const keepIds = new Set(nodeIds);
    edges.forEach(e => { keepIds.add(e.from); keepIds.add(e.to); });
    const nodes = NODES.filter(n => keepIds.has(n.id));
    return { nodes, edges };
  }, [filterPerspectives, filterDomain, filterProduct, filterRelTypes]);

  const degree = useMemo(() => {
    const d: Record<string, number> = {};
    filtered.nodes.forEach(n => d[n.id] = 0);
    filtered.edges.forEach(e => {
      d[e.from] = (d[e.from] ?? 0) + 1;
      d[e.to] = (d[e.to] ?? 0) + 1;
    });
    return d;
  }, [filtered]);

  const minR = 4; const maxR = 12;
  const scaleDeg = d3.scaleLinear().domain([0, Math.max(...Object.values(degree), 1)]).range([minR, maxR]).clamp(true);

  const initSim = useCallback(() => {
    if (!containerRef.current || !svgRef.current || filtered.nodes.length === 0) return;
    let width = containerRef.current.clientWidth;
    let height = containerRef.current.clientHeight;
    if (width <= 0) width = 800;
    if (height <= 0) height = 500;
    const nodes: D3Node[] = filtered.nodes.map(n => ({
      ...n,
      x: width * domainPositions[n.domain].x,
      y: height * domainPositions[n.domain].y,
      radius: scaleDeg(degree[n.id] ?? 0),
      perspective: n.perspective,
      domain: n.domain,
      title: n.title,
      customerLayers: n.customerLayers,
    }));
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const links: D3Link[] = filtered.edges.map(e => ({
      source: nodeMap.get(e.from)!,
      target: nodeMap.get(e.to)!,
      type: e.type,
    })).filter(l => l.source && l.target);

    const sim = d3.forceSimulation<D3Node>(nodes)
      .force("link", d3.forceLink<D3Node, D3Link>(links).id((d: D3Node) => d.id).distance(80).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("x", d3.forceX<D3Node>().x(d => width * domainPositions[d.domain].x).strength(0.08))
      .force("y", d3.forceY<D3Node>().y(d => height * domainPositions[d.domain].y).strength(0.08))
      .force("collision", d3.forceCollide<D3Node>().radius(d => d.radius + 4).strength(0.8));

    sim.tick(300);
    simRef.current = sim;
    return { nodes, links, sim, width, height };
  }, [filtered.nodes, filtered.edges, degree, scaleDeg]);

  useEffect(() => {
    const init = initSim();
    if (!init) return;
    let { nodes, links, width, height } = init;
    if (width <= 0 || height <= 0) {
      width = 800;
      height = 500;
    }
    const svg = d3.select(svgRef.current!);
    svg.selectAll("*").remove();
    svg.attr("viewBox", [0, 0, width, height]);

    const g = svg.append("g");
    const linkG = g.append("g").attr("class", "links");
    const nodeG = g.append("g").attr("class", "nodes");

    const link = linkG.selectAll("line").data(links).join("line")
      .attr("stroke", d => edgeStyles[d.type].color)
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", d => edgeStyles[d.type].dash ?? "none")
      .attr("marker-end", d => `url(#arrow-${d.type})`);
    const defs = svg.append("defs");
    REL_TYPES.forEach(t => {
      defs.append("marker").attr("id", `arrow-${t}`).attr("viewBox", "0 -5 10 10").attr("refX", 12).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
        .append("path").attr("fill", edgeStyles[t].color).attr("d", "M0,-5L10,0L0,5Z");
    });
    defs.append("marker").attr("id", "arrow").attr("viewBox", "0 -5 10 10").attr("refX", 12).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
      .append("path").attr("fill", colors.textSecondary).attr("d", "M0,-5L10,0L0,5Z");

    const node = nodeG.selectAll("circle").data(nodes).join("circle")
      .attr("r", d => d.radius)
      .attr("fill", d => perspectiveColors[d.perspective])
      .attr("stroke", colors.surface)
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .call(d3.drag<SVGCircleElement, D3Node>()
        .on("start", (ev) => { ev.sourceEvent.stopPropagation(); if (!simRef.current) return; simRef.current.alphaTarget(0.3).restart(); })
        .on("drag", (ev, d) => { d.x = ev.x; d.y = ev.y; ticked(); })
        .on("end", () => { if (!simRef.current) return; simRef.current.alphaTarget(0); }) as any);

    const label = nodeG.selectAll("text").data(nodes).join("text")
      .attr("class", "node-label")
      .attr("font-size", 11)
      .attr("fill", colors.textPrimary)
      .attr("text-anchor", "middle")
      .attr("dy", d => d.radius + 14)
      .text(d => d.title.length > 20 ? d.title.slice(0, 20) + "…" : d.title)
      .attr("pointer-events", "none");

    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 4]).on("zoom", (ev) => {
      g.attr("transform", ev.transform);
      nodeG.selectAll(".node-label").attr("opacity", ev.transform.k < 0.8 ? 0 : 1);
    });
    svg.call(zoom as any);

    const ticked = () => {
      link.attr("x1", d => (d.source as D3Node).x!).attr("y1", d => (d.source as D3Node).y!)
        .attr("x2", d => (d.target as D3Node).x!).attr("y2", d => (d.target as D3Node).y!);
      node.attr("cx", d => d.x!).attr("cy", d => d.y!);
      label.attr("x", d => d.x!).attr("y", d => d.y!);
    };

    simRef.current?.on("tick", ticked);

    const connected = (id: string) => {
      const ids = new Set<string>([id]);
      filtered.edges.forEach(e => {
        if (e.from === id || e.to === id) { ids.add(e.from); ids.add(e.to); }
      });
      return ids;
    };

    node.on("mouseover", (_ev, d) => {
      const ids = connected(d.id);
      node.attr("opacity", n => ids.has(n.id) ? 1 : 0.15);
      link.attr("opacity", l => ids.has((l.source as D3Node).id) && ids.has((l.target as D3Node).id) ? 1 : 0.15);
      label.attr("opacity", n => ids.has(n.id) ? 1 : 0.15);
    }).on("mouseout", () => {
      node.attr("opacity", 1);
      link.attr("opacity", 1);
      label.attr("opacity", 1);
    }).on("click", (ev, d) => {
      ev.stopPropagation();
      onSelectNode(d.id);
    });

    svg.on("click", () => onSelectNode(null));

    return () => { simRef.current?.stop(); };
  }, [filtered.nodes.length, filtered.edges.length, initSim, onSelectNode]);

  const selected = selectedId ? NODES.find(n => n.id === selectedId) : null;
  const selectedEdges = selectedId ? EDGES.filter(e => e.from === selectedId || e.to === selectedId) : [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-[#334155] bg-[#1E293B]">
        <span className="text-[#94A3B8] text-[13px]">観点:</span>
        {PERSPECTIVES.map(p => (
          <button
            key={p}
            onClick={() => {
              const next = new Set(filterPerspectives);
              if (next.has(p)) next.delete(p); else next.add(p);
              setFilterPerspectives(next);
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[13px] border border-[#334155] transition-colors"
            style={{ backgroundColor: filterPerspectives.has(p) ? perspectiveColors[p] + "40" : colors.surface, color: colors.textPrimary }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: perspectiveColors[p] }} />
            {p}
          </button>
        ))}
        <span className="text-[#94A3B8] text-[13px] ml-2">ドメイン:</span>
        <select value={filterDomain} onChange={e => setFilterDomain(e.target.value)} className="bg-[#1E293B] border border-[#334155] rounded px-2 py-1 text-[13px] text-[#F1F5F9]">
          <option value="全て">全て</option>
          {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="text-[#94A3B8] text-[13px]">製品:</span>
        <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className="bg-[#1E293B] border border-[#334155] rounded px-2 py-1 text-[13px] text-[#F1F5F9]">
          {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-[#94A3B8] text-[13px] ml-2">関係:</span>
        {REL_TYPES.map(t => (
          <button
            key={t}
            onClick={() => {
              const next = new Set(filterRelTypes);
              if (next.has(t)) next.delete(t); else next.add(t);
              setFilterRelTypes(next);
            }}
            className="px-2 py-1 rounded text-[13px] border transition-colors"
            style={{
              backgroundColor: filterRelTypes.has(t) ? edgeStyles[t].color + "40" : colors.surface,
              borderColor: edgeStyles[t].color,
              color: colors.textPrimary,
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex flex-1 min-h-0">
        <div ref={containerRef} className="flex-[0_0_70%] relative border-r border-[#334155] min-h-[480px]" style={{ minHeight: "60vh" }}>
          <svg ref={svgRef} className="w-full h-full block" style={{ minHeight: 480 }} />
        </div>
        <div className="flex-[0_0_30%] overflow-auto p-4 bg-[#1E293B] text-[13px]">
          {selected ? (
            <>
              <h3 className="font-semibold text-[#F1F5F9] mb-2 break-words">{selected.title}</h3>
              <div className="flex flex-wrap gap-1 mb-2">
                <span className="px-2 py-0.5 rounded text-white text-xs" style={{ backgroundColor: perspectiveColors[selected.perspective] }}>{selected.perspective}</span>
              </div>
              <p className="text-[#94A3B8] mb-1">製品: {selected.product}</p>
              <p className="text-[#94A3B8] mb-1">技術ドメイン: {selected.domain}</p>
              <p className="text-[#94A3B8] mb-3">ソース: {selected.source}</p>
              <p className="text-[#64748B] text-xs mb-1">接続先</p>
              <ul className="mb-3 space-y-1">
                {selectedEdges.map(e => {
                  const otherId = e.from === selected.id ? e.to : e.from;
                  const other = NODES.find(n => n.id === otherId);
                  return (
                    <li key={`${e.from}-${e.to}`}>
                      <button type="button" onClick={() => onSelectNode(otherId)} className="text-[#60A5FA] hover:underline text-left">
                        {other?.id} {other?.title.slice(0, 30)}…
                      </button>
                      <span className="ml-1 text-xs" style={{ color: edgeStyles[e.type].color }}>({e.type})</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[#64748B] text-xs mb-1">御社オントロジーでの位置</p>
              <div className="flex flex-wrap gap-1">
                {selected.customerLayers.map(l => (
                  <span key={l} className="px-2 py-0.5 rounded text-white text-xs" style={{ backgroundColor: layerColors[l] }}>{l}</span>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-[#94A3B8] mb-4">ノードをクリックして詳細を表示</p>
              <p className="text-[#64748B] text-xs mb-2">観点</p>
              <div className="flex flex-wrap gap-1 mb-4">
                {PERSPECTIVES.map(p => (
                  <span key={p} className="px-2 py-0.5 rounded text-white text-xs" style={{ backgroundColor: perspectiveColors[p] }}>{p}</span>
                ))}
              </div>
              <p className="text-[#64748B] text-xs mb-2">関係種別</p>
              <div className="flex flex-wrap gap-2">
                {REL_TYPES.map(t => (
                  <span key={t} className="flex items-center gap-1"><span className="w-3 h-0.5" style={{ backgroundColor: edgeStyles[t].color }} />{t}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== タブ2: 御社オントロジーとの対応 ==========
interface SankeyLinkExtra { value: number; customerLayer: CustomerLayer; perspective: Perspective }
interface SankeyNodeRect { id: string; x0?: number; y0?: number; x1?: number; y1?: number }

function OntologyMappingTab() {
  const sankeyRef = useRef<SVGSVGElement>(null);
  const [hoveredLink, setHoveredLink] = useState<SankeyLinkExtra | null>(null);

  const sankeyData = useMemo(() => {
    const nodeIds: string[] = [];
    const leftKeys: string[] = [];
    ONTOLOGY_MAPPING.forEach(row => {
      const key = `L:${row.customerLayer}`;
      if (!leftKeys.includes(key)) { leftKeys.push(key); nodeIds.push(key); }
    });
    const rightKeys: string[] = [];
    ONTOLOGY_MAPPING.forEach(row => {
      row.perspectives.forEach(p => {
        const key = `P:${p}`;
        if (!rightKeys.includes(key)) { rightKeys.push(key); nodeIds.push(key); }
      });
    });
    const linkList: { source: string; target: string; value: number; customerLayer: CustomerLayer; perspective: Perspective }[] = [];
    ONTOLOGY_MAPPING.forEach(row => {
      row.perspectives.forEach(per => {
        const v = row.perspectiveCounts[per] ?? Math.floor(row.count / row.perspectives.length);
        if (v <= 0) return;
        linkList.push({
          source: `L:${row.customerLayer}`,
          target: `P:${per}`,
          value: v,
          customerLayer: row.customerLayer,
          perspective: per,
        });
      });
    });
    const nodes = nodeIds.map(id => ({ id }));
    const links = linkList.map(l => ({
      source: l.source,
      target: l.target,
      value: l.value,
      customerLayer: l.customerLayer,
      perspective: l.perspective,
    }));
    return { nodes, links, nodeIds };
  }, []);

  useEffect(() => {
    if (!sankeyRef.current || sankeyData.links.length === 0) return;
    const width = 800;
    const height = 420;
    const sankeyGen = sankey<{ id: string }, SankeyLinkExtra>()
      .nodeWidth(12)
      .nodePadding(16)
      .extent([[0, 0], [width, height]])
      .nodeId((d: { id: string }) => d.id);
    const graph = {
      nodes: sankeyData.nodes.map(n => ({ ...n })),
      links: sankeyData.links.map(l => ({ ...l })),
    };
    const { nodes, links } = sankeyGen(graph);
    const typedLinks = links as (SankeyLinkExtra & { width?: number })[];
    const typedNodes = nodes as SankeyNodeRect[];
    const svg = d3.select(sankeyRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", [0, 0, width, height]);
    const g = svg.append("g");
    g.append("g").selectAll("path").data(typedLinks).join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("fill", "none")
      .attr("stroke", (d: SankeyLinkExtra) => perspectiveColors[d.perspective])
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d: SankeyLinkExtra & { width?: number }) => Math.max(2, d.width ?? 2))
      .on("mouseover", (_: unknown, d: SankeyLinkExtra) => setHoveredLink(d))
      .on("mouseout", () => setHoveredLink(null));
    g.append("g").selectAll("rect").data(typedNodes).join("rect")
      .attr("x", (d: SankeyNodeRect) => d.x0 ?? 0)
      .attr("y", (d: SankeyNodeRect) => d.y0 ?? 0)
      .attr("height", (d: SankeyNodeRect) => (d.y1 ?? 0) - (d.y0 ?? 0))
      .attr("width", (d: SankeyNodeRect) => (d.x1 ?? 0) - (d.x0 ?? 0))
      .attr("fill", (d: SankeyNodeRect) => {
        if (d.id.startsWith("L:")) return layerColors[d.id.slice(2) as CustomerLayer];
        return perspectiveColors[d.id.slice(2) as Perspective];
      })
      .attr("stroke", colors.border);
    g.append("g").selectAll("text").data(typedNodes).join("text")
      .attr("x", (d: SankeyNodeRect) => (d.x0 ?? 0) < width / 2 ? (d.x1 ?? 0) + 6 : (d.x0 ?? 0) - 6)
      .attr("y", (d: SankeyNodeRect) => ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d: SankeyNodeRect) => (d.x0 ?? 0) < width / 2 ? "start" : "end")
      .attr("font-size", 11)
      .attr("fill", colors.textPrimary)
      .text((d: SankeyNodeRect) => d.id.startsWith("L:") ? d.id.slice(2) : d.id.slice(2));
  }, [sankeyData]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h3 className="text-[#F1F5F9] font-semibold mb-3 text-[14px]">サンキーダイアグラム（御社オントロジー層 ⇔ 抽出観点）</h3>
        <svg ref={sankeyRef} className="w-full max-w-4xl" style={{ height: 420 }} />
        {hoveredLink && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#1E293B] border border-[#334155] rounded px-3 py-2 text-[13px] shadow-lg z-10">
            {hoveredLink.customerLayer} → {hoveredLink.perspective}（{hoveredLink.value}件）
          </div>
        )}
      </div>
      <div>
        <h3 className="text-[#F1F5F9] font-semibold mb-3 text-[14px]">対応詳細テーブル</h3>
        <div className="overflow-x-auto border border-[#334155] rounded">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-[#334155] text-left">
                <th className="p-2 border-b border-[#334155] text-[#F1F5F9]">御社のナレッジ層</th>
                <th className="p-2 border-b border-[#334155] text-[#F1F5F9]">御社の定義</th>
                <th className="p-2 border-b border-[#334155] text-[#F1F5F9]">対応する抽出観点</th>
                <th className="p-2 border-b border-[#334155] text-[#F1F5F9]">件数</th>
                <th className="p-2 border-b border-[#334155] text-[#F1F5F9]">具体的な抽出例</th>
              </tr>
            </thead>
            <tbody>
              {ONTOLOGY_MAPPING.map(row => (
                <tr key={row.customerLayer} className="border-b border-[#334155] hover:bg-[#334155]/50">
                  <td className="p-2 text-[#F1F5F9]">{row.customerLayer}</td>
                  <td className="p-2 text-[#94A3B8] max-w-[200px]">{row.customerDesc}</td>
                  <td className="p-2">
                    <span className="flex flex-wrap gap-1">
                      {row.perspectives.map(p => (
                        <span key={p} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-white text-xs" style={{ backgroundColor: perspectiveColors[p] }}>● {p}</span>
                      ))}
                    </span>
                  </td>
                  <td className="p-2 text-[#F1F5F9]">{row.count}</td>
                  <td className="p-2 text-[#94A3B8] text-xs">{row.examples.join(" / ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3 className="text-[#F1F5F9] font-semibold mb-3 text-[14px]">顧客リレーション構造との照合</h3>
        <div className="overflow-x-auto border border-[#334155] rounded">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-[#334155] text-left">
                <th className="p-2 border-b border-[#334155] text-[#F1F5F9]">御社のリレーション</th>
                <th className="p-2 border-b border-[#334155] text-[#F1F5F9]">対応する抽出関係</th>
                <th className="p-2 border-b border-[#334155] text-[#F1F5F9]">件数</th>
                <th className="p-2 border-b border-[#334155] text-[#F1F5F9]">例</th>
              </tr>
            </thead>
            <tbody>
              {RELATION_MAPPING.map((row, i) => (
                <tr key={i} className="border-b border-[#334155] hover:bg-[#334155]/50">
                  <td className="p-2 text-[#F1F5F9]">{row.customerRelation}</td>
                  <td className="p-2"><span className="px-1.5 py-0.5 rounded text-xs" style={{ color: edgeStyles[row.extractRelation].color }}>{row.extractRelation}</span></td>
                  <td className="p-2 text-[#F1F5F9]">{row.count}</td>
                  <td className="p-2 text-[#94A3B8] text-xs">{row.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ========== タブ3: 抽出統計 ==========
function StatsTab() {
  const perspectiveCounts = useMemo(() => {
    const m: Record<string, number> = {};
    NODES.forEach(n => { m[n.perspective] = (m[n.perspective] ?? 0) + 1; });
    return PERSPECTIVES.map(p => ({ name: p, count: m[p] ?? 0 }));
  }, []);
  const domainCounts = useMemo(() => {
    const m: Record<string, number> = {};
    NODES.forEach(n => { m[n.domain] = (m[n.domain] ?? 0) + 1; });
    return DOMAINS.map(d => ({ name: d, count: m[d] ?? 0 }));
  }, []);
  const relCounts = useMemo(() => {
    const m: Record<string, number> = {};
    EDGES.forEach(e => { m[e.type] = (m[e.type] ?? 0) + 1; });
    return REL_TYPES.map(t => ({ name: t, count: m[t] ?? 0 }));
  }, []);
  const maxP = Math.max(...perspectiveCounts.map(p => p.count), 1);
  const maxR = Math.max(...relCounts.map(r => r.count), 1);

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1E293B] border border-[#334155] rounded-lg p-4">
          <h3 className="text-[#F1F5F9] font-semibold mb-3 text-[14px]">観点分布</h3>
          <div className="space-y-2">
            {perspectiveCounts.map(p => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="w-[80px] text-[12px] text-[#94A3B8] truncate">{p.name}</span>
                <div className="flex-1 h-5 bg-[#334155] rounded overflow-hidden">
                  <div className="h-full rounded transition-all" style={{ width: `${(p.count / maxP) * 100}%`, backgroundColor: perspectiveColors[p.name as Perspective] }} />
                </div>
                <span className="text-[#F1F5F9] text-[12px] w-6 text-right">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#1E293B] border border-[#334155] rounded-lg p-4">
          <h3 className="text-[#F1F5F9] font-semibold mb-3 text-[14px]">技術ドメイン分布</h3>
          <svg width="240" height="240" className="mx-auto">
            {(() => {
              const total = domainCounts.reduce((a, b) => a + b.count, 0);
              if (total === 0) return null;
              let acc = 0;
              const domainChartColors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899"];
              return domainCounts.map((d, i) => {
                const ratio = d.count / total;
                const start = acc;
                acc += ratio;
                const a0 = start * 2 * Math.PI - Math.PI / 2;
                const a1 = acc * 2 * Math.PI - Math.PI / 2;
                const r0 = 70; const r1 = 100;
                const x0 = 120 + r0 * Math.cos(a0); const y0 = 120 + r0 * Math.sin(a0);
                const x1 = 120 + r1 * Math.cos(a0); const y1 = 120 + r1 * Math.sin(a0);
                const x2 = 120 + r1 * Math.cos(a1); const y2 = 120 + r1 * Math.sin(a1);
                const x3 = 120 + r0 * Math.cos(a1); const y3 = 120 + r0 * Math.sin(a1);
                const large = ratio > 0.5 ? 1 : 0;
                const path = `M ${x0} ${y0} L ${x1} ${y1} A ${r1} ${r1} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r0} ${r0} 0 ${large} 0 ${x0} ${y0}`;
                return <path key={d.name} d={path} fill={domainChartColors[i % domainChartColors.length]} stroke={colors.bg} strokeWidth={2} />;
              });
            })()}
            <circle cx="120" cy="120" r="65" fill={colors.bg} />
            <text x="120" y="118" textAnchor="middle" fill={colors.textPrimary} fontSize={14}>ドメイン</text>
          </svg>
          <div className="flex flex-wrap justify-center gap-3 mt-2 text-[12px]">
            {domainCounts.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899"][i % 5] }} />
                {d.name} {d.count}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-[#1E293B] border border-[#334155] rounded-lg p-4">
          <h3 className="text-[#F1F5F9] font-semibold mb-3 text-[14px]">関係種別分布</h3>
          <div className="space-y-2">
            {relCounts.map(r => (
              <div key={r.name} className="flex items-center gap-2">
                <span className="w-16 text-[12px] text-[#94A3B8]">{r.name}</span>
                <div className="flex-1 h-5 bg-[#334155] rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(r.count / maxR) * 100}%`, backgroundColor: edgeStyles[r.name as keyof typeof edgeStyles].color }} />
                </div>
                <span className="text-[#F1F5F9] text-[12px] w-6 text-right">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#1E293B] border border-[#334155] rounded-lg p-4">
          <h3 className="text-[#F1F5F9] font-semibold mb-3 text-[14px]">データソースサマリー</h3>
          <ul className="text-[13px] text-[#94A3B8] space-y-1">
            <li>入力VTT: 8件</li>
            <li>ナレッジ: 45件</li>
            <li>関係: 21件</li>
            <li>ドメイン: 5領域</li>
          </ul>
        </div>
      </div>
      <div className="bg-[#1E293B] border border-[#334155] rounded-lg p-4 text-[13px] text-[#94A3B8] leading-relaxed">
        現在は設計チェックシート読み合わせ会を中心に8件のVTTから抽出しています。設計レビュー会・DR会議・不具合検討会のVTTを追加することで、⑥前提条件・⑦検討漏れ・⑨影響範囲の抽出が増加し、御社オントロジーの「故障モード・故障原因」「横展開・波及リスク」層がさらに充実します。
      </div>
    </div>
  );
}

// ========== App ==========
export default function App() {
  const [tab, setTab] = useState<"graph" | "ontology" | "stats">("graph");
  const [filterPerspectives, setFilterPerspectives] = useState<Set<Perspective>>(new Set());
  const [filterDomain, setFilterDomain] = useState("全て");
  const [filterProduct, setFilterProduct] = useState("全て");
  const [filterRelTypes, setFilterRelTypes] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F1F5F9] flex flex-col">
      <header className="border-b border-[#334155] px-6 py-4">
        <h1 className="text-[18px] font-semibold text-white">TICO エレクトロニクス技術部 ナレッジグラフ PoC</h1>
        <p className="text-[14px] text-[#94A3B8] mt-1">会議VTT 8件 → 45ナレッジ × 21関係 を自動抽出</p>
      </header>
      <nav className="flex border-b border-[#334155] px-6 gap-6">
        {(["graph", "ontology", "stats"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="py-3 text-[14px] font-medium border-b-2 transition-colors"
            style={{
              borderColor: tab === t ? colors.accent : "transparent",
              color: tab === t ? colors.textPrimary : colors.textSecondary,
            }}
          >
            {t === "graph" && "ナレッジグラフ"}
            {t === "ontology" && "御社オントロジーとの対応"}
            {t === "stats" && "抽出統計"}
          </button>
        ))}
      </nav>
      <main className="flex-1 min-h-0 overflow-auto min-h-[60vh]">
        {tab === "graph" && (
          <KnowledgeGraphTab
            filterPerspectives={filterPerspectives}
            filterDomain={filterDomain}
            filterProduct={filterProduct}
            filterRelTypes={filterRelTypes}
            setFilterPerspectives={setFilterPerspectives}
            setFilterDomain={setFilterDomain}
            setFilterProduct={setFilterProduct}
            setFilterRelTypes={setFilterRelTypes}
            selectedId={selectedId}
            onSelectNode={setSelectedId}
          />
        )}
        {tab === "ontology" && <OntologyMappingTab />}
        {tab === "stats" && <StatsTab />}
      </main>
    </div>
  );
}
