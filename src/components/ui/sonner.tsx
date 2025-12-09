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
      gap={12}
      toastOptions={{
        duration: 3000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white/80 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-neutral-900 group-[.toaster]:border group-[.toaster]:border-neutral-200/50 group-[.toaster]:shadow-[0_8px_32px_rgba(0,0,0,0.12)] group-[.toaster]:rounded-2xl group-[.toaster]:px-5 group-[.toaster]:py-4 group-[.toaster]:font-medium group-[.toaster]:text-sm group-[.toaster]:tracking-tight",
          description: "group-[.toast]:text-neutral-500 group-[.toast]:text-xs",
          actionButton: "group-[.toast]:bg-neutral-900 group-[.toast]:text-white group-[.toast]:rounded-lg group-[.toast]:text-xs group-[.toast]:font-semibold",
          cancelButton: "group-[.toast]:bg-neutral-100 group-[.toast]:text-neutral-600 group-[.toast]:rounded-lg group-[.toast]:text-xs",
          error: "group-[.toaster]:bg-red-50/90 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-red-600 group-[.toaster]:border-red-200/50",
          success: "group-[.toaster]:bg-green-50/90 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-green-600 group-[.toaster]:border-green-200/50",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
