// Third party web dependencies
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  CompletionContext,
  completionKeymap,
  CompletionResult,
  drawSelection,
  dropCursor,
  EditorSelection,
  EditorState,
  EditorView,
  highlightSpecialChars,
  history,
  historyKeymap,
  indentOnInput,
  indentWithTab,
  javascriptLanguage,
  KeyBinding,
  keymap,
  LanguageDescription,
  LanguageSupport,
  markdown,
  runScopeHandlers,
  searchKeymap,
  standardKeymap,
  StreamLanguage,
  syntaxHighlighting,
  syntaxTree,
  typescriptLanguage,
  ViewPlugin,
  ViewUpdate,
  yamlLanguage,
} from "../common/deps.ts";
import { SilverBulletHooks } from "../common/manifest.ts";
import {
  loadMarkdownExtensions,
  MDExt,
} from "../common/markdown_parser/markdown_ext.ts";
import buildMarkdown from "../common/markdown_parser/parser.ts";
import { Space } from "../common/spaces/space.ts";
import { markdownSyscalls } from "../common/syscalls/markdown.ts";
import { FilterOption, PageMeta } from "../common/types.ts";
import { isMacLike, safeRun, throttle } from "../common/util.ts";
import { createSandbox } from "../plugos/environments/webworker_sandbox.ts";
import { EventHook } from "../plugos/hooks/event.ts";
import assetSyscalls from "../plugos/syscalls/asset.ts";
import { eventSyscalls } from "../plugos/syscalls/event.ts";
import sandboxSyscalls from "../plugos/syscalls/sandbox.ts";
import { System } from "../plugos/system.ts";
import { cleanModePlugins } from "./cm_plugins/clean.ts";
import { CollabState } from "./cm_plugins/collab.ts";
import {
  attachmentExtension,
  pasteLinkExtension,
} from "./cm_plugins/editor_paste.ts";
import { inlineImagesPlugin } from "./cm_plugins/inline_image.ts";
import { lineWrapper } from "./cm_plugins/line_wrapper.ts";
import { smartQuoteKeymap } from "./cm_plugins/smart_quotes.ts";
import { Confirm, Prompt } from "./components/basic_modals.tsx";
import { CommandPalette } from "./components/command_palette.tsx";
import { FilterList } from "./components/filter.tsx";
import { PageNavigator } from "./components/page_navigator.tsx";
import { Panel } from "./components/panel.tsx";
import { TopBar } from "./components/top_bar.tsx";
import {
  BookIcon,
  HomeIcon,
  preactRender,
  TerminalIcon,
  useEffect,
  useReducer,
  vim,
  yUndoManagerKeymap,
} from "./deps.ts";
import { AppCommand, CommandHook } from "./hooks/command.ts";
import { SlashCommandHook } from "./hooks/slash_command.ts";
import { PathPageNavigator } from "./navigator.ts";
import reducer from "./reducer.ts";
import customMarkdownStyle from "./style.ts";
import { clientStoreSyscalls } from "./syscalls/clientStore.ts";
import { collabSyscalls } from "./syscalls/collab.ts";
import { editorSyscalls } from "./syscalls/editor.ts";
import { fulltextSyscalls } from "./syscalls/fulltext.ts";
import { indexerSyscalls } from "./syscalls/index.ts";
import { spaceSyscalls } from "./syscalls/space.ts";
import { storeSyscalls } from "./syscalls/store.ts";
import { systemSyscalls } from "./syscalls/system.ts";
import { AppViewState, BuiltinSettings, initialViewState } from "./types.ts";

import type {
  AppEvent,
  ClickEvent,
  CompleteEvent,
} from "../plug-api/app_event.ts";
import { CodeWidgetHook } from "./hooks/code_widget.ts";
import { sandboxFetchSyscalls } from "../plugos/syscalls/fetch.ts";

const frontMatterRegex = /^---\n(.*?)---\n/ms;

class PageState {
  constructor(
    readonly scrollTop: number,
    readonly selection: EditorSelection,
  ) {}
}

const saveInterval = 1000;

export class Editor {
  readonly commandHook: CommandHook;
  readonly slashCommandHook: SlashCommandHook;
  openPages = new Map<string, PageState>();
  editorView?: EditorView;
  viewState: AppViewState;
  // deno-lint-ignore ban-types
  viewDispatch: Function;
  space: Space;
  pageNavigator: PathPageNavigator;
  eventHook: EventHook;
  codeWidgetHook: CodeWidgetHook;

  saveTimeout: any;
  debouncedUpdateEvent = throttle(() => {
    this.eventHook
      .dispatchEvent("editor:updated")
      .catch((e) => console.error("Error dispatching editor:updated event", e));
  }, 1000);
  private system: System<SilverBulletHooks>;
  private mdExtensions: MDExt[] = [];
  urlPrefix: string;
  indexPage: string;

  // Runtime state (that doesn't make sense in viewState)
  collabState?: CollabState;
  // enableVimMode = false;

  constructor(
    space: Space,
    system: System<SilverBulletHooks>,
    eventHook: EventHook,
    parent: Element,
    urlPrefix: string,
    readonly builtinSettings: BuiltinSettings,
  ) {
    this.space = space;
    this.system = system;
    this.urlPrefix = urlPrefix;
    this.viewState = initialViewState;
    this.viewDispatch = () => {};
    this.indexPage = builtinSettings.indexPage;

    this.eventHook = eventHook;

    // Code widget hook
    this.codeWidgetHook = new CodeWidgetHook();
    this.system.addHook(this.codeWidgetHook);

    // Command hook
    this.commandHook = new CommandHook();
    this.commandHook.on({
      commandsUpdated: (commandMap) => {
        this.viewDispatch({
          type: "update-commands",
          commands: commandMap,
        });
      },
    });
    this.system.addHook(this.commandHook);

    // Slash command hook
    this.slashCommandHook = new SlashCommandHook(this);
    this.system.addHook(this.slashCommandHook);

    this.render(parent);

    this.editorView = new EditorView({
      state: this.createEditorState("", ""),
      parent: document.getElementById("sb-editor")!,
    });

    this.pageNavigator = new PathPageNavigator(
      builtinSettings.indexPage,
      urlPrefix,
    );

    this.system.registerSyscalls(
      [],
      eventSyscalls(this.eventHook),
      editorSyscalls(this),
      spaceSyscalls(this),
      systemSyscalls(this, this.system),
      markdownSyscalls(buildMarkdown(this.mdExtensions)),
      sandboxSyscalls(this.system),
      assetSyscalls(this.system),
      collabSyscalls(this),
    );

    // Make keyboard shortcuts work even when the editor is in read only mode or not focused
    globalThis.addEventListener("keydown", (ev) => {
      if (!this.editorView?.hasFocus) {
        if ((ev.target as any).closest(".cm-editor")) {
          // In some cm element, let's back out
          return;
        }
        if (runScopeHandlers(this.editorView!, ev, "editor")) {
          ev.preventDefault();
        }
      }
    });

    globalThis.addEventListener("touchstart", (ev) => {
      // Launch the command palette using a three-finger tap
      if (ev.touches.length > 2) {
        ev.stopPropagation();
        ev.preventDefault();
        this.viewDispatch({ type: "show-palette", context: this.getContext() });
      }
    });
  }

  get currentPage(): string | undefined {
    return this.viewState.currentPage;
  }

  async init() {
    this.focus();

    const globalModules: any = await (
      await fetch(`${this.urlPrefix}/global.plug.json`)
    ).json();

    this.system.on({
      sandboxInitialized: async (sandbox) => {
        for (
          const [modName, code] of Object.entries(
            globalModules.dependencies,
          )
        ) {
          await sandbox.loadDependency(modName, code as string);
        }
      },
    });

    this.space.on({
      pageChanged: (meta) => {
        if (this.currentPage === meta.name) {
          console.log("Page changed on disk, reloading");
          this.flashNotification("Page changed on disk, reloading");
          this.reloadPage();
        }
      },
      pageListUpdated: (pages) => {
        this.viewDispatch({
          type: "pages-listed",
          pages: pages,
        });
      },
    });

    await this.reloadPlugs();

    this.pageNavigator.subscribe(async (pageName, pos: number | string) => {
      console.log("Now navigating to", pageName);

      if (!this.editorView) {
        return;
      }

      const stateRestored = await this.loadPage(pageName);
      if (pos) {
        if (typeof pos === "string") {
          console.log("Navigating to anchor", pos);

          // We're going to look up the anchor through a direct page store query...
          const posLookup = await this.system.localSyscall(
            "core",
            "index.get",
            [
              pageName,
              `a:${pageName}:${pos}`,
            ],
          );

          if (!posLookup) {
            return this.flashNotification(
              `Could not find anchor @${pos}`,
              "error",
            );
          } else {
            pos = +posLookup;
          }
        }
        this.editorView.dispatch({
          selection: { anchor: pos },
          scrollIntoView: true,
        });
      } else if (!stateRestored) {
        // Somewhat ad-hoc way to determine if the document contains frontmatter and if so, putting the cursor _after it_.
        const pageText = this.editorView.state.sliceDoc();

        // Default the cursor to be at position 0
        let initialCursorPos = 0;
        const match = frontMatterRegex.exec(pageText);
        if (match) {
          // Frontmatter found, put cursor after it
          initialCursorPos = match[0].length;
        }
        // By default scroll to the top
        this.editorView.scrollDOM.scrollTop = 0;
        this.editorView.dispatch({
          selection: { anchor: initialCursorPos },
          // And then scroll down if required
          scrollIntoView: true,
        });
      }
    });

    await this.dispatchAppEvent("editor:init");
  }

  save(immediate = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      this.saveTimeout = setTimeout(
        () => {
          if (this.currentPage) {
            if (
              !this.viewState.unsavedChanges ||
              this.viewState.uiOptions.forcedROMode
            ) {
              // No unsaved changes, or read-only mode, not gonna save
              return resolve();
            }
            console.log("Saving page", this.currentPage);
            this.space
              .writePage(
                this.currentPage,
                this.editorView!.state.sliceDoc(0),
                true,
              )
              .then(() => {
                this.viewDispatch({ type: "page-saved" });
                resolve();
              })
              .catch((e) => {
                this.flashNotification(
                  "Could not save page, retrying again in 10 seconds",
                  "error",
                );
                this.saveTimeout = setTimeout(this.save.bind(this), 10000);
                reject(e);
              });
          } else {
            resolve();
          }
        },
        immediate ? 0 : saveInterval,
      );
    });
  }

  flashNotification(message: string, type: "info" | "error" = "info") {
    const id = Math.floor(Math.random() * 1000000);
    this.viewDispatch({
      type: "show-notification",
      notification: {
        id,
        type,
        message,
        date: new Date(),
      },
    });
    setTimeout(
      () => {
        this.viewDispatch({
          type: "dismiss-notification",
          id: id,
        });
      },
      type === "info" ? 2000 : 5000,
    );
  }

  filterBox(
    label: string,
    options: FilterOption[],
    helpText = "",
    placeHolder = "",
  ): Promise<FilterOption | undefined> {
    return new Promise((resolve) => {
      this.viewDispatch({
        type: "show-filterbox",
        label,
        options,
        placeHolder,
        helpText,
        onSelect: (option: any) => {
          this.viewDispatch({ type: "hide-filterbox" });
          this.focus();
          resolve(option);
        },
      });
    });
  }

  prompt(
    message: string,
    defaultValue = "",
  ): Promise<string | undefined> {
    return new Promise((resolve) => {
      this.viewDispatch({
        type: "show-prompt",
        message,
        defaultValue,
        callback: (value: string | undefined) => {
          this.viewDispatch({ type: "hide-prompt" });
          this.focus();
          resolve(value);
        },
      });
    });
  }

  confirm(
    message: string,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.viewDispatch({
        type: "show-confirm",
        message,
        callback: (value: boolean) => {
          this.viewDispatch({ type: "hide-confirm" });
          this.focus();
          resolve(value);
        },
      });
    });
  }

  dispatchAppEvent(name: AppEvent, data?: any): Promise<any[]> {
    return this.eventHook.dispatchEvent(name, data);
  }

  createEditorState(pageName: string, text: string): EditorState {
    const commandKeyBindings: KeyBinding[] = [];
    for (const def of this.commandHook.editorCommands.values()) {
      if (def.command.key) {
        commandKeyBindings.push({
          key: def.command.key,
          mac: def.command.mac,
          run: (): boolean => {
            if (def.command.contexts) {
              const context = this.getContext();
              if (!context || !def.command.contexts.includes(context)) {
                return false;
              }
            }
            Promise.resolve()
              .then(def.run)
              .catch((e: any) => {
                console.error(e);
                this.flashNotification(
                  `Error running command: ${e.message}`,
                  "error",
                );
              })
              .then(() => {
                // Always be focusing the editor after running a command
                editor.focus();
              });
            return true;
          },
        });
      }
    }
    // deno-lint-ignore no-this-alias
    const editor = this;

    return EditorState.create({
      doc: this.collabState ? this.collabState.ytext.toString() : text,
      extensions: [
        // Not using CM theming right now, but some extensions depend on the "dark" thing
        EditorView.theme({}, { dark: this.viewState.uiOptions.darkMode }),
        // Enable vim mode, or not
        [...editor.viewState.uiOptions.vimMode ? [vim({ status: true })] : []],
        // The uber markdown mode
        markdown({
          base: buildMarkdown(this.mdExtensions),
          codeLanguages: [
            LanguageDescription.of({
              name: "yaml",
              alias: ["meta", "data"],
              support: new LanguageSupport(StreamLanguage.define(yamlLanguage)),
            }),
            LanguageDescription.of({
              name: "javascript",
              alias: ["js"],
              support: new LanguageSupport(javascriptLanguage),
            }),
            LanguageDescription.of({
              name: "typescript",
              alias: ["ts"],
              support: new LanguageSupport(typescriptLanguage),
            }),
          ],
          addKeymap: true,
        }),
        syntaxHighlighting(customMarkdownStyle(this.mdExtensions)),
        autocompletion({
          override: [
            this.editorComplete.bind(this),
            this.slashCommandHook.slashCommandCompleter.bind(
              this.slashCommandHook,
            ),
          ],
        }),
        inlineImagesPlugin(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        ...cleanModePlugins(this),
        EditorView.lineWrapping,
        lineWrapper([
          { selector: "ATXHeading1", class: "sb-line-h1" },
          { selector: "ATXHeading2", class: "sb-line-h2" },
          { selector: "ATXHeading3", class: "sb-line-h3" },
          { selector: "ATXHeading4", class: "sb-line-h4" },
          { selector: "ListItem", class: "sb-line-li", nesting: true },
          { selector: "Blockquote", class: "sb-line-blockquote" },
          { selector: "Task", class: "sb-line-task" },
          { selector: "CodeBlock", class: "sb-line-code" },
          { selector: "FencedCode", class: "sb-line-fenced-code" },
          { selector: "Comment", class: "sb-line-comment" },
          { selector: "BulletList", class: "sb-line-ul" },
          { selector: "OrderedList", class: "sb-line-ol" },
          { selector: "TableHeader", class: "sb-line-tbl-header" },
          { selector: "FrontMatter", class: "sb-frontmatter" },
        ]),
        keymap.of([
          {
            key: "ArrowUp",
            run: (view): boolean => {
              // When going up while at the top of the document, focus the page name
              const selection = view.state.selection.main;
              const line = view.state.doc.lineAt(selection.from);
              // Are we at the top of the document?
              if (line.number === 1) {
                // This can be done much nicer, but this is shorter, so... :)
                document.querySelector<HTMLDivElement>(
                  "#sb-current-page .cm-content",
                )!.focus();
                return true;
              }
              return false;
            },
          },
          ...smartQuoteKeymap,
          ...closeBracketsKeymap,
          ...standardKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...(this.collabState ? yUndoManagerKeymap : []),
          indentWithTab,
          ...commandKeyBindings,
          {
            key: "Ctrl-k",
            mac: "Cmd-k",
            run: (): boolean => {
              this.viewDispatch({ type: "start-navigate" });
              this.space.updatePageList();
              return true;
            },
          },
          {
            key: "Ctrl-/",
            mac: "Cmd-/",
            run: (): boolean => {
              this.viewDispatch({
                type: "show-palette",
                context: this.getContext(),
              });
              return true;
            },
          },
        ]),
        EditorView.domEventHandlers({
          click: (event: MouseEvent, view: EditorView) => {
            safeRun(async () => {
              const clickEvent: ClickEvent = {
                page: pageName,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
                altKey: event.altKey,
                pos: view.posAtCoords(event)!,
              };
              await this.dispatchAppEvent("page:click", clickEvent);
            });
          },
        }),
        ViewPlugin.fromClass(
          class {
            update(update: ViewUpdate): void {
              if (update.docChanged) {
                editor.viewDispatch({ type: "page-changed" });
                editor.debouncedUpdateEvent();
                editor.save().catch((e) => console.error("Error saving", e));
              }
            }
          },
        ),
        pasteLinkExtension,
        attachmentExtension(this),
        closeBrackets(),
        ...[this.collabState ? this.collabState.collabExtension() : []],
      ],
    });
  }

  async reloadPlugs() {
    console.log("Loading plugs");
    await this.space.updatePageList();
    await this.system.unloadAll();
    console.log("(Re)loading plugs");
    await Promise.all((await this.space.listPlugs()).map(async (plugName) => {
      const { data } = await this.space.readAttachment(plugName, "string");
      await this.system.load(JSON.parse(data as string), createSandbox);
    }));
    this.rebuildEditorState();
    await this.dispatchAppEvent("plugs:loaded");
  }

  rebuildEditorState() {
    const editorView = this.editorView;
    console.log("Rebuilding editor state");

    // Load all syntax extensions
    this.mdExtensions = loadMarkdownExtensions(this.system);
    // And reload the syscalls to use the new syntax extensions
    this.system.registerSyscalls(
      [],
      markdownSyscalls(buildMarkdown(this.mdExtensions)),
    );

    if (editorView && this.currentPage) {
      // And update the editor if a page is loaded
      this.saveState(this.currentPage);

      editorView.setState(
        this.createEditorState(this.currentPage, editorView.state.sliceDoc()),
      );
      if (editorView.contentDOM) {
        this.tweakEditorDOM(
          editorView.contentDOM,
          this.viewState.perm === "ro",
        );
      }

      this.restoreState(this.currentPage);
    }
  }

  // Code completion support
  private async completeWithEvent(
    context: CompletionContext,
    eventName: AppEvent,
  ): Promise<CompletionResult | null> {
    const editorState = context.state;
    const selection = editorState.selection.main;
    const line = editorState.doc.lineAt(selection.from);
    const linePrefix = line.text.slice(0, selection.from - line.from);

    const results = await this.dispatchAppEvent(eventName, {
      linePrefix,
      pos: selection.from,
    } as CompleteEvent);
    let actualResult = null;
    for (const result of results) {
      if (result) {
        if (actualResult) {
          console.error(
            "Got completion results from multiple sources, cannot deal with that",
          );
          return null;
        }
        actualResult = result;
      }
    }
    return actualResult;
  }

  editorComplete(
    context: CompletionContext,
  ): Promise<CompletionResult | null> {
    return this.completeWithEvent(context, "editor:complete");
  }

  miniEditorComplete(
    context: CompletionContext,
  ): Promise<CompletionResult | null> {
    return this.completeWithEvent(context, "minieditor:complete");
  }

  async reloadPage() {
    console.log("Reloading page");
    clearTimeout(this.saveTimeout);
    await this.loadPage(this.currentPage!);
  }

  focus() {
    this.editorView!.focus();
  }

  async navigate(
    name: string,
    pos?: number | string,
    replaceState = false,
    newWindow = false,
  ) {
    if (!name) {
      name = this.indexPage;
    }

    if (newWindow) {
      const win = window.open(`${location.origin}/${name}`, "_blank");
      if (win) {
        win.focus();
      }
      return;
    }
    await this.pageNavigator.navigate(name, pos, replaceState);
  }

  async loadPage(pageName: string): Promise<boolean> {
    const loadingDifferentPage = pageName !== this.currentPage;
    const editorView = this.editorView;
    if (!editorView) {
      return false;
    }

    const previousPage = this.currentPage;

    // Persist current page state and nicely close page
    if (previousPage) {
      this.saveState(previousPage);
      this.space.unwatchPage(previousPage);
      if (previousPage !== pageName) {
        await this.save(true);
        // And stop the collab session
        if (this.collabState) {
          this.collabState.stop();
          this.collabState = undefined;
        }
      }
    }

    this.viewDispatch({
      type: "page-loading",
      name: pageName,
    });

    // Fetch next page to open
    let doc;
    try {
      doc = await this.space.readPage(pageName);
    } catch (e: any) {
      // Not found, new page
      console.log("Creating new page", pageName);
      doc = {
        text: "",
        meta: { name: pageName, lastModified: 0, perm: "rw" } as PageMeta,
      };
    }

    const editorState = this.createEditorState(pageName, doc.text);
    editorView.setState(editorState);
    if (editorView.contentDOM) {
      this.tweakEditorDOM(editorView.contentDOM, doc.meta.perm === "ro");
    }
    const stateRestored = this.restoreState(pageName);
    this.space.watchPage(pageName);

    this.viewDispatch({
      type: "page-loaded",
      meta: doc.meta,
    });

    // Note: these events are dispatched asynchronously deliberately (not waiting for results)
    if (loadingDifferentPage) {
      this.eventHook.dispatchEvent("editor:pageLoaded", pageName).catch(
        console.error,
      );
    } else {
      this.eventHook.dispatchEvent("editor:pageReloaded", pageName).catch(
        console.error,
      );
    }

    return stateRestored;
  }

  tweakEditorDOM(contentDOM: HTMLElement, readOnly: boolean) {
    contentDOM.spellcheck = true;
    contentDOM.setAttribute("autocorrect", "on");
    contentDOM.setAttribute("autocapitalize", "on");
    contentDOM.setAttribute(
      "contenteditable",
      readOnly || this.viewState.uiOptions.forcedROMode ? "false" : "true",
    );
  }

  private restoreState(pageName: string): boolean {
    const pageState = this.openPages.get(pageName);
    const editorView = this.editorView!;
    if (pageState) {
      // Restore state
      editorView.scrollDOM.scrollTop = pageState!.scrollTop;
      editorView.dispatch({
        selection: pageState.selection,
        scrollIntoView: true,
      });
    } else {
      editorView.scrollDOM.scrollTop = 0;
      editorView.dispatch({
        selection: { anchor: 0 },
        scrollIntoView: true,
      });
    }
    editorView.focus();
    return !!pageState;
  }

  private saveState(currentPage: string) {
    this.openPages.set(
      currentPage,
      new PageState(
        this.editorView!.scrollDOM.scrollTop,
        this.editorView!.state.selection,
      ),
    );
  }

  ViewComponent() {
    const [viewState, dispatch] = useReducer(reducer, initialViewState);
    this.viewState = viewState;
    this.viewDispatch = dispatch;

    // deno-lint-ignore no-this-alias
    const editor = this;

    useEffect(() => {
      if (viewState.currentPage) {
        document.title = viewState.currentPage;
      }
    }, [viewState.currentPage]);

    useEffect(() => {
      if (editor.editorView) {
        editor.tweakEditorDOM(
          editor.editorView.contentDOM,
          viewState.perm === "ro",
        );
      }
    }, [viewState.uiOptions.forcedROMode]);

    useEffect(() => {
      this.rebuildEditorState();
    }, [viewState.uiOptions.vimMode]);

    useEffect(() => {
      document.documentElement.dataset.theme = viewState.uiOptions.darkMode
        ? "dark"
        : "light";
    }, [viewState.uiOptions.darkMode]);

    useEffect(() => {
      // Need to dispatch a resize event so that the top_bar can pick it up
      globalThis.dispatchEvent(new Event("resize"));
    }, [viewState.panels]);

    return (
      <>
        {viewState.showPageNavigator && (
          <PageNavigator
            allPages={viewState.allPages}
            currentPage={this.currentPage}
            completer={this.miniEditorComplete.bind(this)}
            vimMode={viewState.uiOptions.vimMode}
            darkMode={viewState.uiOptions.darkMode}
            onNavigate={(page) => {
              dispatch({ type: "stop-navigate" });
              editor.focus();
              if (page) {
                safeRun(async () => {
                  await editor.navigate(page);
                });
              }
            }}
          />
        )}
        {viewState.showCommandPalette && (
          <CommandPalette
            onTrigger={(cmd) => {
              dispatch({ type: "hide-palette" });
              editor.focus();
              if (cmd) {
                dispatch({ type: "command-run", command: cmd.command.name });
                cmd
                  .run()
                  .catch((e: any) => {
                    console.error("Error running command", e.message);
                  })
                  .then(() => {
                    // Always be focusing the editor after running a command
                    editor.focus();
                  });
              }
            }}
            commands={this.getCommandsByContext(viewState)}
            vimMode={viewState.uiOptions.vimMode}
            darkMode={viewState.uiOptions.darkMode}
            completer={this.miniEditorComplete.bind(this)}
            recentCommands={viewState.recentCommands}
          />
        )}
        {viewState.showFilterBox && (
          <FilterList
            label={viewState.filterBoxLabel}
            placeholder={viewState.filterBoxPlaceHolder}
            options={viewState.filterBoxOptions}
            vimMode={viewState.uiOptions.vimMode}
            darkMode={viewState.uiOptions.darkMode}
            allowNew={false}
            completer={this.miniEditorComplete.bind(this)}
            helpText={viewState.filterBoxHelpText}
            onSelect={viewState.filterBoxOnSelect}
          />
        )}
        {viewState.showPrompt && (
          <Prompt
            message={viewState.promptMessage!}
            defaultValue={viewState.promptDefaultValue}
            vimMode={viewState.uiOptions.vimMode}
            darkMode={viewState.uiOptions.darkMode}
            completer={this.miniEditorComplete.bind(this)}
            callback={(value) => {
              dispatch({ type: "hide-prompt" });
              viewState.promptCallback!(value);
            }}
          />
        )}
        {viewState.showConfirm && (
          <Confirm
            message={viewState.confirmMessage!}
            callback={(value) => {
              dispatch({ type: "hide-confirm" });
              viewState.confirmCallback!(value);
            }}
          />
        )}
        <TopBar
          pageName={viewState.currentPage}
          notifications={viewState.notifications}
          unsavedChanges={viewState.unsavedChanges}
          isLoading={viewState.isLoading}
          vimMode={viewState.uiOptions.vimMode}
          darkMode={viewState.uiOptions.darkMode}
          completer={editor.miniEditorComplete.bind(editor)}
          onRename={async (newName) => {
            if (!newName) {
              // Always move cursor to the start of the page
              editor.editorView?.dispatch({
                selection: { anchor: 0 },
              });
              editor.focus();
              return;
            }
            console.log("Now renaming page to...", newName);
            await editor.system.loadedPlugs.get("core")!.invoke(
              "renamePage",
              [{ page: newName }],
            );
            editor.focus();
          }}
          actionButtons={[
            {
              icon: HomeIcon,
              description: `Go home (Alt-h)`,
              callback: () => {
                editor.navigate("");
              },
            },
            {
              icon: BookIcon,
              description: `Open page (${isMacLike() ? "Cmd-k" : "Ctrl-k"})`,
              callback: () => {
                dispatch({ type: "start-navigate" });
                this.space.updatePageList();
              },
            },
            {
              icon: TerminalIcon,
              description: `Run command (${isMacLike() ? "Cmd-/" : "Ctrl-/"})`,
              callback: () => {
                dispatch({ type: "show-palette", context: this.getContext() });
              },
            },
          ]}
          rhs={!!viewState.panels.rhs.mode && (
            <div
              className="panel"
              style={{ flex: viewState.panels.rhs.mode }}
            />
          )}
          lhs={!!viewState.panels.lhs.mode && (
            <div
              className="panel"
              style={{ flex: viewState.panels.lhs.mode }}
            />
          )}
        />
        <div id="sb-main">
          {!!viewState.panels.lhs.mode && (
            <Panel config={viewState.panels.lhs} editor={editor} />
          )}
          <div id="sb-editor" />
          {!!viewState.panels.rhs.mode && (
            <Panel config={viewState.panels.rhs} editor={editor} />
          )}
        </div>
        {!!viewState.panels.modal.mode && (
          <div
            className="sb-modal"
            style={{ inset: `${viewState.panels.modal.mode}px` }}
          >
            <Panel config={viewState.panels.modal} editor={editor} />
          </div>
        )}
        {!!viewState.panels.bhs.mode && (
          <div className="sb-bhs">
            <Panel config={viewState.panels.bhs} editor={editor} />
          </div>
        )}
      </>
    );
  }

  async runCommandByName(name: string, ...args: any[]) {
    const cmd = this.viewState.commands.get(name);
    if (cmd) {
      await cmd.run();
    } else {
      throw new Error(`Command ${name} not found`);
    }
  }

  render(container: Element) {
    const ViewComponent = this.ViewComponent.bind(this);
    // console.log(<ViewComponent />);
    preactRender(<ViewComponent />, container);
  }

  private getCommandsByContext(
    state: AppViewState,
  ): Map<string, AppCommand> {
    const commands = new Map(state.commands);
    for (const [k, v] of state.commands.entries()) {
      if (
        v.command.contexts &&
        (!state.showCommandPaletteContext ||
          !v.command.contexts.includes(state.showCommandPaletteContext))
      ) {
        commands.delete(k);
      }
    }

    return commands;
  }

  private getContext(): string | undefined {
    const state = this.editorView!.state;
    const selection = state.selection.main;
    if (selection.empty) {
      return syntaxTree(state).resolveInner(selection.from).type.name;
    }
    return;
  }

  startCollab(serverUrl: string, token: string, username: string) {
    if (this.collabState) {
      // Clean up old collab state
      this.collabState.stop();
    }
    const initialText = this.editorView!.state.sliceDoc();
    this.collabState = new CollabState(serverUrl, token, username);
    this.collabState.collabProvider.once("sync", (synced: boolean) => {
      if (this.collabState?.ytext.toString() === "") {
        console.log("Synced value is empty, putting back original text");
        this.collabState?.ytext.insert(0, initialText);
      }
    });
    this.rebuildEditorState();
  }
}
