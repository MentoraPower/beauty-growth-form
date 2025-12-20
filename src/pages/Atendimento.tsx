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
  const activeTab: TabType = tabParam === 'instagram' ? 'instagram' : 'whatsapp';

  const handleTabChange = (tab: TabType) => {
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Tabs Header */}
      <div className="flex-shrink-0 bg-card border-b border-border px-6 pt-4">
        <div className="flex gap-1">
          <button
            onClick={() => handleTabChange('whatsapp')}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 transition-all duration-200 text-sm font-medium",
              activeTab === 'whatsapp'
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <WhatsAppIcon className="h-4 w-4" />
            <span>WhatsApp</span>
            {activeTab === 'whatsapp' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#F40000] to-[#A10000]" />
            )}
          </button>
          
          <button
            onClick={() => handleTabChange('instagram')}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 transition-all duration-200 text-sm font-medium",
              activeTab === 'instagram'
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <InstagramIcon className="h-4 w-4" />
            <span>Instagram</span>
            {activeTab === 'instagram' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#F40000] to-[#A10000]" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden p-6">
        {activeTab === 'whatsapp' ? (
          <WhatsApp />
        ) : (
          <InstagramPage />
        )}
      </div>
    </div>
  );
}
