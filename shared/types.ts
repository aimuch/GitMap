export type PageKind = "page" | "database";

export type PropType = "text" | "number" | "select" | "multiSelect" | "date" | "checkbox" | "url";

/** 属性值：文本/网址/日期/单选为字符串，多选为选项 id 数组 */
export type PropValue = string | number | boolean | string[] | null;

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export interface PropertyDef {
  id: string;
  name: string;
  type: PropType;
  options?: SelectOption[];
}

export type FilterOp =
  | "contains"
  | "notContains"
  | "is"
  | "isNot"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "before"
  | "after"
  | "isEmpty"
  | "isNotEmpty"
  | "checked"
  | "unchecked";

export interface FilterRule {
  id: string;
  /** "title" 表示名称 */
  propId: string;
  op: FilterOp;
  /** 文本、数字、日期或选项 id；不需要值的条件（为空、已勾选等）留空 */
  value?: string;
}

export interface ViewDef {
  id: string;
  name: string;
  type: "table" | "board" | "calendar";
  /** 看板按哪个单选属性分组 */
  groupBy?: string | null;
  /** 日历按哪个日期属性排布 */
  dateProp?: string | null;
  /** propId 为 "title" 表示按名称排序 */
  sort?: { propId: string; dir: "asc" | "desc" } | null;
  filters?: FilterRule[];
  /** 多个筛选条件之间的关系，默认 and */
  filterMode?: "and" | "or";
}

export interface DatabaseDef {
  properties: PropertyDef[];
  views: ViewDef[];
}

export interface PageMeta {
  id: string;
  title: string;
  icon: string | null;
  /** 预设封面的 key（如 "preset:sunset"）或上传图片的 URL */
  cover: string | null;
  parentId: string | null;
  order: number;
  favorite: boolean;
  fullWidth: boolean;
  trashed: boolean;
  trashedAt: number | null;
  createdAt: number;
  updatedAt: number;
  /** 数据库页面的子页面就是它的“行” */
  kind: PageKind;
  /** 仅 kind 为 database 时有值：属性定义与视图 */
  database: DatabaseDef | null;
  /** 作为数据库的一行时，各属性的值（key 为属性 id） */
  props: Record<string, PropValue>;
}

export interface PageRecord extends PageMeta {
  /** BlockNote 文档 JSON */
  content: unknown[];
}

export type PagePatch = Partial<
  Pick<
    PageRecord,
    "title" | "icon" | "cover" | "favorite" | "fullWidth" | "content" | "kind" | "database" | "props"
  >
>;

export interface NewPageInput {
  parentId?: string | null;
  title?: string;
  icon?: string | null;
  kind?: PageKind;
  database?: DatabaseDef | null;
  props?: Record<string, PropValue>;
}

export interface SearchHit {
  id: string;
  title: string;
  icon: string | null;
  snippet: string;
}
