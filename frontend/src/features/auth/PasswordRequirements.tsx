import { Check } from "lucide-react";
import { cx } from "../../lib/cx";
import { getAdminPasswordRequirements } from "./adminCredentials";

export function PasswordRequirements({ password }: { password: string }) {
  const requirements = getAdminPasswordRequirements(password);

  return (
    <div
      className="bg-surface-primary border-stroke-secondary rounded-soft p-margin-close w-full border"
      aria-label="Password requirements"
    >
      <div className="gap-detail-next px-detail-next py-margin-close flex flex-col">
        <p className="type-meta text-text-primary m-0">Password requirements</p>
        <ul className="gap-detail-next m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 sm:gap-x-detail-near">
          {requirements.map((requirement) => (
            <li
              key={requirement.id}
              className="gap-detail-next flex min-w-[120px] items-center"
              aria-label={`${requirement.label}: ${requirement.met ? "met" : "not met"}`}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "rounded-loose flex size-4 shrink-0 items-center justify-center overflow-clip",
                  requirement.met
                    ? "bg-icon-success"
                    : "border-stroke-primary bg-icon-inverse border",
                )}
              >
                {requirement.met ? (
                  <Check className="text-icon-inverse size-4" strokeWidth={2} />
                ) : null}
              </span>
              <span className="type-body text-text-primary min-w-0 flex-1">{requirement.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
