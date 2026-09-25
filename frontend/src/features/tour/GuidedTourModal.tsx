import { useState } from "react";
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
      <div className="border-stroke-secondary bg-surface-primary rounded-soft aspect-video w-full overflow-hidden border">
        {step.image ? (
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
      <p className="type-body text-text-primary m-0 min-h-[2lh]">{step.body}</p>
    </Modal>
  );
}
