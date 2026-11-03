import { useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import {
  Compass,
  HardDrive,
  LogOut,
  MousePointerClick,
  PanelLeft,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { Button } from "../components/Button";
import { ButtonRow } from "../components/ButtonRow";
import { Card } from "../components/Card";
import { Page } from "../components/Page";
import { SubSection } from "../components/patterns/SubSection";
import { CopyableCode } from "../components/patterns/CopyableCode";
import { Disclosure } from "../components/ui/Disclosure";
import { SwitchField } from "../components/ui/SwitchField";
import { ToggleTabs } from "../components/ui/ToggleTabs";
import {
  closeModalOnOutsideClickSetting,
  guidedTourSeenSetting,
  sidebarStartCollapsedSetting,
} from "../lib/behaviourSettings";
import { ChangeCredentialPanel } from "../features/auth/ChangeCredentialPanel";
import { SessionSettingsPanel } from "../features/auth/SessionSettingsPanel";
import { useAuth } from "../features/auth/hooks";
import { StorageHistoryPanel } from "../features/storage-history/StorageHistoryPanel";
import { RetentionSettingsPanel } from "../features/storage-history/RetentionSettingsPanel";
import { CameraRetentionSettingsPanel } from "../features/storage-history/CameraRetentionSettingsPanel";

/** Long enough to read the confirmation before the forced re-login. */
const SIGN_OUT_AFTER_CREDENTIAL_CHANGE_MS = 3000;

export function AuthSettingsPage() {
  const [storageHistoryOpen, setStorageHistoryOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [uninstallMode, setUninstallMode] = useState<"keep" | "delete">("keep");
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
      desc="Manage your admin credentials, storage history, interface preferences, and software updates."
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
              <h2 className="type-title text-text-primary m-0">Storage &amp; history</h2>
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen={false}
          onToggle={(event) => setStorageHistoryOpen(event.currentTarget.open)}
        >
          <div className="gap-detail-close mt-2 grid">
            <SubSection
              icon={<HardDrive size={13} aria-hidden />}
              title="Stored records"
              description="Review stored records and managed files, export history, and configure automatic retention below."
            >
              {storageHistoryOpen ? <StorageHistoryPanel /> : null}
            </SubSection>
            {storageHistoryOpen ? <RetentionSettingsPanel /> : null}
            {storageHistoryOpen ? <CameraRetentionSettingsPanel /> : null}
          </div>
        </Disclosure>

        <Disclosure
          title={
            <span className="flex items-center gap-2">
              <h2 className="type-title text-text-primary m-0">Security</h2>
            </span>
          }
          className="pt-4 pb-6"
          defaultOpen={false}
          onToggle={(event) => setSecurityOpen(event.currentTarget.open)}
        >
          <div className="gap-detail-close my-detail-close grid">
            <ChangeCredentialPanel onCredentialChanged={scheduleSignOut} />
            {securityOpen ? <SessionSettingsPanel /> : null}
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
            <SubSection
              icon={<Terminal size={13} aria-hidden />}
              title="Uninstall Edge Studio"
              description="Run this command in the Pi terminal or over SSH to remove Edge Studio."
            >
              <ToggleTabs
                label="Uninstall data handling"
                value={uninstallMode}
                options={[
                  { value: "keep", label: "Keep data" },
                  { value: "delete", label: "Delete data" },
                ]}
                onChange={setUninstallMode}
                className="mb-3"
              />
              <p className="type-body text-text-secondary m-0" aria-live="polite">
                {uninstallMode === "keep"
                  ? "Keep your data and configuration for reinstalling Edge Studio. The terminal asks you to confirm removal."
                  : "Permanently delete configured data inside the installation directory, including the Minima wallet and its stored backups. Back up what you need first. The terminal requires a separate typed confirmation."}
              </p>
              <CopyableCode
                key={uninstallMode}
                className="my-3"
                value={`curl -fsSL https://raw.githubusercontent.com/edge-studio-technology/edge-studio/main/uninstall.sh | sudo bash${uninstallMode === "delete" ? " -s -- --delete-data" : ""}`}
              />
              <p className="type-body text-text-secondary m-0">
                Review the removal plan in the terminal before confirming. External data directories and unknown files are retained for manual review. The app becomes unavailable when its containers stop.
              </p>
            </SubSection>
          </div>
        </Disclosure>
      </Card>
    </Page>
  );
}
