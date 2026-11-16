import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CornerDownLeft, FileStack, FileText, History, Search, SearchX } from "lucide-react";
import type { SearchHit } from "../../shared/types";
import { ancestorsOf, navigate, searchPages, setSearchOpen, useStore } from "../store";
import { cx } from "./Popover";

export function SearchModal() {
  const pages = useStore((s) => s.pages);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const q = query.trim();

  // 没有输入时显示最近编辑的页面
  const recent = useMemo<SearchHit[]>(
    () =>
      Object.values(pages)
        .filter((p) => !p.trashed && !p.hidden)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 8)
        .map((p) => ({ id: p.id, title: p.title, icon: p.icon, snippet: "" })),
    [pages],
  );

  useEffect(() => {
    if (!q) {
      setHits(null);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      searchPages(q).then(
        (result) => {
          if (!alive) return;
          setHits(result);
          setIndex(0);
        },
        () => alive && setHits([]),
      );
    }, 120);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [q]);

  const items = q ? (hits ?? []) : recent;
  const close = () => setSearchOpen(false);
  const open = (id: string) => {
    navigate(id);
    close();
  };

  useEffect(() => {
    listRef.current?.querySelector(".search-row.selected")?.scrollIntoView({ block: "nearest" });
  }, [index]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="search-modal" role="dialog" aria-modal="true" aria-label="搜索">
        <div className="search-input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            placeholder="搜索页面标题或内容…"
            aria-label="搜索"
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(items.length - 1, i + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              }
              if (e.key === "Enter" && items[index]) open(items[index].id);
            }}
          />
        </div>
        <div className="search-results" ref={listRef}>
          {!q && items.length > 0 && (
            <div className="search-group">
              <History size={12} /> 最近编辑
            </div>
          )}
          {items.map((hit, i) => {
            const path = ancestorsOf(pages, hit.id)
              .map((p) => p.title || "无标题")
              .join(" / ");
            return (
              <button
                key={hit.id}
                type="button"
                className={cx("search-row", i === index && "selected")}
                onMouseMove={() => setIndex(i)}
                onClick={() => open(hit.id)}
              >
                <span className="tree-icon">{hit.icon ?? <FileText size={16} />}</span>
                <span className="search-text">
                  <span className="search-title">
                    <Highlight text={hit.title || "无标题"} query={q} />
                    {path && <span className="search-path">{path}</span>}
                  </span>
                  {hit.snippet && (
                    <span className="search-snippet">
                      <Highlight text={hit.snippet} query={q} />
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {q && hits !== null && hits.length === 0 && (
            <div className="search-empty">
              <SearchX size={28} strokeWidth={1.5} />
              没有找到“{q}”相关的页面
            </div>
          )}
          {!q && items.length === 0 && (
            <div className="search-empty">
              <FileStack size={28} strokeWidth={1.5} />
              还没有页面
            </div>
          )}
        </div>
        <div className="search-footer">
          <span>
            <kbd>
              <ArrowUp size={11} />
            </kbd>
            <kbd>
              <ArrowDown size={11} />
            </kbd>{" "}
            选择
          </span>
          <span>
            <kbd>
              <CornerDownLeft size={11} />
            </kbd>{" "}
            打开
          </span>
          <span>
            <kbd>Esc</kbd> 关闭
          </span>
        </div>
      </div>
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}
