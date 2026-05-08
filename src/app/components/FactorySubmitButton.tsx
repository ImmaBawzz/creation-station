"use client";

import { useFormStatus } from "react-dom";

type FactorySubmitButtonProps = {
  className: string;
  idleText: string;
  pendingText: string;
};

export function FactorySubmitButton({
  className,
  idleText,
  pendingText,
}: FactorySubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={pending} type="submit">
      {pending ? pendingText : idleText}
    </button>
  );
}