/** 内置模板：在空白页面上一键套用的正文骨架（BlockNote 的 PartialBlock 格式）。 */

export interface BuiltinTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  content: unknown[];
}

const h = (level: number, text: string) => ({ type: "heading", props: { level }, content: text });
const p = (text = "") => ({ type: "paragraph", content: text });
const todo = (text: string) => ({ type: "checkListItem", content: text });
const li = (text: string) => ({ type: "bulletListItem", content: text });

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "meeting",
    name: "会议纪要",
    icon: "🗓️",
    description: "议题、结论和待办",
    content: [
      h(2, "基本信息"),
      li("时间："),
      li("参会人："),
      h(2, "议题"),
      { type: "numberedListItem", content: "" },
      h(2, "结论"),
      li(""),
      h(2, "待办"),
      todo("负责人 · 事项 · 截止日期"),
      p(),
    ],
  },
  {
    id: "todo",
    name: "待办清单",
    icon: "✅",
    description: "按今天、本周、以后分组",
    content: [h(2, "今天"), todo(""), h(2, "本周"), todo(""), h(2, "以后再说"), todo(""), p()],
  },
  {
    id: "weekly",
    name: "周计划",
    icon: "📅",
    description: "目标、每日安排和复盘",
    content: [
      h(2, "本周目标"),
      todo(""),
      h(2, "每日安排"),
      {
        type: "table",
        content: {
          type: "tableContent",
          rows: [
            { cells: ["周一", "周二", "周三", "周四", "周五"] },
            { cells: ["", "", "", "", ""] },
          ],
        },
      },
      h(2, "复盘"),
      li("做得好的："),
      li("可以改进的："),
      p(),
    ],
  },
  {
    id: "reading",
    name: "读书笔记",
    icon: "📚",
    description: "摘录、想法和行动",
    content: [
      h(2, "基本信息"),
      li("书名："),
      li("作者："),
      h(2, "一句话总结"),
      { type: "quote", content: "" },
      h(2, "摘录"),
      li(""),
      h(2, "我的想法"),
      p(),
      h(2, "可以付诸行动的"),
      todo(""),
      p(),
    ],
  },
];
