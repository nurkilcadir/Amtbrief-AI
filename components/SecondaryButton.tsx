type SecondaryButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  type?: "button" | "submit";
};

export function SecondaryButton({
  children,
  onClick,
  disabled,
  icon,
  type = "button",
}: SecondaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[15px] font-semibold text-slate-800 shadow-soft transition active:scale-[0.99] disabled:cursor-not-allowed disabled:text-slate-400"
    >
      {icon}
      {children}
    </button>
  );
}
