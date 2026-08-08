import { createLocalBooleanSetting } from "./localSettings";

export const closeModalOnOutsideClickSetting = createLocalBooleanSetting(
  "close-modal-on-outside-click",
  true,
);

export const sidebarStartCollapsedSetting = createLocalBooleanSetting(
  "sidebar-start-collapsed",
  false,
);
