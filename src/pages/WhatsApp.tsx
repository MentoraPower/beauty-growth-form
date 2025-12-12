import DashboardLayout from "@/components/dashboard/DashboardLayout";

const WhatsApp = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">WhatsApp</h1>
        
        <div className="bg-card border border-border/50 rounded-2xl p-8">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">Em breve</p>
            <p className="text-sm mt-1">Integração com WhatsApp será disponibilizada aqui.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WhatsApp;
