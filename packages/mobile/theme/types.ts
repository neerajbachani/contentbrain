import type { colors } from "./colors";

export type ColorScheme = "light" | "dark";

export type ThemeColors = {
  appBG: string;
  splashBG: string;
  highlightBG: string;
  border: string;
  borderFocus: string;
  icon: string;
  iconMenu: string;
  iconHovered: string;
  textSupporting: string;
  text: string;
  link: string;
  linkHover: string;
  buttonDefaultBG: string;
  buttonHoveredBG: string;
  buttonPressedBG: string;
  buttonSuccessText: string;
  danger: string;
  dangerHover: string;
  warning: string;
  success: string;
  successHover: string;
  successPressed: string;
  transparent: string;
  signInPage: string;
  componentBG: string;
  hoverComponentBG: string;
  activeComponentBG: string;
  heading: string;
  textLight: string;
  textError: string;
  modalBackground: string;
  cardBG: string;
  cardBorder: string;
  spinner: string;
  placeholderText: string;
  sidebar: string;
  sidebarHover: string;
  colorScheme: ColorScheme;
};

export type { colors };
