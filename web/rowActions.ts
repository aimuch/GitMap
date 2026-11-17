const ROW_ACTION_ICONS: { readonly [action: string]: string } = {
	createBranch: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="4.5" cy="3.5" r="1.5"/><circle cx="4.5" cy="12.5" r="1.5"/><path d="M4.5 5v6"/><path d="M4.5 9.5c0-2.5 2-3 4.5-3"/><path d="M12 4v5M9.5 6.5h5"/></svg>',
	checkout: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="8" r="3"/><path d="M1.5 8h6M5 5.5L7.5 8 5 10.5"/></svg>',
	cherrypick: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="4.5" cy="11.5" r="2.5"/><circle cx="11.5" cy="11.5" r="2.5"/><path d="M4.5 9c.5-3 3-5.5 6.5-6.5M11.5 9c-.5-2.5-.5-4.5-.5-6.5"/></svg>',
	copyHash: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5V3a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3v5.5A1.5 1.5 0 0 0 3.5 10H4"/></svg>',
	more: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.25"/><circle cx="8" cy="8" r="1.25"/><circle cx="12.5" cy="8" r="1.25"/></svg>'
};

/**
 * Implements the buttons of the most common actions on a commit, shown on its row while the mouse is over it (as in GitLens), and a
 * button that opens the rest of the commit's actions. Which actions are buttons (and in which order), and whether they're at the end of
 * the Description column or of the row, are set with "Customize Row Hover Buttons…" (the `git-map.commitRow.*` Extension Settings).
 * They run the same actions as the commit's context menu (and are hidden when the context menu doesn't show them).
 */
class RowActions {
	private readonly view: GitGraphView;
	private readonly elem: HTMLElement;
	private commitElem: HTMLElement | null = null;
	private hostElem: HTMLElement | null = null;
	private target: (ContextMenuTarget & DialogTarget & CommitTarget) | null = null;
	private actions: ContextMenuActions = [];
	private shown: ContextMenuAction[] = [];

	/**
	 * Construct a new RowActions instance.
	 * @param view The Git Map View.
	 */
	constructor(view: GitGraphView) {
		this.view = view;
		this.elem = document.createElement('div');
		this.elem.id = 'rowActions';
		this.elem.setAttribute('role', 'toolbar');

		// The buttons are inside the row, so their events aren't handled by the row (which would open the Commit Details View)
		this.elem.addEventListener('click', (e) => {
			handledEvent(e);
			const buttonElem = e.target instanceof Element ? <HTMLElement | null>e.target.closest('.rowAction') : null;
			if (buttonElem !== null) this.run(buttonElem);
		});
		['dblclick', 'contextmenu', 'mousedown'].forEach((type) => this.elem.addEventListener(type, (e) => e.stopPropagation()));
	}

	/**
	 * Show the buttons on the row of a commit (they aren't shown on the uncommitted changes & stashes).
	 * @param commitElem The row of the commit.
	 */
	public show(commitElem: HTMLElement) {
		if (commitElem === this.commitElem && this.elem.isConnected) return;
		const config = this.view.getRowActionsConfig();
		const commit = this.view.getCommitOfElem(commitElem);
		const cellElem = <HTMLElement | null>(config.position === 'Row' ? commitElem.lastElementChild : commitElem.querySelector('td.descriptionCol'));
		if (commit === null || commit.hash === UNCOMMITTED || commit.stash !== null || cellElem === null) {
			this.hide();
			return;
		}

		const target: ContextMenuTarget & DialogTarget & CommitTarget = { type: TargetType.Commit, hash: commit.hash, index: parseInt(commitElem.dataset.id!), elem: commitElem };
		const actions = this.view.actions.getCommitContextMenuActions(target);
		const actionMap = new Map<string, ContextMenuAction>();
		actions.forEach((group) => group.forEach((action) => {
			if (typeof action.id === 'string') actionMap.set(action.id, action);
		}));
		const shown = config.actions.map((id) => actionMap.get(id)).filter((action): action is ContextMenuAction => typeof action !== 'undefined' && action.visible);
		this.target = target;
		this.actions = actions;
		this.shown = shown;

		// The titles are HTML (e.g. "&#8230;"), as in the context menu
		const button = (action: string, title: string, icon: string) => '<button type="button" class="rowAction" data-action="' + action + '" title="' + title + '" aria-label="' + title + '" tabindex="-1">' + icon + '</button>';
		this.elem.innerHTML = shown.map((action, index) => button(String(index), action.title, ROW_ACTION_ICONS[action.id!] || action.icon || '')).join('') +
			button('more', t('More Actions') + ELLIPSIS, ROW_ACTION_ICONS.more);

		if (this.hostElem !== cellElem) {
			this.releaseHost();
			cellElem.classList.add('rowActionsHost');
			if (config.position === 'Row') cellElem.classList.add('rowActionsHostRow');
			this.hostElem = cellElem;
		}
		cellElem.appendChild(this.elem);
		this.commitElem = commitElem;
	}

	/**
	 * Hide the buttons.
	 */
	public hide() {
		this.elem.remove();
		this.releaseHost();
		this.commitElem = null;
		this.target = null;
	}

	private releaseHost() {
		if (this.hostElem !== null) {
			this.hostElem.classList.remove('rowActionsHost', 'rowActionsHostRow');
			this.hostElem = null;
		}
	}

	/**
	 * Run the action of a button.
	 * @param buttonElem The button.
	 */
	private run(buttonElem: HTMLElement) {
		const target = this.target;
		if (target === null) return;
		const action = buttonElem.dataset.action!;
		if (action === 'more') {
			const bounds = buttonElem.getBoundingClientRect();
			const moreActions = this.actions.concat([[{
				title: t('Customize Row Hover Buttons') + ELLIPSIS,
				icon: MENU_ICONS.settings,
				visible: true,
				onClick: () => this.view.openCdvActionsCustomizer('row')
			}]]);
			contextMenu.show(moreActions, false, target, new MouseEvent('contextmenu', { clientX: Math.round(bounds.left), clientY: Math.round(bounds.bottom) }), this.view.viewElem);
		} else {
			const item = this.shown[parseInt(action)];
			if (typeof item !== 'undefined') item.onClick();
		}
	}
}
