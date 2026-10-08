import type { InputHTMLAttributes, ReactNode } from "react";
import { ADMIN_PIN_LENGTH, type AdminCredentialType } from "../../features/auth/adminCredentials";
import { InputField } from "./InputField";
import { PinField } from "./PinField";

type CredentialFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type" | "size" | "autoComplete"
> & {
  credentialType: AdminCredentialType | null;
  value: string;
  onChange: (nextValue: string) => void;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  autoComplete?: "current-password" | "new-password";
};

export function CredentialField({
  credentialType,
  value,
  onChange,
  autoComplete = "current-password",
  ...props
}: CredentialFieldProps) {
  return credentialType === "pin" ? (
    <PinField
      {...props}
      mode="credential"
      length={ADMIN_PIN_LENGTH}
      autoComplete={autoComplete}
      value={value}
      onChange={onChange}
    />
  ) : (
    <InputField
      {...props}
      type="password"
      autoComplete={autoComplete}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
