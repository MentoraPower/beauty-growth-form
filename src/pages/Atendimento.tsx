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
    <div className="h-[calc(100vh-4rem)] flex flex-col -mr-6 -mb-6 border-l border-border">
      {/* Tabs Header */}
      <div className="flex-shrink-0 border-b border-border px-4 pt-2 pb-0 bg-background">
        <div className="flex gap-1">
          <button
            onClick={() => handleTabChange('whatsapp')}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 transition-all duration-200 text-sm font-medium rounded-t-lg",
              activeTab === 'whatsapp'
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <WhatsAppIcon className="h-4 w-4" />
            <span>WhatsApp</span>
            {activeTab === 'whatsapp' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#25D366]" />
            )}
          </button>
          
          <button
            onClick={() => handleTabChange('instagram')}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 transition-all duration-200 text-sm font-medium rounded-t-lg",
              activeTab === 'instagram'
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <InstagramIcon className="h-4 w-4" />
            <span>Instagram</span>
            {activeTab === 'instagram' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#E1306C] to-[#F77737]" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Content - Full height and width */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'whatsapp' ? (
          <WhatsApp />
        ) : (
          <InstagramPage />
        )}
      </div>
    </div>
  );
}
