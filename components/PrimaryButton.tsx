import Link from "next/link";
import { ArrowRight } from "lucide-react";

type PrimaryButtonProps = {
  href?: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  type?: "button" | "submit";
};

export function PrimaryButton({
  href,
  children,
  onClick,
  disabled,
  icon,
  type = "button",
}: PrimaryButtonProps) {
  const className =
    "touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl bg-civic-600 px-5 py-3 text-[15px] font-semibold text-white shadow-action transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none";

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
        {icon ?? <ArrowRight className="h-5 w-5" />}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
      {icon ?? <ArrowRight className="h-5 w-5" />}
    </button>
  );
}
