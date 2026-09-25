import { Check } from "lucide-react";
import { useState } from "react";
import { BRAND_GRADIENT } from "../../app/brand";
import { BrandLockup } from "../../components/patterns/BrandLockup";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { tourSteps, type TourStep } from "./tourSteps";

export function GuidedTourModal({
  onClose,
  steps = tourSteps,
}: {
  onClose: () => void;
  steps?: TourStep[];
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const Icon = step.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  return (
    <Modal
      title={step.title}
      description={
        <ProgressBar
          current={stepIndex + 1}
          total={steps.length}
          progressLabel="Tour progress"
          showBack={false}
        />
      }
      onClose={onClose}
      closeOnOutsideClick={false}
      bodyScrollable={false}
      bodyClassName="gap-detail-near flex min-h-0 flex-col"
      footer={
        <>
          <Button variant="ghost" className="mr-auto" onClick={onClose}>
            Skip tour
          </Button>
          {!isFirst ? (
            <Button variant="secondary" onClick={() => setStepIndex(stepIndex - 1)}>
              Back
            </Button>
          ) : null}
          <Button onClick={isLast ? onClose : () => setStepIndex(stepIndex + 1)}>
            {isLast ? "Finish" : "Next"}
          </Button>
        </>
      }
    >
      <div className="border-stroke-secondary bg-surface-primary rounded-soft aspect-[3/1] w-full overflow-hidden border">
        {step.brand ? (
          <div
            className="flex h-full items-center justify-center"
            style={{ background: BRAND_GRADIENT }}
          >
            <BrandLockup tone="on-dark" size={40} />
          </div>
        ) : step.image ? (
          <img
            src={step.image}
            alt={step.imageAlt ?? ""}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="gap-detail-next flex h-full flex-col items-center justify-center">
            <Icon aria-hidden className="text-text-disabled size-10" />
            <p className="type-meta text-text-disabled m-0">Screenshot coming soon</p>
          </div>
        )}
      </div>
      <div className="gap-detail-next flex flex-col">
        <p className="type-callout text-text-primary m-0">{step.lead}</p>
        <ul className="gap-detail-close m-0 flex list-none flex-col p-0">
          {step.points.map((point) => (
            <li
              key={point}
              className="gap-detail-close type-body text-text-primary flex items-start"
            >
              <Check aria-hidden className="text-text-accent size-4 shrink-0" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
