var HelpDialog = {
  inited: false,
  styles: Settings.CONST.ChromeVersion === BrowserVer.CSS$Contain$BreaksHelpDialogSize ? "contain: none;"
    // here repeats the logic in frontend.ts, just for easier understanding
    : Settings.CONST.ChromeVersion < BrowserVer.MinFixedCSS$All$MayMistakenlyResetFixedPosition
      && Settings.CONST.ChromeVersion >= BrowserVer.MinCSS$All$MayMistakenlyResetFixedPosition ? "position: fixed;"
    : "",
  render: (function(this: void, request: FgReq["initHelp"]): string {
    if (!HelpDialog.inited) {
      if (Settings.CONST.StyleCacheId.indexOf("s") < 0) {
        let template = Settings.cache.helpDialog as string, styleEnd = template.indexOf("</style>");
        template = template.substring(0, styleEnd).replace(<RegExpG> /[#.][A-Z]/g, "#VimiumUI $&"
          ).replace("HelpAdvanced #VimiumUI .HelpAdv", "HelpAdvanced .HelpAdv"
          ) + template.substring(styleEnd);
        Settings.set("helpDialog", template);
      }
      HelpDialog.inited = true;
    }
    Object.setPrototypeOf(request, null);
    const commandsToKey = Object.create<string[]>(null), ref = CommandsData.keyToCommandRegistry,
          hideUnbound = !request.unbound, showNames = !!request.names;
    for (const key in ref) {
      const command = (ref[key] as CommandsNS.Item).command;
      (commandsToKey[command] || (commandsToKey[command] = [])).push(key);
    }
    const result = Object.setPrototypeOf({
      version: Settings.CONST.CurrentVersionName,
      styles: HelpDialog.styles,
      title: request.title || "Help",
      tip: showNames ? "Tip: click command names to copy them to the clipboard." : "",
      lbPad: showNames ? '\n\t\t<tr><td class="HelpTd TdBottom">&#160;</td></tr>' : ""
    }, null) as SafeDict<string>;
    return (<string>Settings.cache.helpDialog).replace(<RegExpSearchable<1>>/\{\{(\w+)}}/g, function(_, group: string) {
      let s = result[group];
      return s != null ? s
        : HelpDialog.groupHtml(group, commandsToKey, hideUnbound, showNames);
    });
  }),
  groupHtml: (function(this: any, group: string, commandsToKey: SafeDict<string[]>
      , hideUnbound: boolean, showNames: boolean): string {
    const _ref = (this as typeof HelpDialog).commandGroups[group], renderItem = (this as typeof HelpDialog).commandHtml
      , availableCommands = CommandsData.availableCommands as Readonly<EnsuredSafeDict<CommandsNS.Description>>;
    let keys: string[] | undefined, html = "";
    for (let _i = 0, _len = _ref.length; _i < _len; _i++) {
      const command = _ref[_i];
      keys = commandsToKey[command];
      if (hideUnbound && !keys) { continue; }
      let klen = -2, bindings = '';
      if (keys && keys.length > 0) {
        bindings = '\n\t\t<span class="HelpKey">';
        for (const key of keys) {
          if (klen >= 0) {
            bindings += '</span>, <span class="HelpKey">';
          }
          bindings += Utils.escapeText(key);
          klen += key.length + 2;
        }
        bindings += '</span>\n\t';
      }
      const isAdvanced = command in (this as typeof HelpDialog).advancedCommands
        , description = availableCommands[command][0];
      if (klen <= 12) {
        html += renderItem(isAdvanced, bindings, description, showNames ? command: "");
      } else {
        html += renderItem(isAdvanced, bindings, "", "");
        html += renderItem(isAdvanced, "", description, showNames ? command : "");
      }
    }
    return html;
  }),
  commandHtml: (function(this: void, isAdvanced: boolean, bindings: string
      , description: string, command: string): string {
    let html = isAdvanced ? '<tr class="HelpAdv">\n\t' : "<tr>\n\t";
    if (description) {
      html += '<td class="HelpTd HelpKeys">';
      html += bindings;
      html += '</td>\n\t<td class="HelpTd HelpCommandInfo">';
      html += description;
      if (command) {
        html += '\n\t\t<span class="HelpCommandName" role="button">(';
        html += command;
        html += ")</span>\n\t";
      }
    } else {
      html += '<td class="HelpTd HelpKeys HelpLongKeys" colspan="2">';
      html += bindings;
    }
    return html + "</td>\n</tr>\n";
  }),
  commandGroups: { __proto__: null as never,
    pageNavigation: ["scrollDown", "scrollUp", "scrollLeft", "scrollRight", "scrollToTop"
      , "scrollToBottom", "scrollToLeft", "scrollToRight", "scrollPageDown", "scrollPageUp"
      , "scrollPxDown", "scrollPxUp", "scrollPxLeft", "scrollPxRight"
      , "scrollFullPageDown", "scrollFullPageUp", "reload", "reloadTab", "reloadGivenTab"
      , "toggleViewSource"
      , "copyCurrentUrl", "copyCurrentTitle", "switchFocus", "simBackspace"
      , "LinkHints.activateModeToCopyLinkUrl", "LinkHints.activateModeToCopyLinkText"
      , "openCopiedUrlInCurrentTab", "openCopiedUrlInNewTab", "goUp", "goToRoot"
      , "focusInput", "LinkHints.activateMode", "LinkHints.activateModeToOpenInNewTab"
      , "LinkHints.activateModeToOpenInNewForegroundTab", "LinkHints.activateModeWithQueue"
      , "LinkHints.activateModeToDownloadImage", "LinkHints.activateModeToOpenImage"
      , "LinkHints.activateModeToDownloadLink", "LinkHints.activateModeToOpenIncognito"
      , "LinkHints.activateModeToHover", "LinkHints.activateModeToLeave", "LinkHints.unhoverLast"
      , "LinkHints.activateModeToSearchLinkText", "LinkHints.activateModeToEdit"
      , "goPrevious", "goNext", "nextFrame", "mainFrame", "parentFrame"
      , "enterInsertMode", "enterVisualMode", "enterVisualLineMode"
      , "Marks.activateCreateMode", "Marks.activate"
      , "Marks.clearLocal", "Marks.clearGlobal", "openUrl", "focusOrLaunch"
      ],
    vomnibarCommands: ["Vomnibar.activate", "Vomnibar.activateInNewTab"
      , "Vomnibar.activateBookmarks", "Vomnibar.activateBookmarksInNewTab", "Vomnibar.activateHistory"
      , "Vomnibar.activateHistoryInNewTab", "Vomnibar.activateTabSelection"
      , "Vomnibar.activateUrl", "Vomnibar.activateUrlInNewTab"
      , "LinkHints.activateModeToOpenVomnibar"],
    historyNavigation: ["goBack", "goForward", "reopenTab"],
    findCommands: ["enterFindMode", "performFind", "performBackwardsFind", "clearFindHistory"],
    tabManipulation: ["nextTab", "previousTab", "firstTab", "lastTab", "createTab", "duplicateTab"
      , "removeTab", "removeRightTab", "restoreTab", "restoreGivenTab", "moveTabToNextWindow"
      , "moveTabToNewWindow", "moveTabToIncognito", "togglePinTab", "toggleMuteTab", "visitPreviousTab"
      , "closeTabsOnLeft", "closeTabsOnRight", "closeOtherTabs", "moveTabLeft", "moveTabRight"
      , "enableCSTemp", "toggleCS", "clearCS"],
    misc: ["showHelp", "autoCopy", "autoOpen", "searchAs", "searchInAnother", "toggleLinkHintCharacters"
      , "toggleSwitchTemp", "passNextKey", "debugBackground", "blank"]
  } as Readonly<EnsuredSafeDict<ReadonlyArray<string>>>,
  advancedCommands: { __proto__: null as never,
    toggleViewSource: 1, clearFindHistory: 1
    , scrollToLeft: 1, scrollToRight: 1, moveTabToNextWindow: 1
    , moveTabToNewWindow: 1, moveTabToIncognito: 1, reloadGivenTab: 1, focusOrLaunch: 1
    , goUp: 1, goToRoot: 1, focusInput: 1, "LinkHints.activateModeWithQueue": 1, enableCSTemp: 1
    , toggleCS: 1, clearCS: 1, "LinkHints.activateModeToDownloadImage": 1, reopenTab: 1
    , "LinkHints.activateModeToOpenImage": 1, removeRightTab: 1
    , "LinkHints.activateModeToDownloadLink": 1, restoreGivenTab: 1
    , "LinkHints.activateModeToOpenIncognito": 1, passNextKey: 1
    , goNext: 1, goPrevious: 1, "Marks.clearLocal": 1, "Marks.clearGlobal": 1
    , moveTabLeft: 1, moveTabRight: 1, closeTabsOnLeft: 1, closeTabsOnRight: 1, closeOtherTabs: 1
    , scrollPxDown: 1, scrollPxUp: 1, scrollPxLeft: 1, scrollPxRight: 1, debugBackground: 1, blank: 1
    , "LinkHints.activateModeToHover": 1, "LinkHints.unhoverLast": 1
    , toggleLinkHintCharacters: 1, toggleSwitchTemp: 1, "LinkHints.activateModeToLeave": 1
    , "Vomnibar.activateUrl": 1, "Vomnibar.activateUrlInNewTab": 1
  } as SafeEnum
};

interface BaseHelpDialog {
  render: typeof HelpDialog.render;
}
