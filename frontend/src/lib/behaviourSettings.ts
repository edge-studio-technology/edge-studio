import { createLocalBooleanSetting } from "./localSettings";

export const closeModalOnOutsideClickSetting = createLocalBooleanSetting(
  "close-modal-on-outside-click",
  true,
);
