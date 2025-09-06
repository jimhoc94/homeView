import * as vscode from "vscode";

class IdemHomeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly iconPath?: vscode.ThemeIcon,
    public readonly children?: IdemHomeItem[],
    public readonly itemType?: string,
    public readonly url?: string
  ) {
    super(label, collapsibleState);
    this.iconPath = iconPath;
    this.contextValue = itemType;
  }
}

class IdemHomeProvider implements vscode.TreeDataProvider<IdemHomeItem>, vscode.TreeDragAndDropController<IdemHomeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<IdemHomeItem | undefined | null | void> = new vscode.EventEmitter<IdemHomeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<IdemHomeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  dropMimeTypes = ['application/vnd.code.tree.idemHome'];
  dragMimeTypes = ['application/vnd.code.tree.idemHome'];

  private favorites: IdemHomeItem[] = [];
  private context: vscode.ExtensionContext;

  private featuresChildren: IdemHomeItem[] = [];

  private createCommandItem(label: string, icon: vscode.ThemeIcon, command?: string, itemType?: string, url?: string): IdemHomeItem {
    const item = new IdemHomeItem(label, vscode.TreeItemCollapsibleState.None, icon, undefined, itemType, url);
    if (command) {
      item.command = {
        command: command,
        title: label
      };
    } else if (url) {
      item.command = {
        command: 'idemHome.openUrl',
        title: label,
        arguments: [url]
      };
    }
    return item;
  }

  private createFavoriteItem(originalItem: IdemHomeItem): IdemHomeItem {
    const item = new IdemHomeItem(originalItem.label, vscode.TreeItemCollapsibleState.None, originalItem.iconPath, undefined, "favorite", originalItem.url);
    item.command = originalItem.command;
    return item;
  }

  private data: IdemHomeItem[] = [
    new IdemHomeItem("Favorites", vscode.TreeItemCollapsibleState.Expanded, new vscode.ThemeIcon("star")),
    new IdemHomeItem("Features", vscode.TreeItemCollapsibleState.Collapsed, new vscode.ThemeIcon("extensions"))
  ];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadFavorites();
    this.loadFeaturesFromConfig();
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('idemHome.features')) {
        this.loadFeaturesFromConfig();
        this._onDidChangeTreeData.fire();
      }
    });
  }

  getTreeItem(element: IdemHomeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: IdemHomeItem): Thenable<IdemHomeItem[]> {
    if (!element) {
      return Promise.resolve(this.data);
    }
    
    if (element.label === "Favorites") {
      return Promise.resolve(this.favorites);
    }
    
    if (element.label === "Features") {
      return Promise.resolve(this.featuresChildren);
    }
    
    // Handle dynamic children from configuration
    const configChild = this.findItemInConfig(element.label);
    if (configChild && configChild.children) {
      return Promise.resolve(this.buildItemsFromConfig(configChild.children));
    }
    
    return Promise.resolve([]);
  }

  private loadFavorites(): void {
    const savedFavorites = this.context.globalState.get<any[]>('idemHome.favorites', []);
    this.favorites = savedFavorites.map(fav => {
      const item = new IdemHomeItem(fav.label, vscode.TreeItemCollapsibleState.None, new vscode.ThemeIcon(fav.iconId), undefined, "favorite", fav.url);
      if (fav.command) {
        item.command = fav.command;
      }
      return item;
    });
  }

  private saveFavorites(): void {
    const favoritesToSave = this.favorites.map(fav => ({
      label: fav.label,
      iconId: fav.iconPath ? (fav.iconPath as vscode.ThemeIcon).id : 'star',
      url: fav.url,
      command: fav.command
    }));
    this.context.globalState.update('idemHome.favorites', favoritesToSave);
  }

  addToFavorites(item: IdemHomeItem): void {
    const exists = this.favorites.find(fav => fav.label === item.label);
    if (!exists) {
      this.favorites.push(this.createFavoriteItem(item));
      this.saveFavorites();
      this._onDidChangeTreeData.fire();
    }
  }

  removeFromFavorites(item: IdemHomeItem): void {
    const index = this.favorites.findIndex(fav => fav.label === item.label);
    if (index !== -1) {
      this.favorites.splice(index, 1);
      this.saveFavorites();
      this._onDidChangeTreeData.fire();
    }
  }

  handleDrag(source: IdemHomeItem[], treeDataTransfer: vscode.DataTransfer): void | Thenable<void> {
    // Only allow dragging items from favorites
    const favoriteItems = source.filter(item => item.itemType === 'favorite');
    if (favoriteItems.length > 0) {
      treeDataTransfer.set('application/vnd.code.tree.idemHome', new vscode.DataTransferItem(favoriteItems));
    }
  }

  handleDrop(target: IdemHomeItem | undefined, sources: vscode.DataTransfer): void | Thenable<void> {
    const transferItem = sources.get('application/vnd.code.tree.idemHome');
    if (!transferItem) {
      return;
    }

    const draggedItems: IdemHomeItem[] = transferItem.value;
    
    // Only allow dropping within favorites branch
    if (!target || target.label === 'Favorites' || target.itemType === 'favorite') {
      this.reorderFavorites(draggedItems, target);
    }
  }

  private reorderFavorites(draggedItems: IdemHomeItem[], target: IdemHomeItem | undefined): void {
    // Remove dragged items from current position
    for (const draggedItem of draggedItems) {
      const index = this.favorites.findIndex(fav => fav.label === draggedItem.label);
      if (index !== -1) {
        this.favorites.splice(index, 1);
      }
    }

    // Insert at new position
    let targetIndex = 0;
    if (target && target.itemType === 'favorite') {
      targetIndex = this.favorites.findIndex(fav => fav.label === target.label);
      if (targetIndex === -1) {
        targetIndex = this.favorites.length;
      } else {
        targetIndex += 1; // Insert after the target
      }
    }

    this.favorites.splice(targetIndex, 0, ...draggedItems);
    this.saveFavorites();
    this._onDidChangeTreeData.fire();
  }

  private loadFeaturesFromConfig(): void {
    const config = vscode.workspace.getConfiguration('idemHome');
    const featuresConfig = config.get<any[]>('features', []);
    
    this.featuresChildren = featuresConfig.map(feature => {
      const hasChildren = feature.children && feature.children.length > 0;
      return new IdemHomeItem(
        feature.label,
        hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon(feature.icon),
        undefined,
        hasChildren ? undefined : (feature.favoritable ? 'favoritable' : undefined),
        feature.url
      );
    });
  }

  private findItemInConfig(label: string): any {
    const config = vscode.workspace.getConfiguration('idemHome');
    const featuresConfig = config.get<any[]>('features', []);
    
    for (const feature of featuresConfig) {
      if (feature.label === label) {
        return feature;
      }
    }
    return null;
  }

  private buildItemsFromConfig(items: any[]): IdemHomeItem[] {
    return items.map(item => {
      const hasChildren = item.children && item.children.length > 0;
      const treeItem = new IdemHomeItem(
        item.label,
        hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon(item.icon),
        undefined,
        hasChildren ? undefined : (item.favoritable ? 'favoritable' : undefined),
        item.url
      );
      
      if (item.command) {
        treeItem.command = {
          command: item.command,
          title: item.label
        };
      } else if (item.url) {
        treeItem.command = {
          command: 'idemHome.openUrl',
          title: item.label,
          arguments: [item.url]
        };
      }
      
      return treeItem;
    });
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new IdemHomeProvider(context);
  vscode.window.createTreeView('idemHomeView', {
    treeDataProvider: provider,
    showCollapseAll: true,
    canSelectMany: false,
    dragAndDropController: provider
  });

  // Create status bar button
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = "$(home) IDEM";
  statusBarItem.tooltip = "Show IDEM HOME (Ctrl+F1)";
  statusBarItem.command = "idemHome.showView";
  statusBarItem.show();

  const openSettingsCommand = vscode.commands.registerCommand('idemHome.openSettings', () => {
    vscode.commands.executeCommand('workbench.action.openSettings');
  });

  const openUrlCommand = vscode.commands.registerCommand('idemHome.openUrl', (url: string) => {
    vscode.env.openExternal(vscode.Uri.parse(url));
  });

  const addToFavoritesCommand = vscode.commands.registerCommand('idemHome.addToFavorites', (item: IdemHomeItem) => {
    provider.addToFavorites(item);
    vscode.window.showInformationMessage(`"${item.label}" added to favorites!`);
  });

  const removeFromFavoritesCommand = vscode.commands.registerCommand('idemHome.removeFromFavorites', (item: IdemHomeItem) => {
    provider.removeFromFavorites(item);
    vscode.window.showInformationMessage(`"${item.label}" removed from favorites!`);
  });

  const showViewCommand = vscode.commands.registerCommand('idemHome.showView', () => {
    vscode.commands.executeCommand('idemHomeView.focus');
  });

  context.subscriptions.push(
    openSettingsCommand,
    openUrlCommand,
    addToFavoritesCommand,
    removeFromFavoritesCommand,
    showViewCommand,
    statusBarItem
  );
}

export function deactivate() {}
