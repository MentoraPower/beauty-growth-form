import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      gap={8}
      offset={20}
      toastOptions={{
        duration: 2500,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-black group-[.toaster]:text-white group-[.toaster]:border-none group-[.toaster]:shadow-[0_4px_24px_rgba(0,0,0,0.25)] group-[.toaster]:rounded-xl group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:font-medium group-[.toaster]:text-[13px] group-[.toaster]:tracking-normal group-[.toaster]:min-h-0",
          description: "group-[.toast]:text-white/60 group-[.toast]:text-xs",
          actionButton: "group-[.toast]:bg-white group-[.toast]:text-black group-[.toast]:rounded-md group-[.toast]:text-xs group-[.toast]:font-semibold group-[.toast]:px-3 group-[.toast]:py-1.5",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white group-[.toast]:rounded-md group-[.toast]:text-xs",
          error: "group-[.toaster]:bg-[#1a1a1a] group-[.toaster]:text-[#ff6b6b] group-[.toaster]:border-l-2 group-[.toaster]:border-l-[#ff6b6b]",
          success: "group-[.toaster]:bg-[#1a1a1a] group-[.toaster]:text-[#4ade80] group-[.toaster]:border-l-2 group-[.toaster]:border-l-[#4ade80]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
