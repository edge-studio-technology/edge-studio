import { useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import {
  Compass,
  LogOut,
  MousePointerClick,
  PanelLeft,
  RefreshCw,
} from "lucide-react";
import { Button } from "../components/Button";
import { ButtonRow } from "../components/ButtonRow";
import { Card } from "../components/Card";
import { Page } from "../components/Page";
import { SubSection } from "../components/patterns/SubSection";
import { Disclosure } from "../components/ui/Disclosure";
import { SwitchField } from "../components/ui/SwitchField";
import {
  closeModalOnOutsideClickSetting,
  guidedTourSeenSetting,
  sidebarStartCollapsedSetting,
} from "../lib/behaviourSettings";
import { ChangeCredentialPanel } from "../features/auth/ChangeCredentialPanel";
import { useAuth } from "../features/auth/hooks";

/** Long enough to read the confirmation before the forced re-login. */
const SIGN_OUT_AFTER_CREDENTIAL_CHANGE_MS = 3000;

export function AuthSettingsPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  // Changing a credential revokes every session server-side, so the
  // browser is holding a dead cookie from here on — force the login screen.
  const scheduleSignOut = () => {
    window.setTimeout(() => void signOut(), SIGN_OUT_AFTER_CREDENTIAL_CHANGE_MS);
  };

  const closeModalOnOutsideClick = useSyncExternalStore(
    closeModalOnOutsideClickSetting.subscribe,
    closeModalOnOutsideClickSetting.get,
  );
  const sidebarStartCollapsed = useSyncExternalStore(
    sidebarStartCollapsedSetting.subscribe,
    sidebarStartCollapsedSetting.get,
  );

  return (
    <Page
      title="Settings"
      desc="Manage your admin credentials, interface preferences, and software updates."
      action={
        <Button type="button" iconStart={<LogOut aria-hidden />} onClick={() => void signOut()}>
          Log out
        </Button>
      }
    >
      <Card className="grid w-full gap-4 divide-y divide-slate-200">
        <Disclosure
          title={
            <span className="flex items-center gap-2">
              <h2 className="type-title text-text-primary m-0">Credentials</h2>
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen={false}
        >
          <div className="gap-detail-close my-detail-close grid">
            <ChangeCredentialPanel onCredentialChanged={scheduleSignOut} />

          </div>
        </Disclosure>

        <Disclosure
          title={
            <span className="flex items-center gap-2">
              <h2 className="type-title text-text-primary m-0">Behaviour</h2>
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen={false}
        >
          <div className="gap-detail-close mt-2 grid">
            <SubSection
              icon={<MousePointerClick size={13} />}
              title="Modals"
              description="Control how modal dialogs respond to clicks outside their content."
            >
              <SwitchField
                label="Close modal when clicking outside it"
                description="Turn off if you'd rather only close modals with the X button or Escape."
                checked={closeModalOnOutsideClick}
                onChange={(e) => closeModalOnOutsideClickSetting.set(e.target.checked)}
              />
            </SubSection>

            <SubSection
              icon={<PanelLeft size={13} />}
              title="Sidebar"
              description="Control whether the sidebar starts collapsed or expanded on page load."
            >
              <SwitchField
                label="Start sidebar collapsed"
                description="Applies on page load at desktop widths. The collapse/expand button still works as normal in between."
                checked={sidebarStartCollapsed}
                onChange={(e) => sidebarStartCollapsedSetting.set(e.target.checked)}
              />
            </SubSection>

            <SubSection
              icon={<Compass size={13} aria-hidden />}
              title="Guided tour"
              description="Replay the introduction to Edge Studio's main areas."
            >
              <ButtonRow>
                <Button type="button" onClick={() => guidedTourSeenSetting.set(false)}>
                  Take the tour
                </Button>
              </ButtonRow>
            </SubSection>
          </div>
        </Disclosure>

        <Disclosure
          title={
            <span className="flex items-center gap-2">
              <h2 className="type-title text-text-primary m-0">App</h2>
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen
        >
          <div className="gap-detail-close mt-2 grid">
            <SubSection
              icon={<RefreshCw size={13} aria-hidden />}
              title="Software update"
              description="Check for and install the latest Edge Studio update."
            >
              <ButtonRow>
                <Button type="button" onClick={() => navigate("/update")}>
                  Check for updates
                </Button>
              </ButtonRow>
            </SubSection>
          </div>
        </Disclosure>
      </Card>
    </Page>
  );
}
