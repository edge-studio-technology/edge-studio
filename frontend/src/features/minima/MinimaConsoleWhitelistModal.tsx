import { useEffect, useState, type ReactNode } from "react";
import type { MinimaConsoleCatalogEntry } from "../../app/types";
import { LoadingDots } from "../../components/ui/LoadingDots";
import { ErrorText } from "../../components/ui/ErrorText";
import { useToast } from "../../components/ToastProvider";
import { Button } from "../../components/ui/Button";
import { CheckboxField } from "../../components/ui/CheckboxField";
import { Disclosure } from "../../components/ui/Disclosure";
import { InputField } from "../../components/ui/InputField";
import { Modal } from "../../components/ui/Modal";
import { getConsoleWhitelist, updateConsoleWhitelist } from "./minimaConsoleApi";

function WhitelistCheckRow({
  label,
  detail,
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  label: ReactNode;
  detail?: ReactNode;
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="gap-detail-close py-detail-close grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center">
      <CheckboxField
        className="min-w-0"
        label={label}
        checked={checked}
        indeterminate={indeterminate}
        disabled={disabled}
        onChange={() => onChange()}
      />
      {detail ? (
        <div className="min-w-0 [overflow-wrap:anywhere]">{detail}</div>
      ) : (
        <span aria-hidden className="min-w-0" />
      )}
    </div>
  );
}

function CommandRow({
  entry,
  checked,
  onToggle,
}: {
  entry: MinimaConsoleCatalogEntry;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <WhitelistCheckRow
      label={<span className="type-mono">{entry.verb}</span>}
      detail={<p className="type-meta text-text-secondary m-0">{entry.label}</p>}
      checked={checked}
      onChange={onToggle}
    />
  );
}

function WhitelistSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="border-stroke-secondary bg-surface-always-white rounded-soft overflow-clip border">
      <Disclosure
        title={title}
        defaultOpen={defaultOpen}
        className="gap-0"
        summaryClassName="bg-surface-primary px-pad-close py-pad-close min-h-11"
        contentClassName="gap-0"
      >
        {children}
      </Disclosure>
    </div>
  );
}

function CommandSection({
  title,
  entries,
  enabledKeys,
  onToggle,
  onSetAll,
  defaultOpen = true,
}: {
  title: string;
  entries: MinimaConsoleCatalogEntry[];
  enabledKeys: Set<string>;
  onToggle: (key: string) => void;
  onSetAll: (enabled: boolean) => void;
  defaultOpen?: boolean;
}) {
  const checkedCount = entries.filter((entry) => enabledKeys.has(entry.key)).length;
  const allChecked = entries.length > 0 && checkedCount === entries.length;
  const someChecked = checkedCount > 0 && !allChecked;

  return (
    <WhitelistSection title={title} defaultOpen={defaultOpen}>
      <div className="border-stroke-secondary border-t">
        <div className="border-stroke-secondary bg-surface-primary px-pad-close border-b">
          <WhitelistCheckRow
            label="Select all"
            detail={
              <p className="type-body-em text-text-primary m-0">
                {checkedCount} of {entries.length} enabled
              </p>
            }
            checked={allChecked}
            indeterminate={someChecked}
            disabled={entries.length === 0}
            onChange={() => onSetAll(!allChecked)}
          />
        </div>
        <div className="divide-stroke-secondary bg-surface-always-white px-pad-close divide-y">
          {entries.map((entry) => (
            <CommandRow
              key={entry.key}
              entry={entry}
              checked={enabledKeys.has(entry.key)}
              onToggle={() => onToggle(entry.key)}
            />
          ))}
        </div>
      </div>
    </WhitelistSection>
  );
}

export function MinimaConsoleWhitelistModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const [catalog, setCatalog] = useState<MinimaConsoleCatalogEntry[] | null>(null);
  const [enabledKeys, setEnabledKeys] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getConsoleWhitelist()
      .then((whitelist) => {
        if (cancelled) return;
        setCatalog(whitelist.catalog);
        setEnabledKeys(new Set(whitelist.enabledKeys));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load console whitelist");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleKey(key: string) {
    setEnabledKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function setKeysEnabled(keys: string[], enabled: boolean) {
    setEnabledKeys((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (enabled) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  function openConfirm() {
    setCurrentPassword("");
    setSaveError(null);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    if (saving) return;
    setConfirmOpen(false);
    setCurrentPassword("");
    setSaveError(null);
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (currentPassword.length === 0 || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const whitelist = await updateConsoleWhitelist([...enabledKeys], currentPassword);
      setCatalog(whitelist.catalog);
      setEnabledKeys(new Set(whitelist.enabledKeys));
      setConfirmOpen(false);
      setCurrentPassword("");
      showToast({
        tone: "success",
        title: "Whitelist updated",
        message: "Console command permissions were saved.",
        timeoutMs: 6000,
      });
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to update console whitelist");
    } finally {
      setSaving(false);
    }
  }

  const readEntries =
    catalog
      ?.filter((entry) => entry.kind === "read")
      .sort((a, b) => a.verb.localeCompare(b.verb)) ?? [];
  const writeEntries =
    catalog
      ?.filter((entry) => entry.kind === "write")
      .sort((a, b) => a.verb.localeCompare(b.verb)) ?? [];

  return (
    <>
      <Modal
        title="Console command whitelist"
        description="Only enabled commands can run in the RPC console. Write commands can change node state — enable them with care."
        onClose={onClose}
        closeDisabled={saving || confirmOpen}
        footer={
          catalog ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={saving || confirmOpen}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button type="button" disabled={saving || confirmOpen} onClick={openConfirm}>
                Save whitelist
              </Button>
            </>
          ) : null
        }
      >
        {loadError && <ErrorText>{loadError}</ErrorText>}
        {!catalog && !loadError && <LoadingDots />}
        {catalog && (
          <div className="gap-detail-next grid">
            <CommandSection
              title="Read"
              entries={readEntries}
              enabledKeys={enabledKeys}
              onToggle={toggleKey}
              onSetAll={(enabled) =>
                setKeysEnabled(
                  readEntries.map((entry) => entry.key),
                  enabled,
                )
              }
              defaultOpen={false}
            />
            <CommandSection
              title="Write"
              entries={writeEntries}
              enabledKeys={enabledKeys}
              onToggle={toggleKey}
              onSetAll={(enabled) =>
                setKeysEnabled(
                  writeEntries.map((entry) => entry.key),
                  enabled,
                )
              }
              defaultOpen
            />
          </div>
        )}
      </Modal>

      {confirmOpen ? (
        <Modal
          title="Confirm whitelist changes"
          description="Enter your PIN or password to save console command permissions."
          onClose={closeConfirm}
          closeDisabled={saving}
          className="!max-w-[420px]"
          bodyClassName="min-h-0 flex-1"
          footer={
            <>
              <Button type="button" variant="secondary" disabled={saving} onClick={closeConfirm}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="minima-console-whitelist-confirm"
                disabled={saving || currentPassword.length === 0}
              >
                {saving ? "Saving…" : "Confirm"}
              </Button>
            </>
          }
        >
          <form
            id="minima-console-whitelist-confirm"
            onSubmit={(e) => void handleConfirm(e)}
            className="gap-detail-close grid"
          >
            <InputField
              label="Enter your PIN or password"
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setSaveError(null);
              }}
              placeholder="Your current credential"
              autoComplete="current-password"
              autoFocus
              error={saveError}
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}
