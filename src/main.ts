import { PluginBase } from './helpers'
import { WorkspaceLeaf } from 'obsidian';
import { around } from 'monkey-around';

// The actual plugin class
export default class MaximiseActivePanePlugin extends PluginBase {
  private designatedSplit2LeafId: string | null = null;

  // perform any setup required to enable the plugin
  enable() {
    super.enable();
    this.registerEvent(this.app.workspace.on('layout-change', this.enforceSingleTabInDesignatedSplit2));

    // Patch workspace.splitActiveLeaf
    this.register(around(this.app.workspace.constructor.prototype, {
        splitActiveLeaf: (next: Function) => { // Use Function for 'next' type for simplicity with around patching
            return function (...args: any[]) { // 'this' here is the Workspace instance
                const newLeaf = next.call(this, ...args); // Call original method

                if (newLeaf && newLeaf.id) {
                    // 'this.app' is available on the Workspace instance.
                    // Use the correct plugin ID from manifest.json
                    const pluginInstance = this.app.plugins.plugins['maximise-active-pane-obsidian'] as MaximiseActivePanePlugin;

                    if (pluginInstance && pluginInstance instanceof MaximiseActivePanePlugin) {
                        if (pluginInstance.designatedSplit2LeafId && pluginInstance.designatedSplit2LeafId !== newLeaf.id) {
                             const oldLeaf = this.app.workspace.getLeafById(pluginInstance.designatedSplit2LeafId);
                             if (oldLeaf) {
                                 oldLeaf.detach(); // Detach the old designated leaf
                             }
                        }

                        pluginInstance.designatedSplit2LeafId = newLeaf.id;
                        pluginInstance.enforceSingleTabInDesignatedSplit2();
                    }
                }
                return newLeaf;
            };
        }
    }));
  }

  // perform any required disable steps, leave nothing behind
  disable() {
    super.disable();
    this.designatedSplit2LeafId = null;
    // remove the maximised class if necessary
    document.body.toggleClass('maximised', false);
  }

  enforceSingleTabInDesignatedSplit2(): void {
    if (!this.designatedSplit2LeafId) {
      return;
    }

    const split2Leaf = this.app.workspace.getLeafById(this.designatedSplit2LeafId);

    if (!split2Leaf) {
      this.designatedSplit2LeafId = null;
      return;
    }

    const tabGroup = split2Leaf.parent;

    // Ensure the parent is a tab group (WorkspaceTabs)
    if (!tabGroup || tabGroup.type !== 'tabs') {
      // If the leaf is not in a tab group (e.g., a root leaf or some other structure),
      // this logic might not apply as intended.
      // For now, we only operate if it's clearly in a tab group.
      return;
    }

    // Iterate through sibling leaves in the same tab group
    if (tabGroup.children && Array.isArray(tabGroup.children)) {
      tabGroup.children.forEach((siblingLeaf) => {
        // Ensure siblingLeaf is actually a WorkspaceLeaf, though children of WorkspaceTabs should be
        if (siblingLeaf instanceof WorkspaceLeaf && siblingLeaf.id !== this.designatedSplit2LeafId) {
          siblingLeaf.detach();
        }
      });
    }
  }

  // add in the required command pallete commands
  addCommands() {
    // add the maximise command
    this.addCommand({
      id: 'maximise-active-pane',
      name: 'Toggle',
      hotkeys: [{modifiers: ['Mod', 'Shift'], key: 'x'}],
      callback: () => {
        // Toggle the 'maximised' class on the document body
        document.body.toggleClass('maximised', !document.body.hasClass('maximised'));
        this.app.workspace.onLayoutChange(); // Inform Obsidian about layout changes
      }
    });

    // Command to designate a leaf as the single tab for "Split 2"
    this.addCommand({
      id: 'designate-active-leaf-as-split2-single-tab',
      name: "Designate active leaf as Split 2's single tab",
      callback: () => {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf) {
          if (this.designatedSplit2LeafId && this.designatedSplit2LeafId !== activeLeaf.id) {
            const oldLeaf = this.app.workspace.getLeafById(this.designatedSplit2LeafId);
            if (oldLeaf) {
              oldLeaf.detach();
            }
          }
          this.designatedSplit2LeafId = activeLeaf.id;
          this.enforceSingleTabInDesignatedSplit2();
        } else {
          // No active leaf, so clear the designation
          if (this.designatedSplit2LeafId) {
            // Optional: detach the old leaf if one was designated
            // const oldLeaf = this.app.workspace.getLeafById(this.designatedSplit2LeafId);
            // if (oldLeaf) {
            //   oldLeaf.detach();
            // }
          }
          this.designatedSplit2LeafId = null;
        }
      }
    });
  }
}
