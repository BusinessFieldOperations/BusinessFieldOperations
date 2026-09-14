/// <reference types="vite/client" />

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "mdui-button": any;
      "mdui-button-icon": any;
      "mdui-card": any;
      "mdui-text-field": any;
      "mdui-navigation-bar-item": any;
      "mdui-navigation-bar": any;
      "mdui-badge": any;
      "mdui-circular-progress": any;
      "mdui-avatar": any;
      "mdui-divider": any;
      "mdui-select": any;
      "mdui-menu-item": any;
      "mdui-list": any;
      "mdui-list-item": any;
    }
  }
}

export {};

