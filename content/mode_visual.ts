declare namespace VisualModeNS {
  const enum Action {

  }
  type ValidActions = VisualModeNS.Action | ((this: {}, count: number) => void);
  type ForwardDir = 0 | 1;
  const enum G {
    character = 0, line = 1, lineboundary = 2, paragraph = 3, sentence = 4, word = 6, documentboundary = 7,
  }
  const enum VimG {
    vimword = 5,
  }

}
var VVisualMode = {
  mode_: VisualModeNS.Mode.NotActive,
  hud_: "",
  hudTimer_: 0,
  currentCount_: 0,
  currentSeconds_: null as SafeDict<VisualModeNS.ValidActions> | null,
  retainSelection_: false,
  selection_: null as never as Selection,
  activate_ (this: void, _0: number, options: CmdOptions["visualMode"]): void {
    const a = VVisualMode;
    let sel: Selection, type: string, mode: CmdOptions["visualMode"]["mode"] = options.mode;
    a.init_ && a.init_(options.words as string);
    VDom.docSelectable_ = VDom.UI.getDocSelectable_();
    a.movement_.selection_ = a.selection_ = sel = VDom.UI.getSelection_();
    VUtils.remove_(a);
    VUtils.push_(a.onKeydown_, a);
    type = sel.type;
    if (!a.mode_) { a.retainSelection_ = type === "Range"; }
    a.mode_ = mode;
    if (mode !== VisualModeNS.Mode.Caret) {
      a.movement_.alterMethod_ = "extend";
      const lock = VEventMode.lock_();
      if (!lock && (type === "Caret" || type === "Range")) {
        const { left: l, top: t, right: r, bottom: b} = sel.getRangeAt(0).getBoundingClientRect();
        VDom.getZoom_(1);
        VDom.prepareCrop_();
        if (!VDom.cropRectToVisible_(l, t, (l || r) && r + 3, (t || b) && b + 3)) {
          sel.removeAllRanges();
        } else if (type === "Caret") {
          a.movement_.extendByOneCharacter_(1) || a.movement_.extend_(0);
        }
        type = sel.type;
      }
      if (type !== "Range" && (!lock || sel.toString().length <= 0)) {
        mode = VisualModeNS.Mode.Caret;
      }
    }
    a.hudTimer_ && clearTimeout(a.hudTimer_);
    VHUD.show_(a.hud_ = (mode === VisualModeNS.Mode.Caret ? "Caret" : mode === VisualModeNS.Mode.Line ? "Line" : "Visual") + " mode", !!options.from_find);
    if (a.mode_ !== mode) {
      a.mode_ = mode;
      a.prompt_("No usable selection, entering caret mode\u2026", 1000);
    }
    VDom.UI.toggleSelectStyle_(true);
    if (mode !== VisualModeNS.Mode.Caret) { return mode === VisualModeNS.Mode.Line ? a.movement_.extendToLine_() : undefined; }
    a.movement_.alterMethod_ = "move";
    if (type === "Range") {
      a.movement_.collapseSelectionTo_(0);
    } else if (type === "None" && a.establishInitialSelectionAnchor_()) {
      a.deactivate_();
      return VHUD.tip("Create a selection before entering visual mode.");
    }
    a.movement_.extend_(1);
    a.movement_.scrollIntoView_();
  },
  deactivate_ (isEsc?: 1): void {
    if (!this.mode_) { return; }
    VUtils.remove_(this);
    if (!this.retainSelection_) {
      this.movement_.collapseSelectionTo_(isEsc && this.mode_ !== VisualModeNS.Mode.Caret ? 1 : 0);
    }
    const el = VEventMode.lock_();
    el && VDom.getEditableType_(el) && el.blur && el.blur();
    VDom.UI.toggleSelectStyle_(false);
    this.mode_ = VisualModeNS.Mode.NotActive; this.hud_ = "";
    this.retainSelection_ = false;
    this.selection_ = this.movement_.selection_ = null as never;
    return VHUD.hide_();
  },
  onKeydown_ (event: KeyboardEvent): HandlerResult {
    let i: VKeyCodes | KeyStat = event.keyCode, count = 0;
    if (i > VKeyCodes.maxNotFn && i < VKeyCodes.minNotFn) { return i === VKeyCodes.f1 ? HandlerResult.Prevent : HandlerResult.Nothing; }
    if (i === VKeyCodes.enter) {
      i = VKeyboard.getKeyStat_(event);
      if ((i & KeyStat.shiftKey) && this.mode_ !== VisualModeNS.Mode.Caret) { this.retainSelection_ = true; }
      (i & KeyStat.PrimaryModifier) ? this.deactivate_() : this.yank_(i === KeyStat.altKey || null);
      return HandlerResult.Prevent;
    }
    if (VKeyboard.isEscape_(event)) {
      this.currentCount_ || this.currentSeconds_ ? this.resetKeys_() : this.deactivate_(1);
      return HandlerResult.Prevent;
    }
    const ch = VKeyboard.char(event);
    if (!ch) { this.resetKeys_(); return i === VKeyCodes.ime || i === VKeyCodes.menuKey ? HandlerResult.Nothing : HandlerResult.Suppress; }
    let key = VKeyboard.key(event, ch), obj: SafeDict<VisualModeNS.ValidActions> | null | VisualModeNS.ValidActions | undefined;
    key = VEventMode.mapKey_(key);
    if (obj = this.currentSeconds_) {
      obj = obj[key];
      count = this.currentCount_;
      this.resetKeys_();
    }
    if (obj != null) {}
    else if (key.length === 1 && (i = +key[0]) < 10 && (i || this.currentCount_)) {
      this.currentCount_ = this.currentCount_ * 10 + i;
      this.currentSeconds_ = null;
    } else if ((obj = this.keyMap_[key]) == null) {
      this.currentCount_ = 0;
    } else if (typeof obj === "object") {
      this.currentSeconds_ = obj;
      obj = null;
    } else {
      count = this.currentCount_;
      this.currentCount_ = 0;
    }
    if (obj == null) { return ch.length === 1 && ch === key ? HandlerResult.Prevent : HandlerResult.Suppress; }
    this.commandHandler_(obj, count || 1);
    return HandlerResult.Prevent;
  },
  resetKeys_ (): void {
    this.currentCount_ = 0; this.currentSeconds_ = null;
  },
  commandHandler_ (command: VisualModeNS.ValidActions, count: number): void {
    if (command > 50) {
      if (command > 60) {
        return VScroller.scrollBy_(1, (command === 61 ? 1 : -1) * count, 0);
      }
      if (command === 53 && this.mode_ !== VisualModeNS.Mode.Caret) {
        const flag = this.selection_.toString().length > 1;
        this.movement_.collapseSelectionTo_(+flag as 0 | 1);
      }
      ;
      return this.activate_(1, VUtils.safer_({
        // command === 1 ? VisualModeNS.Mode.Visual : command === 2 : VisualModeNS.Mode.Line : VisualModeNS.Mode.Caret
        mode: <number>command - 50
      }));
    }
    this.mode_ === VisualModeNS.Mode.Caret && this.movement_.collapseSelectionTo_(0);
    if (command >= 0) {
      this.movement_.runMovements_(((command as number) & 1) as 0 | 1, (command as number) >>> 1, count);
    } else {
      (command as (count: number) => void).call(this, count);
    }
    this.mode_ === VisualModeNS.Mode.Caret ? this.movement_.extend_(1)
    : this.mode_ === VisualModeNS.Mode.Line ? this.movement_.extendToLine_() : 0;
  },
  establishInitialSelectionAnchor_ (): boolean {
    let node: Text | null, str: string | undefined, offset: number;
    if (!VDom.isHTML_()) { return true; }
    VDom.getZoom_(1);
    VDom.prepareCrop_();
    const nodes = document.createTreeWalker(document.body || document.documentElement as HTMLElement, NodeFilter.SHOW_TEXT);
    while (node = nodes.nextNode() as Text | null) {
      if (50 <= (str = node.data).length && 50 < str.trim().length) {
        const element = node.parentElement;
        // Note(gdh1995): I'm not sure whether element might be null
        if (element && VDom.getVisibleClientRect_(element) && !VDom.getEditableType_(element)) {
          break;
        }
      }
    }
    if (!node) { return true; }
    offset = ((str as string).match(<RegExpOne>/^\s*/) as RegExpMatchArray)[0].length;
    this.selection_.collapse(node, offset);
    return !this.selection_.rangeCount;
  },
  prompt_ (text: string, duration: number): void {
    this.hudTimer_ && clearTimeout(this.hudTimer_);
    this.hudTimer_ = setTimeout(this.ResetHUD_, duration);
    return VHUD.show_(text);
  },
  ResetHUD_ (i?: TimerType.fake | undefined): void {
    const _this = VVisualMode;
    if (!_this || i) { return; }
    _this.hudTimer_ = 0;
    if (_this.hud_) { return VHUD.show_(_this.hud_); }
  },
  find_ (count: number): void {
    if (!VFindMode.query_) {
      VPort.send_({ msg: "findQuery" }, function(query): void {
        if (query) {
          VFindMode.updateQuery_(query);
          return VVisualMode.find_(count);
        } else {
          return VVisualMode.prompt_("No history queries", 1000);
        }
      });
      return;
    }
    const range = this.selection_.getRangeAt(0);
    VFindMode.execute_(null, { noColor: true, count });
    if (VFindMode.hasResults_) {
      if (this.mode_ === VisualModeNS.Mode.Caret && this.selection_.toString().length > 0) {
        this.activate_(1, Object.create(null) as SafeObject & CmdOptions["visualMode"]);
      }
      return;
    }
    this.selection_.removeAllRanges();
    this.selection_.addRange(range);
    return this.prompt_("No matches for " + VFindMode.query_, 1000);
  },
  yank_ (action?: true | ReuseType.current | ReuseType.newFg | null): void {
    const str = this.selection_.toString();
    if (action === true) {
      this.prompt_(VHUD.copied(str, "", true), 2000);
      action = null;
    } else {
      this.deactivate_();
      action != null || VHUD.copied(str);
    }
    VPort.post(action != null ? { handler: "openUrl", url: str, reuse: action }
        : { handler: "copy", data: str });
  },

movement_: {
  D: ["backward", "forward"] as ["backward", "forward"],
  G: ["character", "line", "lineboundary", /*3*/ "paragraph", "sentence", "vimword", /*6*/ "word",
      "documentboundary"] as
     ["character", "line", "lineboundary", /*3*/ "paragraph", "sentence", "vimword", /*6*/ "word",
      "documentboundary"],
  alterMethod_: "" as "move" | "extend",
  diOld_: 0 as VisualModeNS.ForwardDir,
  diNew_: 0 as VisualModeNS.ForwardDir,
  noExtend_: false,
  selection_: null as never as Selection,
  wordRe_: null as never as RegExpOne,
  extend_ (d: VisualModeNS.ForwardDir): void | 1 {
    return this.selection_.modify("extend", this.D[d], "character");
  },
  modify_ (d: VisualModeNS.ForwardDir, g: VisualModeNS.G): void | 1 {
    return this.selection_.modify(this.alterMethod_, this.D[d], this.G[g as 0 | 1 | 2]);
  },
  setDi_ (): VisualModeNS.ForwardDir { return this.diNew_ = this.getDirection_(); },
  getNextForwardCharacter_ (isMove: boolean): string | null {
    const beforeText = this.selection_.toString();
    if (beforeText.length > 0 && !this.getDirection_(true)) {
      this.noExtend_ = true;
      return beforeText[0];
    }
    this.extend_(1);
    const afterText = this.selection_.toString();
    if (afterText.length !== beforeText.length || beforeText !== afterText) {
      this.noExtend_ = isMove;
      isMove && this.extend_(0);
      return afterText[afterText.length - 1];
    }
    this.noExtend_ = false;
    return null;
  },
  runMovements_ (direction: VisualModeNS.ForwardDir, granularity: VisualModeNS.G | VisualModeNS.VimG, count: number): void {
    if (granularity === VisualModeNS.VimG.vimword || granularity === VisualModeNS.G.word) {
      if (direction) { return this.moveForwardByWord_(granularity === VisualModeNS.VimG.vimword, count); }
      granularity = VisualModeNS.G.word;
    }
    let sel = this.selection_, m = this.alterMethod_, d = this.D[direction], g = this.G[granularity as 0 | 1 | 2];
    while (0 < count--) { sel.modify(m, d, g); }
  },
  moveForwardByWord_ (vimLike: boolean, count: number): void {
    let ch: string | null = null, isMove = this.alterMethod_ !== "extend";
    this.getDirection_(); this.diNew_ = 1; this.noExtend_ = false;
    while (0 < count--) {
      do {
        if (this.noExtend_ && this.moveByChar_(isMove)) { return; }
      } while ((ch = this.getNextForwardCharacter_(isMove)) && vimLike === this.wordRe_.test(ch));
      do {
        if (this.noExtend_ && this.moveByChar_(isMove)) { return; }
      } while ((ch = this.getNextForwardCharacter_(isMove)) && vimLike !== this.wordRe_.test(ch));
    }
    // `ch &&` is needed according to tests for command `w`
    ch && !this.noExtend_ && this.extend_(0);
  },
  hashSelection_ (): string {
    const range = this.selection_.getRangeAt(0);
    return this.selection_.toString().length + "/" +
      range.anchorOffset + "/" + range.focusOffset + "/" +
      this.selection_.extentOffset + "/" +this.selection_.baseOffset;
  },
  moveByChar_ (isMove: boolean): boolean {
    const before = isMove || this.hashSelection_();
    this.modify_(1, VisualModeNS.G.character);
    return isMove ? false : this.hashSelection_() === before;
  },
  reverseSelection_ (): void {
    const el = VEventMode.lock_(), direction = this.getDirection_(true);
    if (el && !(VDom.notSafe_(el))
        && (VDom.editableTypes_[el.nodeName.toLowerCase()] as EditableType) > EditableType.Embed) {
      let length = this.selection_.toString().length;
      this.collapseSelectionTo_(1);
      this.diNew_ = this.diOld_ = (1 - direction) as VisualModeNS.ForwardDir;
      while (0 < length--) { this.modify_(this.diOld_, 0); }
      return;
    }
    const original = this.selection_.getRangeAt(0),
    str = direction ? "start" : "end";
    this.diNew_ = this.diOld_ = (1 - direction) as VisualModeNS.ForwardDir;
    this.collapse_(this.diNew_);
    this.selection_.extend(original[(str + "Container") as "endContainer"], original[(str + "Offset") as "endOffset"]);
  },
  extendByOneCharacter_ (direction: VisualModeNS.ForwardDir): number {
    const length = this.selection_.toString().length;
    this.extend_(direction);
    return this.selection_.toString().length - length;
  },
  getDirection_ (cache?: boolean): VisualModeNS.ForwardDir {
    let di: VisualModeNS.ForwardDir = 1, change: number;
    if (cache && this.diOld_ === this.diNew_) { return this.diOld_; }
    if (change = this.extendByOneCharacter_(di) || this.extendByOneCharacter_(di = 0)) {
      this.extend_((1 - di) as VisualModeNS.ForwardDir);
    }
    return this.diOld_ = change > 0 ? di : change < 0 ? (1 - di) as VisualModeNS.ForwardDir : 1;
  },
  collapseSelectionTo_ (direction: VisualModeNS.ForwardDir) {
    this.selection_.toString().length > 0 && this.collapse_(this.getDirection_() - direction);
  },
  collapse_ (toStart: number): void | 1 {
    return toStart ? this.selection_.collapseToStart() : this.selection_.collapseToEnd();
  },
  selectLexicalEntity_ (entity: VisualModeNS.G, count: number): void {
    this.collapseSelectionTo_(1);
    entity === VisualModeNS.G.word && this.modify_(1, VisualModeNS.G.character);
    this.modify_(0, entity);
    this.collapseSelectionTo_(1);
    return this.runMovements_(1, entity, count);
  },
  selectLine_ (count: number): void | 1 {
    this.alterMethod_ = "extend";
    this.setDi_() && this.reverseSelection_();
    this.modify_(0, VisualModeNS.G.lineboundary);
    this.reverseSelection_();
    while (0 < --count) { this.modify_(1, VisualModeNS.G.line); }
    this.modify_(1, VisualModeNS.G.lineboundary);
    const ch = this.getNextForwardCharacter_(false);
    if (ch && !this.noExtend_ && ch !== "\n") {
      return this.extend_(0);
    }
  },
  extendToLine_ (): void {
    this.setDi_();
    for (let i = 2; 0 < i--; ) {
      this.modify_(this.diOld_, VisualModeNS.G.lineboundary);
      this.reverseSelection_();
    }
  },
  scrollIntoView_ (): void {
    if (!this.selection_.rangeCount) { return; }
    const focused = VDom.getElementWithFocus_(this.selection_, this.getDirection_());
    if (focused) { return VScroller.scrollIntoView_(focused); }
  },
},

keyMap_: {
  l: 1, h: 0, j: 3, k: 2, e: 13, b: 12, w: 11, ")": 9, "(": 8, "}": 7, "{": 6,
  0: 4, $: 5, G: 15, g: { g: 14 }, B: 12, W: 11,
  v: 51, V: 52, c: 53,
  a: {
    w (count): void {
      return (this as typeof VVisualMode).movement_.selectLexicalEntity_(VisualModeNS.G.word, count);
    },
    s (count): void {
      return (this as typeof VVisualMode).movement_.selectLexicalEntity_(VisualModeNS.G.sentence, count);
    }
  },
  n (count): void { return (this as typeof VVisualMode).find_(count); },
  N (count): void { return (this as typeof VVisualMode).find_(-count); },
  "/": function(): void | boolean {
    clearTimeout((this as typeof VVisualMode).hudTimer_);
    return VFindMode.activate_(1, VUtils.safer_({ returnToViewport: true }));
  },
  y (): void { return (this as typeof VVisualMode).yank_(); },
  Y (count): void { (this as typeof VVisualMode).movement_.selectLine_(count); return (this as typeof VVisualMode).yank_(); },
  C (): void { return (this as typeof VVisualMode).yank_(true); },
  p (): void { return (this as typeof VVisualMode).yank_(0); },
  P (): void { return (this as typeof VVisualMode).yank_(-1); },
  o (): void {
    (this as typeof VVisualMode).movement_.setDi_();
    return (this as typeof VVisualMode).movement_.reverseSelection_();
  },
  "<c-e>": 61, "<c-y>": 62, "<c-down>": 61, "<c-up>": 62
} as {
  [key: string]: VisualModeNS.ValidActions | {
    [key: string]: VisualModeNS.ValidActions;
  };
} as SafeDict<VisualModeNS.ValidActions | SafeDict<VisualModeNS.ValidActions>>,

init_ (words: string) {
  this.init_ = null as never;
  var map = this.keyMap_, func = VUtils.safer_;
  this.movement_.wordRe_ = new RegExp(words);
  func(map); func(map.a as Dict<VisualModeNS.ValidActions>); func(map.g as Dict<VisualModeNS.ValidActions>);
}
};
