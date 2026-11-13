/** 首次启动时写入的示例内容（BlockNote 的 PartialBlock 格式）。 */
import type { DatabaseDef, PropValue } from "../shared/types.ts";

const text = (t: string, styles: Record<string, unknown> = {}) => ({
  type: "text",
  text: t,
  styles,
});

export const welcomeContent: unknown[] = [
  {
    type: "paragraph",
    content: [
      text("这是一个完全运行在你电脑上的笔记工作区。所有内容都以 JSON 文件保存在本机，不依赖任何云服务。桌面版可以从菜单“文件 → 打开数据文件夹”找到它们，网页版则在项目的 "),
      text("data/", { code: true }),
      text(" 目录里。"),
    ],
  },
  { type: "heading", props: { level: 2 }, content: "快速上手" },
  {
    type: "checkListItem",
    props: { checked: true },
    content: "打开这个页面",
  },
  {
    type: "checkListItem",
    content: [text("输入 "), text("/", { code: true }), text(" 唤出命令菜单，插入标题、列表、表格、代码块、图片等")],
  },
  {
    type: "checkListItem",
    content: [text("输入 "), text("@", { code: true }), text(" 链接到其他页面")],
  },
  { type: "checkListItem", content: "把鼠标移到任意块的左侧，拖动手柄调整顺序" },
  { type: "checkListItem", content: "选中文字，设置加粗、颜色、链接" },
  {
    type: "checkListItem",
    content: [text("按 "), text("⌘K", { code: true }), text(" / "), text("Ctrl+K", { code: true }), text(" 搜索所有页面")],
  },
  { type: "heading", props: { level: 2 }, content: "页面可以无限嵌套" },
  {
    type: "bulletListItem",
    content: "在左侧边栏，把鼠标移到页面上点 + 新建子页面",
  },
  { type: "bulletListItem", content: "拖动侧边栏中的页面，可以排序或移动到其他页面下" },
  { type: "bulletListItem", content: "删除的页面会进入回收站，可以随时恢复" },
  { type: "heading", props: { level: 2 }, content: "一些块的示例" },
  {
    type: "quote",
    content: "好记性不如烂笔头。",
  },
  {
    type: "codeBlock",
    props: { language: "typescript" },
    content: 'const hello = (name: string) => `你好，${name}！`;',
  },
  {
    type: "table",
    content: {
      type: "tableContent",
      rows: [
        { cells: ["快捷键", "作用"] },
        { cells: ["⌘K / Ctrl+K", "搜索"] },
        { cells: ["⌘\\ / Ctrl+\\", "收起或展开侧边栏"] },
        { cells: ["⌘B / ⌘I / ⌘U", "加粗 / 斜体 / 下划线"] },
      ],
    },
  },
  { type: "paragraph" },
];

export const notesContent: unknown[] = [
  { type: "paragraph", content: "这是一个子页面。你可以用它来存放某个主题下的笔记。" },
  { type: "heading", props: { level: 3 }, content: "待办" },
  { type: "checkListItem", content: "写下第一条笔记" },
  { type: "checkListItem", content: "给页面换一个图标和封面" },
  { type: "paragraph" },
];

/** 示例数据库：一个带状态、优先级、日期的任务清单。 */
export const sampleDatabase: DatabaseDef = {
  properties: [
    {
      id: "status",
      name: "状态",
      type: "select",
      options: [
        { id: "todo", name: "待办", color: "gray" },
        { id: "doing", name: "进行中", color: "blue" },
        { id: "done", name: "已完成", color: "green" },
      ],
    },
    {
      id: "priority",
      name: "优先级",
      type: "select",
      options: [
        { id: "high", name: "高", color: "red" },
        { id: "mid", name: "中", color: "yellow" },
        { id: "low", name: "低", color: "gray" },
      ],
    },
    { id: "due", name: "截止日期", type: "date" },
    {
      id: "tags",
      name: "标签",
      type: "multiSelect",
      options: [
        { id: "work", name: "工作", color: "purple" },
        { id: "life", name: "生活", color: "orange" },
      ],
    },
  ],
  views: [
    { id: "board", name: "看板", type: "board", groupBy: "status" },
    { id: "table", name: "表格", type: "table" },
    { id: "calendar", name: "日历", type: "calendar", dateProp: "due" },
  ],
};

export const sampleRows: { title: string; props: Record<string, PropValue> }[] = [
  { title: "试着拖动这张卡片到“进行中”", props: { status: "todo", priority: "high", tags: ["work"] } },
  { title: "切换到表格视图，添加一个属性", props: { status: "todo", priority: "mid" } },
  { title: "点开卡片，在里面写点内容", props: { status: "doing", priority: "low", tags: ["life"] } },
  { title: "创建第一个数据库", props: { status: "done" } },
];
