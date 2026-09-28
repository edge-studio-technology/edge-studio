import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { BRAND_GRADIENT } from "../../app/brand";
import { BrandLockup } from "../../components/patterns/BrandLockup";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { cx } from "../../lib/cx";
import { tourSteps, type TourImage, type TourStep } from "./tourSteps";

const TOUR_IMAGE_INTERVAL_MS = 4000;

function TourImages({ images }: { images: TourImage[] }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = setInterval(
      () => setShown((index) => (index + 1) % images.length),
      TOUR_IMAGE_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [images.length]);

  return (
    <div className="relative h-full">
      {images.map((image, index) => (
        <img
          key={image.src}
          src={image.src}
          alt={image.alt}
          aria-hidden={index !== shown}
          className={cx(
            "absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700 motion-reduce:transition-none",
            index === shown ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
    </div>
  );
}

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
      <div className="border-surface-accent bg-surface-primary rounded-soft aspect-[3/1] w-full overflow-hidden border">
        {step.brand ? (
          <div
            className="flex h-full items-center justify-center"
            style={{ background: BRAND_GRADIENT }}
          >
            <BrandLockup tone="on-dark" size={40} />
          </div>
        ) : step.images?.length ? (
          <TourImages key={step.id} images={step.images} />
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
