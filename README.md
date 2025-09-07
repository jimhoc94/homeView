# IDEM Home - zLab Home Extension

![IDEM Icon](homeView.png)

Une extension VS Code qui fournit une vue d'accueil personnalisable avec un système de favoris et une arborescence de features configurable.

## Fonctionnalités

### 🏠 Vue d'accueil centralisée
- Interface unique pour accéder à toutes vos ressources
- Intégration dans la barre d'activité VS Code avec icône mainframe
- Raccourci clavier `Ctrl+F1` pour un accès rapide

### ⭐ Système de favoris
- Ajoutez vos liens et commandes les plus utilisés aux favoris
- Glissez-déposez pour réorganiser vos favoris
- Persistance automatique des favoris

### 🔧 Configuration flexible
- Arborescence des features entièrement configurable via les settings VS Code
- Support des icônes VS Code natives
- Possibilité d'ajouter des commandes VS Code ou des URLs externes

## Installation

1. Téléchargez l'extension depuis le marketplace VS Code
2. Ou installez manuellement le fichier `.vsix`

## Configuration

### Configuration des Features

Accédez aux settings VS Code (`Ctrl+,`) et recherchez `idemHome.features` pour personnaliser votre arborescence.

#### Structure de configuration

```json
{
  "idemHome.features": [
    {
      "label": "Configuration",
      "icon": "settings-gear",
      "children": [
        {
          "label": "Show Settings",
          "icon": "gear",
          "command": "idemHome.openSettings",
          "favoritable": true
        }
      ]
    },
    {
      "label": "Links",
      "icon": "link",
      "children": [
        {
          "label": "Google",
          "icon": "search",
          "url": "https://www.google.com",
          "favoritable": true
        }
      ]
    }
  ]
}
```

#### Propriétés disponibles

| Propriété | Type | Description | Requis |
|-----------|------|-------------|---------|
| `label` | string | Nom affiché dans l'arborescence | ✅ |
| `icon` | string | Icône VS Code (ex: `gear`, `link`, `search`) | ✅ |
| `command` | string | Commande VS Code à exécuter | ❌ |
| `url` | string | URL à ouvrir dans le navigateur | ❌ |
| `favoritable` | boolean | Peut être ajouté aux favoris (défaut: true) | ❌ |
| `children` | array | Sous-éléments (pour les branches) | ❌ |

### Icônes disponibles

Utilisez les icônes intégrées de VS Code :
- `gear`, `settings-gear` - Configuration
- `link`, `globe` - Liens web
- `search` - Recherche
- `play` - Média
- `account` - Profil/Compte
- `home` - Accueil
- `extension` - Extensions
- Et bien d'autres... ([Liste complète](https://code.visualstudio.com/api/references/icons-in-labels))

## Utilisation

### Interface principale

1. **Favoris** : Vos éléments favoris pour un accès rapide
2. **Features** : Arborescence configurable de vos outils et liens

### Actions disponibles

- **Ajouter aux favoris** : Clic droit sur un élément → "Add to Favorites"
- **Supprimer des favoris** : Clic droit sur un favori → "Remove from Favorites"
- **Réorganiser** : Glissez-déposez vos favoris pour les réorganiser

### Raccourcis clavier

- `Ctrl+F1` : Ouvrir/fermer la vue IDEM Home

## Exemples de configuration

### Configuration mainframe/IBM
```json
{
  "idemHome.features": [
    {
      "label": "IBM Tools",
      "icon": "server",
      "children": [
        {
          "label": "IBM Documentation",
          "icon": "book",
          "url": "https://www.ibm.com/docs",
          "favoritable": true
        },
        {
          "label": "z/OS Knowledge Center",
          "icon": "library",
          "url": "https://www.ibm.com/support/knowledgecenter/SSLTBW",
          "favoritable": true
        }
      ]
    },
    {
      "label": "Development",
      "icon": "code",
      "children": [
        {
          "label": "Open Terminal",
          "icon": "terminal",
          "command": "workbench.action.terminal.new",
          "favoritable": true
        }
      ]
    }
  ]
}
```

### Configuration liens utiles
```json
{
  "idemHome.features": [
    {
      "label": "Documentation",
      "icon": "book",
      "children": [
        {
          "label": "MDN Web Docs",
          "icon": "globe",
          "url": "https://developer.mozilla.org",
          "favoritable": true
        },
        {
          "label": "Stack Overflow",
          "icon": "question",
          "url": "https://stackoverflow.com",
          "favoritable": true
        }
      ]
    }
  ]
}
```

## Développement

### Prérequis
- Node.js 16+
- VS Code 1.74.0+

### Scripts disponibles
```bash
npm run compile    # Compiler TypeScript
npm run watch      # Mode watch pour le développement
npm run dev        # Build en mode développement avec watch
npm run build      # Build de production
npm run package    # Créer le package .vsix
npm run lint       # Linter le code
npm run test       # Exécuter les tests
```

### Structure du projet
```
├── src/
│   └── extension.ts     # Code principal de l'extension
├── icons/
│   ├── mainframe.svg    # Icône mainframe IBM
│   └── dinosaur.svg     # Icône alternative
├── out/                 # Fichiers compilés
├── package.json         # Configuration de l'extension
└── README.md           # Cette documentation
```

## Contribuer

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commitez vos changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrez une Pull Request

## Licence

Ce projet est sous licence [MIT](LICENSE.txt).

## Support

Pour signaler un bug ou demander une fonctionnalité, veuillez créer une [issue](https://github.com/jimhoc94/homeView/issues) sur GitHub.

---

**zLab** - Extension développée pour améliorer votre expérience de développement dans VS Code.
