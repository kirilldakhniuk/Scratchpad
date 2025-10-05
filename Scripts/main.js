const SKETCHPAD_DIR = ".nova/scratchpad";

let treeView;
let provider;

exports.activate = function () {
  provider = new ScratchpadProvider();
  treeView = new TreeView("scratchpad-notes", { dataProvider: provider });
  nova.subscriptions.add(treeView);

  treeView.onDidChangeSelection((selection) => {
    provider.currentSelection = selection.length ? selection[0] : null;
  });

  nova.commands.register("scratchpad.add", provider.addNote.bind(provider));
  nova.commands.register(
    "scratchpad.remove",
    provider.removeNote.bind(provider),
  );

  nova.commands.register("scratchpad.open", () => {
    const selection = treeView.selection;

    if (!selection || selection.length === 0) return;

    const note = selection[0];
    const filename = note.name;

    provider.openNote(filename);
  });

  nova.commands.register("scratchpad.search", () => {
    const dir = nova.path.join(nova.workspace.path, SKETCHPAD_DIR);

    if (!nova.fs.stat(dir)) {
      nova.fs.mkdir(dir);
    }

    const files = nova.fs.listdir(dir).filter((f) => f.endsWith(".md"));

    if (files.length === 0) {
      nova.workspace.showInformativeMessage("Notes not found.");
      return;
    }

    const fullPaths = files.map((f) => nova.path.join(dir, f));

    nova.workspace.showChoicePalette(
      files,
      {
        placeholder: "􀊫 Notes Search",
        ignoreTab: true,
      },
      (choice, index) => {
        if (!choice) return;

        const selectedPath = fullPaths[index];

        nova.workspace.openFile(selectedPath);
      },
    );
  });
};

exports.deactivate = function () {
  provider.dispose();
};

class ScratchpadProvider {
  constructor() {
    this.currentSelection = null;
    this.watcher = null;
  }

  notesDir() {
    const dir = nova.path.join(nova.workspace.path, SKETCHPAD_DIR);

    try {
      if (!nova.fs.stat(dir)) nova.fs.mkdir(dir);
    } catch (e) {
      // already exists
    }

    return dir;
  }

  getChildren(element) {
    if (element) return [];

    const dir = this.notesDir();

    if (!dir) return [];

    const files = nova.fs.listdir(dir).filter((f) => f.endsWith(".md"));

    return files.map((name) => ({ name }));
  }

  getTreeItem(element) {
    const item = new TreeItem(element.name);

    item.identifier = element.name;
    item.contextValue = "scratchpad.note";
    item.image = "__builtin.path";
    item.command = "scratchpad.open";

    return item;
  }

  addNote() {
    nova.workspace.showInputPalette("Enter note name", [], (filename) => {
      if (filename) {
        const slug = this.slugify(filename);
        const content = `# `;
        const file = nova.fs.open(
          nova.path.join(this.notesDir(), `${slug}.md`),
          "w",
        );

        file.write(content);
        file.close();

        treeView.reload();

        this.openNote(`${slug}.md`);
      } else {
        console.log("Exit");
      }
    });
  }

  openNote(filename) {
    if (!filename) return;

    const path = nova.path.join(this.notesDir(), filename);

    nova.workspace.openFile(path).then((editor) => {
      editor.selectedRange = new Range(2, 2);
    });
  }

  removeNote() {
    if (!this.currentSelection) return;

    const path = nova.path.join(this.notesDir(), this.currentSelection.name);
    try {
      nova.fs.remove(path);
      treeView.reload();
    } catch (e) {
      nova.workspace.showErrorMessage("Unable to remove note: " + e.message);
    }
  }

  watch() {
    const dir = this.notesDir();
    if (!dir) return;
    this.watcher = nova.fs.watch(dir, () => this.refresh());
  }

  dispose() {
    if (this.watcher) this.watcher.close();
  }

  slugify(str) {
    str = str.replace(/^\s+|\s+$/g, "");
    str = str.toLowerCase();
    str = str
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    return str;
  }
}
