import DashboardLayout from "@/components/dashboard/DashboardLayout";
import WhatsAppIcon from "@/components/icons/WhatsApp";

const WhatsApp = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <WhatsAppIcon className="h-8 w-8 text-emerald-500" />
          <h1 className="text-2xl font-semibold text-foreground">WhatsApp</h1>
        </div>
        
        <div className="bg-card border border-border/50 rounded-2xl p-8">
          <div className="text-center text-muted-foreground">
            <WhatsAppIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium">Em breve</p>
            <p className="text-sm mt-1">Integração com WhatsApp será disponibilizada aqui.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WhatsApp;
