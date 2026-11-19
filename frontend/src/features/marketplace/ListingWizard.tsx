import { useState, type FormEvent } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { InputField } from "../../components/ui/InputField";
import { RadioField } from "../../components/ui/RadioField";
import { SelectField } from "../../components/ui/SelectField";
import { TextareaField } from "../../components/ui/TextareaField";
import { ErrorText } from "../../components/ui/ErrorText";
import type { ApiError } from "../../lib/api";
import {
  CATEGORIES,
  createListing,
  FORMATS,
  LICENCES,
  PRODUCT_TYPES,
  type ListingDraft,
  type PublisherSource,
} from "./marketplaceApi";

const EMPTY: ListingDraft = {
  sourceId: "",
  type: "file",
  title: "",
  category: "",
  description: "",
  format: "",
  licence: "",
  licenceText: "",
  price: "",
  availability: "",
};

/**
 * Creates a draft listing on the marketplace from one of the seller's own sources. The sources come from the
 * marketplace's publisher API, so only this seller's sources are offered; the payout wallet is not part of it.
 */
export function ListingWizard({
  sources,
  onClose,
  onCreated,
}: {
  sources: PublisherSource[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [draft, setDraft] = useState<ListingDraft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const set = (field: keyof ListingDraft) => (value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createListing(draft);
      onCreated();
    } catch (failure) {
      const apiError = failure as ApiError;
      const field = (apiError.details?.context as { field?: string } | undefined)?.field;
      setError({ message: apiError.message, field });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New listing"
      description="Saved as a draft on the marketplace. Publish it from your listings when it is ready."
      onClose={onClose}
      closeDisabled={saving}
      footer={
        <Button type="submit" form="marketplace-listing-wizard" disabled={saving}>
          {saving ? "Saving…" : "Save draft"}
        </Button>
      }
    >
      <form id="marketplace-listing-wizard" className="gap-detail-close grid" onSubmit={submit}>
        <fieldset className="gap-detail-next m-0 grid border-0 p-0">
          <legend className="type-body-em text-text-primary mb-detail-next">Product type</legend>
          {PRODUCT_TYPES.map((option) => (
            <RadioField
              key={option.value}
              name="listing-type"
              label={option.label}
              description={option.value === "file" ? "One-off purchase, seller-hosted download" : "Monthly subscription, seller-hosted stream"}
              checked={draft.type === option.value}
              onChange={() => set("type")(option.value)}
            />
          ))}
        </fieldset>
        <SelectField
          label="Source"
          required
          value={draft.sourceId}
          placeholder="Choose a source"
          options={sources.map((source) => ({
            value: source.id,
            label: source.selectable ? source.name : `${source.name} (${source.reason ?? "not available"})`,
            disabled: !source.selectable,
          }))}
          error={fieldError("sourceId")}
          onChange={(event) => set("sourceId")(event.target.value)}
        />
        <InputField label="Title" required maxLength={120} value={draft.title} error={fieldError("title")} onChange={(event) => set("title")(event.target.value)} />
        <SelectField
          label="Category"
          required
          value={draft.category}
          placeholder="Choose a category"
          options={CATEGORIES.map((category) => ({ value: category, label: category }))}
          error={fieldError("category")}
          onChange={(event) => set("category")(event.target.value)}
        />
        <TextareaField
          label="Description"
          description="Markdown, up to 5,000 characters."
          required
          maxLength={5000}
          value={draft.description}
          error={fieldError("description")}
          onChange={(event) => set("description")(event.target.value)}
        />
        <SelectField
          label="Format"
          required
          value={draft.format}
          placeholder="Choose a format"
          options={FORMATS.map((format) => ({ value: format, label: format }))}
          error={fieldError("format")}
          onChange={(event) => set("format")(event.target.value)}
        />
        <SelectField
          label="Licence"
          required
          value={draft.licence}
          placeholder="Choose a licence"
          options={LICENCES}
          error={fieldError("licence")}
          onChange={(event) => set("licence")(event.target.value)}
        />
        {draft.licence === "Custom" && (
          <TextareaField
            label="Licence text"
            description="Shown to buyers in full before they accept it. Up to 5,000 characters."
            required
            maxLength={5000}
            value={draft.licenceText}
            error={fieldError("licenceText")}
            onChange={(event) => set("licenceText")(event.target.value)}
          />
        )}
        <InputField
          label={draft.type === "stream" ? "Price per month (USD)" : "Price (USD)"}
          description="0 for free, or 5.00 to 1,000.00."
          required
          inputMode="decimal"
          value={draft.price}
          error={fieldError("price")}
          onChange={(event) => set("price")(event.target.value)}
        />
        <InputField
          label="Availability"
          description="What you commit to, for example the period covered or update frequency."
          required
          value={draft.availability}
          error={fieldError("availability")}
          onChange={(event) => set("availability")(event.target.value)}
        />
        {error && !error.field ? <ErrorText>{error.message}</ErrorText> : null}
      </form>
    </Modal>
  );
}
