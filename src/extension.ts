import * as vscode from "vscode";

class IdemHomeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    iconPathParam?: vscode.ThemeIcon | vscode.Uri | string,
    public readonly children?: IdemHomeItem[],
    public readonly itemType?: string,
    public readonly url?: string
  ) {
    super(label, collapsibleState);
    this.iconPath = iconPathParam;
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
  private favoritesItem: IdemHomeItem;
  private featuresItem: IdemHomeItem;
  private featuresLoaded: boolean = false;

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
    new IdemHomeItem("IDEM", vscode.TreeItemCollapsibleState.Expanded, new vscode.ThemeIcon("home"))
  ];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    // Pre-create static items
    this.favoritesItem = new IdemHomeItem("Favorites", vscode.TreeItemCollapsibleState.Expanded, this.getIconPath("star"));
    this.featuresItem = new IdemHomeItem("Features", vscode.TreeItemCollapsibleState.Collapsed, this.getIconPath("extensions"), undefined, "featuresContainer");
    
    // Load data asynchronously
    this.loadFavorites();
    // Don't load features immediately - use lazy loading
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('idemHome.features')) {
        this.featuresLoaded = false; // Force reload
        this.featuresChildren = [];
        // Immediately reload if features were previously loaded
        this.loadFeaturesFromConfig();
        this.featuresLoaded = true;
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
    
    if (element.label === "IDEM") {
      return Promise.resolve([this.favoritesItem, this.featuresItem]);
    }
    
    if (element.label === "Favorites") {
      return Promise.resolve(this.favorites);
    }
    
    if (element.label === "Features") {
      // Lazy load features only when expanded
      if (!this.featuresLoaded) {
        this.loadFeaturesFromConfig();
        this.featuresLoaded = true;
      }
      return Promise.resolve(this.featuresChildren);
    }
    
    // Handle dynamic children from configuration
    const configChild = this.findItemInConfig(element.label);
    if (configChild && configChild.children) {
      return Promise.resolve(this.buildItemsFromConfig(configChild.children, element.label));
    }
    
    return Promise.resolve([]);
  }

  private loadFavorites(): void {
    const savedFavorites = this.context.globalState.get<any[]>('idemHome.favorites', []);
    this.favorites = savedFavorites.map(fav => {
      const item = new IdemHomeItem(fav.label, vscode.TreeItemCollapsibleState.None, this.getIconPath(fav.iconId), undefined, "favorite", fav.url);
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
    try {
      const config = vscode.workspace.getConfiguration('idemHome');
      const featuresConfig = config.get<any[]>('features', []);
      
      this.featuresChildren = featuresConfig.map((feature, index) => {
        const hasChildren = feature.children && feature.children.length > 0;
        const isUserCreated = this.isUserCreatedFolder(feature, index);
        
        let contextValue: string | undefined;
        let iconPath: any = undefined;
        
        if (hasChildren) {
          // Folders with children can have items added and can be deleted if user-created
          if (isUserCreated) {
            contextValue = 'userFolder';  // Can be deleted and can have items added
            iconPath = undefined; // No icon for user-created folders
          } else {
            contextValue = 'defaultFolder';  // Can have items added but not deleted
            iconPath = this.getIconPath(feature.icon); // Keep icons for default folders
          }
        } else if (isUserCreated) {
          // Empty user folders can be deleted and have items added
          contextValue = 'userFolder';
          iconPath = undefined; // No icon for user-created folders
        } else if (feature.favoritable) {
          contextValue = 'favoritable';
          iconPath = this.getIconPath(feature.icon); // Keep icons for favoritable items
        }
        
        return new IdemHomeItem(
          feature.label,
          hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
          iconPath,
          undefined,
          contextValue,
          feature.url
        );
      });
    } catch (error) {
      console.error('Error loading features configuration:', error);
      this.featuresChildren = [];
    }
  }

  private isUserCreatedFolder(feature: any, index: number): boolean {
    // Check if this folder is beyond the default configuration
    // Default folders are "Configuration" and "Links" (first 2 items)
    const defaultFolders = ['Configuration', 'Links'];
    return index >= 2 || !defaultFolders.includes(feature.label);
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

  private buildItemsFromConfig(items: any[], parentLabel?: string): IdemHomeItem[] {
    return items.map(item => {
      const hasChildren = item.children && item.children.length > 0;
      
      let contextValue: string | undefined;
      if (hasChildren) {
        contextValue = undefined; // Folders within folders don't have actions yet
      } else {
        // This is a leaf node
        const isInDefaultFolder = parentLabel === 'Configuration' || parentLabel === 'Links';
        const isUserCreatedItem = !isInDefaultFolder;
        
        if (isUserCreatedItem && item.favoritable) {
          // User-created items that are favoritable have both delete and favorite actions
          contextValue = 'deletableLeafNode';
        } else if (isUserCreatedItem) {
          // User-created items that are not favoritable (shouldn't happen but safety)
          contextValue = 'deletableLeafNode';
        } else if (item.favoritable) {
          // Default folder items that are favoritable
          contextValue = 'favoritable';
        }
      }
      
      const treeItem = new IdemHomeItem(
        item.label,
        hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        this.getIconPath(item.icon),
        undefined,
        contextValue,
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

  private getIconPath(iconName: string): vscode.ThemeIcon {
    // Use only VS Code built-in codicons
    return new vscode.ThemeIcon(iconName);
  }

  createSubfolder(): void {
    vscode.window.showInputBox({
      prompt: 'Enter subfolder name',
      placeHolder: 'New Subfolder'
    }).then(folderName => {
      if (folderName) {
        // Create subfolder without icon (will have no icon)
        this.addSubfolderToConfig(folderName, "folder"); // Use default folder icon for storage
      }
    });
  }


  private addSubfolderToConfig(folderName: string, iconName: string = "folder"): void {
    try {
      const config = vscode.workspace.getConfiguration('idemHome');
      const featuresConfig = config.get<any[]>('features', []);
      
      const newSubfolder = {
        label: folderName,
        icon: iconName,
        children: []
      };
      
      featuresConfig.push(newSubfolder);
      
      config.update('features', featuresConfig, vscode.ConfigurationTarget.Global).then(() => {
        vscode.window.showInformationMessage(`Subfolder "${folderName}" created!`);
        // The configuration listener will handle the refresh automatically
      }).catch((error) => {
        vscode.window.showErrorMessage(`Error creating subfolder: ${error.message}`);
        console.error('Error updating configuration:', error);
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error creating subfolder: ${error}`);
      console.error('Error in addSubfolderToConfig:', error);
    }
  }

  deleteFolder(item: IdemHomeItem): void {
    const options = ['Yes, delete it', 'Cancel'];
    vscode.window.showWarningMessage(
      `Are you sure you want to delete the folder "${item.label}"? This action cannot be undone.`,
      { modal: true },
      ...options
    ).then(selection => {
      if (selection === 'Yes, delete it') {
        this.removeFolderFromConfig(item.label);
      }
    });
  }

  private removeFolderFromConfig(folderName: string): void {
    try {
      const config = vscode.workspace.getConfiguration('idemHome');
      const featuresConfig = config.get<any[]>('features', []);
      
      const updatedFeatures = featuresConfig.filter(feature => feature.label !== folderName);
      
      config.update('features', updatedFeatures, vscode.ConfigurationTarget.Global).then(() => {
        vscode.window.showInformationMessage(`Folder "${folderName}" has been deleted.`);
        // The configuration listener will handle the refresh automatically
      }).catch((error) => {
        vscode.window.showErrorMessage(`Error deleting folder: ${error.message}`);
        console.error('Error updating configuration:', error);
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error deleting folder: ${error}`);
      console.error('Error in removeFolderFromConfig:', error);
    }
  }

  createLeafNode(parentItem: IdemHomeItem): void {
    this.collectLeafNodeInfo(parentItem.label);
  }

  private collectLeafNodeInfo(parentFolderName: string): void {
    // Step 1: Get the name
    vscode.window.showInputBox({
      prompt: 'Enter item name',
      placeHolder: 'New Item'
    }).then(itemName => {
      if (itemName) {
        this.selectLeafNodeIcon(parentFolderName, itemName);
      }
    });
  }

  private selectLeafNodeIcon(parentFolderName: string, itemName: string): void {
    // Step 2: Select icon
    const availableIcons = [
      { label: '$(gear) gear', description: 'Settings/configuration', icon: 'gear' },
      { label: '$(link) link', description: 'Web links', icon: 'link' },
      { label: '$(search) search', description: 'Search engines', icon: 'search' },
      { label: '$(play) play', description: 'Media/video', icon: 'play' },
      { label: '$(account) account', description: 'User accounts', icon: 'account' },
      { label: '$(terminal) terminal', description: 'Command line tools', icon: 'terminal' },
      { label: '$(code) code', description: 'Development tools', icon: 'code' },
      { label: '$(database) database', description: 'Database tools', icon: 'database' },
      { label: '$(server) server', description: 'Server management', icon: 'server' },
      { label: '$(cloud) cloud', description: 'Cloud services', icon: 'cloud' },
      { label: '$(globe) globe', description: 'Web services', icon: 'globe' },
      { label: '$(book) book', description: 'Documentation', icon: 'book' },
      { label: '$(rocket) rocket', description: 'Deployment', icon: 'rocket' },
      { label: '$(shield) shield', description: 'Security tools', icon: 'shield' },
      { label: '$(tools) tools', description: 'Utilities', icon: 'tools' },
      { label: '$(package) package', description: 'Package managers', icon: 'package' },
      { label: '$(extensions) extensions', description: 'Extensions', icon: 'extensions' },
      { label: '$(file) file', description: 'File operations', icon: 'file' },
      { label: '$(bug) bug', description: 'Bug tracking', icon: 'bug' },
      { label: '$(beaker) beaker', description: 'Testing tools', icon: 'beaker' }
    ];

    vscode.window.showQuickPick(availableIcons, {
      placeHolder: 'Choose an icon for your item',
      matchOnDescription: true
    }).then(selectedIcon => {
      if (selectedIcon) {
        this.selectLeafNodeType(parentFolderName, itemName, selectedIcon.icon);
      }
    });
  }

  private selectLeafNodeType(parentFolderName: string, itemName: string, iconName: string): void {
    // Step 3: Select type (command or URL)
    const typeOptions = [
      { label: 'VS Code Command', description: 'Execute a VS Code command', type: 'command' },
      { label: 'URL Link', description: 'Open a web URL', type: 'url' }
    ];

    vscode.window.showQuickPick(typeOptions, {
      placeHolder: 'What type of item do you want to create?'
    }).then(selectedType => {
      if (selectedType) {
        this.getLeafNodeAction(parentFolderName, itemName, iconName, selectedType.type);
      }
    });
  }

  private getLeafNodeAction(parentFolderName: string, itemName: string, iconName: string, type: string): void {
    // Step 4: Get command or URL
    const prompt = type === 'command' ? 'Enter VS Code command (e.g., workbench.action.openSettings)' : 'Enter URL (e.g., https://example.com)';
    const placeholder = type === 'command' ? 'workbench.action.openSettings' : 'https://example.com';

    vscode.window.showInputBox({
      prompt: prompt,
      placeHolder: placeholder,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Please enter a valid ' + (type === 'command' ? 'command' : 'URL');
        }
        if (type === 'url' && !value.startsWith('http://') && !value.startsWith('https://')) {
          return 'URL must start with http:// or https://';
        }
        return null;
      }
    }).then(action => {
      if (action) {
        this.addLeafNodeToConfig(parentFolderName, itemName, iconName, type, action);
      }
    });
  }

  private addLeafNodeToConfig(parentFolderName: string, itemName: string, iconName: string, type: string, action: string): void {
    try {
      const config = vscode.workspace.getConfiguration('idemHome');
      const featuresConfig = config.get<any[]>('features', []);
      
      // Find the parent folder
      const parentFolder = featuresConfig.find(feature => feature.label === parentFolderName);
      if (!parentFolder) {
        vscode.window.showErrorMessage(`Parent folder "${parentFolderName}" not found.`);
        return;
      }

      // Initialize children array if it doesn't exist
      if (!parentFolder.children) {
        parentFolder.children = [];
      }

      // Create the new leaf node
      const newLeafNode: any = {
        label: itemName,
        icon: iconName,
        favoritable: true
      };

      if (type === 'command') {
        newLeafNode.command = action;
      } else {
        newLeafNode.url = action;
      }

      // Add to parent's children
      parentFolder.children.push(newLeafNode);

      // Save the updated configuration
      config.update('features', featuresConfig, vscode.ConfigurationTarget.Global).then(() => {
        vscode.window.showInformationMessage(`Item "${itemName}" added to "${parentFolderName}"!`);
        // The configuration listener will handle the refresh automatically
      }).catch((error) => {
        vscode.window.showErrorMessage(`Error creating item: ${error.message}`);
        console.error('Error updating configuration:', error);
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error creating item: ${error}`);
      console.error('Error in addLeafNodeToConfig:', error);
    }
  }

  deleteLeafNode(item: IdemHomeItem): void {
    const options = ['Yes, delete it', 'Cancel'];
    vscode.window.showWarningMessage(
      `Are you sure you want to delete the item "${item.label}"? This action cannot be undone.`,
      { modal: true },
      ...options
    ).then(selection => {
      if (selection === 'Yes, delete it') {
        this.removeLeafNodeFromConfig(item.label);
      }
    });
  }

  private removeLeafNodeFromConfig(itemLabel: string): void {
    try {
      const config = vscode.workspace.getConfiguration('idemHome');
      const featuresConfig = config.get<any[]>('features', []);
      
      let itemFound = false;
      
      // Search through all folders and their children to find and remove the item
      for (const feature of featuresConfig) {
        if (feature.children && Array.isArray(feature.children)) {
          const originalLength = feature.children.length;
          feature.children = feature.children.filter((child: any) => child.label !== itemLabel);
          
          if (feature.children.length < originalLength) {
            itemFound = true;
            break;
          }
        }
      }
      
      if (!itemFound) {
        vscode.window.showErrorMessage(`Item "${itemLabel}" not found.`);
        return;
      }

      // Save the updated configuration
      config.update('features', featuresConfig, vscode.ConfigurationTarget.Global).then(() => {
        vscode.window.showInformationMessage(`Item "${itemLabel}" has been deleted.`);
        // The configuration listener will handle the refresh automatically
      }).catch((error) => {
        vscode.window.showErrorMessage(`Error deleting item: ${error.message}`);
        console.error('Error updating configuration:', error);
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error deleting item: ${error}`);
      console.error('Error in removeLeafNodeFromConfig:', error);
    }
  }

  editFolder(item: IdemHomeItem): void {
    vscode.window.showInputBox({
      prompt: 'Enter new folder name',
      placeHolder: 'New folder name',
      value: item.label // Pre-fill with current name
    }).then(newFolderName => {
      if (newFolderName && newFolderName !== item.label) {
        this.updateFolderInConfig(item.label, newFolderName);
      }
    });
  }

  private updateFolderInConfig(oldFolderName: string, newFolderName: string): void {
    try {
      const config = vscode.workspace.getConfiguration('idemHome');
      const featuresConfig = config.get<any[]>('features', []);
      
      // Find and update the folder
      const folder = featuresConfig.find(feature => feature.label === oldFolderName);
      if (!folder) {
        vscode.window.showErrorMessage(`Folder "${oldFolderName}" not found.`);
        return;
      }

      folder.label = newFolderName;

      // Save the updated configuration
      config.update('features', featuresConfig, vscode.ConfigurationTarget.Global).then(() => {
        vscode.window.showInformationMessage(`Folder renamed to "${newFolderName}".`);
        // The configuration listener will handle the refresh automatically
      }).catch((error) => {
        vscode.window.showErrorMessage(`Error updating folder: ${error.message}`);
        console.error('Error updating configuration:', error);
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error updating folder: ${error}`);
      console.error('Error in updateFolderInConfig:', error);
    }
  }

  editLeafNode(item: IdemHomeItem): void {
    // Step 1: Get the current item details from config
    this.findLeafNodeInConfig(item.label).then(nodeInfo => {
      if (nodeInfo) {
        this.showEditLeafNodeDialog(nodeInfo.node, nodeInfo.parentFolder);
      } else {
        vscode.window.showErrorMessage(`Item "${item.label}" not found.`);
      }
    });
  }

  private async findLeafNodeInConfig(itemLabel: string): Promise<{node: any, parentFolder: any} | null> {
    try {
      const config = vscode.workspace.getConfiguration('idemHome');
      const featuresConfig = config.get<any[]>('features', []);
      
      // Search through all folders and their children to find the item
      for (const feature of featuresConfig) {
        if (feature.children && Array.isArray(feature.children)) {
          const node = feature.children.find((child: any) => child.label === itemLabel);
          if (node) {
            return { node, parentFolder: feature };
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error finding leaf node:', error);
      return null;
    }
  }

  private showEditLeafNodeDialog(node: any, parentFolder: any): void {
    // Step 1: Edit name
    vscode.window.showInputBox({
      prompt: 'Enter new item name',
      placeHolder: 'Item name',
      value: node.label
    }).then(newName => {
      if (newName && newName !== node.label) {
        // Step 2: Edit icon
        this.showEditIconPicker(node, parentFolder, newName);
      } else if (newName === node.label) {
        // Name didn't change, go to icon selection
        this.showEditIconPicker(node, parentFolder, newName);
      }
    });
  }

  private showEditIconPicker(node: any, parentFolder: any, newName: string): void {
    const baseIcons = [
      { label: '$(gear) gear', description: 'Settings/configuration', icon: 'gear' },
      { label: '$(link) link', description: 'Web links', icon: 'link' },
      { label: '$(search) search', description: 'Search engines', icon: 'search' },
      { label: '$(play) play', description: 'Media/video', icon: 'play' },
      { label: '$(account) account', description: 'User accounts', icon: 'account' },
      { label: '$(terminal) terminal', description: 'Command line tools', icon: 'terminal' },
      { label: '$(code) code', description: 'Development tools', icon: 'code' },
      { label: '$(database) database', description: 'Database tools', icon: 'database' },
      { label: '$(server) server', description: 'Server management', icon: 'server' },
      { label: '$(cloud) cloud', description: 'Cloud services', icon: 'cloud' },
      { label: '$(globe) globe', description: 'Web services', icon: 'globe' },
      { label: '$(book) book', description: 'Documentation', icon: 'book' },
      { label: '$(rocket) rocket', description: 'Deployment', icon: 'rocket' },
      { label: '$(shield) shield', description: 'Security tools', icon: 'shield' },
      { label: '$(tools) tools', description: 'Utilities', icon: 'tools' },
      { label: '$(package) package', description: 'Package managers', icon: 'package' },
      { label: '$(extensions) extensions', description: 'Extensions', icon: 'extensions' },
      { label: '$(file) file', description: 'File operations', icon: 'file' },
      { label: '$(bug) bug', description: 'Bug tracking', icon: 'bug' },
      { label: '$(beaker) beaker', description: 'Testing tools', icon: 'beaker' }
    ];

    // Find current icon and put it first with "CURRENT" indicator
    const currentIconIndex = baseIcons.findIndex(icon => icon.icon === node.icon);
    let availableIcons = [...baseIcons];
    
    if (currentIconIndex >= 0) {
      const currentIcon = availableIcons[currentIconIndex];
      // Remove from original position
      availableIcons.splice(currentIconIndex, 1);
      // Add at the beginning with current indicator
      availableIcons.unshift({
        ...currentIcon,
        label: `${currentIcon.label} (CURRENT)`,
        description: `${currentIcon.description} - Currently selected`
      });
    }

    vscode.window.showQuickPick(availableIcons, {
      placeHolder: `Choose an icon for your item (current: $(${node.icon}) ${node.icon})`,
      matchOnDescription: true,
      canPickMany: false
    }).then(selectedIcon => {
      if (selectedIcon) {
        // Step 3: Edit type and action
        this.showEditTypeAndAction(node, parentFolder, newName, selectedIcon.icon);
      }
    });
  }

  private showEditTypeAndAction(node: any, parentFolder: any, newName: string, newIcon: string): void {
    const currentType = node.command ? 'command' : 'url';
    const currentAction = node.command || node.url || '';

    const baseTypeOptions = [
      { label: 'VS Code Command', description: 'Execute a VS Code command', type: 'command' },
      { label: 'URL Link', description: 'Open a web URL', type: 'url' }
    ];

    // Find current type and put it first with "CURRENT" indicator
    const currentTypeIndex = baseTypeOptions.findIndex(option => option.type === currentType);
    let typeOptions = [...baseTypeOptions];
    
    if (currentTypeIndex >= 0) {
      const currentTypeOption = typeOptions[currentTypeIndex];
      // Remove from original position
      typeOptions.splice(currentTypeIndex, 1);
      // Add at the beginning with current indicator
      typeOptions.unshift({
        ...currentTypeOption,
        label: `${currentTypeOption.label} (CURRENT)`,
        description: `${currentTypeOption.description} - Currently selected`
      });
    }

    vscode.window.showQuickPick(typeOptions, {
      placeHolder: `What type of item is this? (current: ${currentType})`
    }).then(selectedType => {
      if (selectedType) {
        // Final step: Edit the action
        const prompt = selectedType.type === 'command' ? 'Enter VS Code command' : 'Enter URL';
        const placeholder = selectedType.type === 'command' ? 'workbench.action.openSettings' : 'https://example.com';

        vscode.window.showInputBox({
          prompt: prompt,
          placeHolder: placeholder,
          value: selectedType.type === currentType ? currentAction : '',
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return 'Please enter a valid ' + (selectedType.type === 'command' ? 'command' : 'URL');
            }
            if (selectedType.type === 'url' && !value.startsWith('http://') && !value.startsWith('https://')) {
              return 'URL must start with http:// or https://';
            }
            return null;
          }
        }).then(newAction => {
          if (newAction) {
            this.updateLeafNodeInConfig(node, parentFolder, newName, newIcon, selectedType.type, newAction);
          }
        });
      }
    });
  }

  private updateLeafNodeInConfig(originalNode: any, parentFolder: any, newName: string, newIcon: string, newType: string, newAction: string): void {
    try {
      const config = vscode.workspace.getConfiguration('idemHome');
      const featuresConfig = config.get<any[]>('features', []);
      
      // Find the parent folder in the config
      const folder = featuresConfig.find(feature => feature.label === parentFolder.label);
      if (!folder || !folder.children) {
        vscode.window.showErrorMessage(`Parent folder not found.`);
        return;
      }

      // Find and update the node
      const nodeIndex = folder.children.findIndex((child: any) => child.label === originalNode.label);
      if (nodeIndex === -1) {
        vscode.window.showErrorMessage(`Item not found.`);
        return;
      }

      // Update the node
      const updatedNode: any = {
        label: newName,
        icon: newIcon,
        favoritable: true
      };

      if (newType === 'command') {
        updatedNode.command = newAction;
      } else {
        updatedNode.url = newAction;
      }

      folder.children[nodeIndex] = updatedNode;

      // Save the updated configuration
      config.update('features', featuresConfig, vscode.ConfigurationTarget.Global).then(() => {
        vscode.window.showInformationMessage(`Item updated successfully!`);
        // The configuration listener will handle the refresh automatically
      }).catch((error) => {
        vscode.window.showErrorMessage(`Error updating item: ${error.message}`);
        console.error('Error updating configuration:', error);
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error updating item: ${error}`);
      console.error('Error in updateLeafNodeInConfig:', error);
    }
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

  const createSubfolderCommand = vscode.commands.registerCommand('idemHome.createSubfolder', () => {
    provider.createSubfolder();
  });

  const deleteFolderCommand = vscode.commands.registerCommand('idemHome.deleteFolder', (item: IdemHomeItem) => {
    provider.deleteFolder(item);
  });

  const createLeafNodeCommand = vscode.commands.registerCommand('idemHome.createLeafNode', (item: IdemHomeItem) => {
    provider.createLeafNode(item);
  });

  const deleteLeafNodeCommand = vscode.commands.registerCommand('idemHome.deleteLeafNode', (item: IdemHomeItem) => {
    provider.deleteLeafNode(item);
  });

  const editFolderCommand = vscode.commands.registerCommand('idemHome.editFolder', (item: IdemHomeItem) => {
    provider.editFolder(item);
  });

  const editLeafNodeCommand = vscode.commands.registerCommand('idemHome.editLeafNode', (item: IdemHomeItem) => {
    provider.editLeafNode(item);
  });

  context.subscriptions.push(
    openSettingsCommand,
    openUrlCommand,
    addToFavoritesCommand,
    removeFromFavoritesCommand,
    showViewCommand,
    createSubfolderCommand,
    deleteFolderCommand,
    createLeafNodeCommand,
    deleteLeafNodeCommand,
    editFolderCommand,
    editLeafNodeCommand,
    statusBarItem
  );
}

export function deactivate() {}
