import { useEffect, useRef, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

/**
 * 这些事件在“孤岛”里发生时，不让它们冒泡到外层编辑器：
 * 否则编辑器会把在里面打字、拖卡片当成是在编辑正文。
 * 鼠标移动类事件不拦，块左侧的拖动手柄仍然要靠它们显示。
 */
const ISOLATED_EVENTS = [
  "keydown",
  "keyup",
  "keypress",
  "beforeinput",
  "input",
  "compositionstart",
  "compositionupdate",
  "compositionend",
  "paste",
  "copy",
  "cut",
  "mousedown",
  "click",
  "dblclick",
  "contextmenu",
  "dragstart",
  "dragenter",
  "dragover",
  "dragleave",
  "drop",
  "dragend",
];

interface Props {
  /** 变了就重新挂载里面的内容 */
  id: string;
  className: string;
  interactive: boolean;
  render: () => ReactElement;
}

/**
 * 在编辑器的一个块里放一块“自成一体”的界面（内嵌数据库、同步块）。
 * 里面是独立的 React 根，有自己的事件入口；外面拦住事件，编辑器完全感知不到里面的操作。
 */
export function Island({ id, className, interactive, render }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef(render);
  renderRef.current = render;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const mount = document.createElement("div");
    host.appendChild(mount);
    const root = createRoot(mount);
    root.render(renderRef.current());

    const stop = (e: Event) => e.stopPropagation();
    for (const type of ISOLATED_EVENTS) host.addEventListener(type, stop);

    return () => {
      for (const type of ISOLATED_EVENTS) host.removeEventListener(type, stop);
      // 不能在外层 React 渲染过程中同步卸载另一个根，推迟到下一个任务
      window.setTimeout(() => {
        root.unmount();
        mount.remove();
      }, 0);
    };
  }, [id]);

  return <div ref={hostRef} className={className} contentEditable={false} inert={!interactive} />;
}
