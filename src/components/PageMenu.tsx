import { useEffect, useRef, useState } from "react";
import {
  Clock,
  Copy,
  Download,
  FileText,
  Link2,
  PencilLine,
  Star,
  StarOff,
  Trash2,
  UnfoldHorizontal,
} from "lucide-react";
import type { PageMeta } from "../../shared/types";
import {
  buildTree,
  duplicatePage,
  getState,
  isDescendant,
  navigate,
  trashPage,
  updatePage,
} from "../store";
import { MenuDivider, MenuItem, Popover } from "./Popover";

/** 把页面移到回收站；如果正在查看它（或它的子页面），跳到别的页面。 */
export async function trashAndLeave(id: string, currentId: string | null) {
  const before = getState().pages;
  const viewing = currentId !== null && (currentId === id || isDescendant(before, currentId, id));
  await trashPage(id);
  if (viewing) {
    const roots = buildTree(getState().pages).children.get("") ?? [];
    navigate(before[id]?.parentId && !getState().pages[before[id].parentId!]?.trashed ? before[id].parentId : (roots[0]?.id ?? null));
  }
}

interface Props {
  page: PageMeta;
  anchor: HTMLElement;
  currentId: string | null;
  onClose: () => void;
  align?: "start" | "end";
  /** 顶栏菜单里额外提供的操作 */
  onExport?: () => void;
  exportLabel?: string;
  showLayout?: boolean;
}

export function PageMenu({ page, anchor, currentId, onClose, align, onExport, exportLabel, showLayout }: Props) {
  const [renaming, setRenaming] = useState(false);
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  if (renaming) {
    return (
      <Popover anchor={anchor} onClose={onClose} align={align}>
        <RenameForm page={page} onDone={onClose} />
      </Popover>
    );
  }

  return (
    <Popover anchor={anchor} onClose={onClose} align={align} className="menu">
      <MenuItem
        icon={page.favorite ? <StarOff size={16} /> : <Star size={16} />}
        label={page.favorite ? "取消收藏" : "添加到收藏"}
        onClick={run(() => updatePage(page.id, { favorite: !page.favorite }))}
      />
      {!showLayout && <MenuItem icon={<PencilLine size={16} />} label="重命名" onClick={() => setRenaming(true)} />}
      <MenuItem
        icon={<Copy size={16} />}
        label="创建副本"
        onClick={run(async () => {
          const id = await duplicatePage(page.id);
          if (id) navigate(id);
        })}
      />
      <MenuItem
        icon={<Link2 size={16} />}
        label="复制链接"
        onClick={run(() => {
          const url = `${window.location.origin}${window.location.pathname}#/${page.id}`;
          void navigator.clipboard?.writeText(url);
        })}
      />
      {showLayout && (
        <MenuItem
          icon={<UnfoldHorizontal size={16} />}
          label={page.fullWidth ? "恢复默认宽度" : "全宽显示"}
          onClick={run(() => updatePage(page.id, { fullWidth: !page.fullWidth }))}
        />
      )}
      {onExport && <MenuItem icon={<Download size={16} />} label={exportLabel ?? "导出为 Markdown"} onClick={run(onExport)} />}
      <MenuDivider />
      <MenuItem
        icon={<Trash2 size={16} />}
        label="移到回收站"
        danger
        onClick={run(() => void trashAndLeave(page.id, currentId))}
      />
      <div className="menu-footnote">
        <Clock size={12} />
        最后编辑于 {new Date(page.updatedAt).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" })}
      </div>
    </Popover>
  );
}

function RenameForm({ page, onDone }: { page: PageMeta; onDone: () => void }) {
  const [value, setValue] = useState(page.title);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <form
      className="rename-form"
      onSubmit={(e) => {
        e.preventDefault();
        onDone();
      }}
    >
      <span className="rename-icon">{page.icon ?? <FileText size={16} />}</span>
      <input
        ref={ref}
        value={value}
        placeholder="无标题"
        aria-label="页面标题"
        onChange={(e) => {
          setValue(e.target.value);
          updatePage(page.id, { title: e.target.value });
        }}
      />
    </form>
  );
}
