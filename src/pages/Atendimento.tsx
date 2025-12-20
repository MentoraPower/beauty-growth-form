import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import WhatsAppIcon from "@/components/icons/WhatsApp";
import InstagramIcon from "@/components/icons/Instagram";
import WhatsApp from "./WhatsApp";
import InstagramPage from "./Instagram";

type TabType = 'whatsapp' | 'instagram';

export default function Atendimento() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabType>(
    tabParam === 'instagram' ? 'instagram' : 'whatsapp'
  );

  // Sync URL with tab changes
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Tabs Header */}
      <div className="flex-shrink-0 bg-card border-b border-border px-6 pt-4">
        <div className="flex gap-1">
          <button
            onClick={() => handleTabChange('whatsapp')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-all duration-200 text-sm font-medium",
              activeTab === 'whatsapp'
                ? "bg-[#25D366]/10 text-[#25D366] border-b-2 border-[#25D366]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <WhatsAppIcon className="h-4 w-4" />
            <span>WhatsApp</span>
          </button>
          
          <button
            onClick={() => handleTabChange('instagram')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-all duration-200 text-sm font-medium",
              activeTab === 'instagram'
                ? "bg-gradient-to-r from-[#833AB4]/10 via-[#FD1D1D]/10 to-[#F77737]/10 text-[#E1306C] border-b-2 border-[#E1306C]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <InstagramIcon className="h-4 w-4" />
            <span>Instagram</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'whatsapp' ? (
          <WhatsApp />
        ) : (
          <InstagramPage />
        )}
      </div>
    </div>
  );
}
