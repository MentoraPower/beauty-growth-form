import { useState, useEffect, useRef } from "react";
import { Users, RefreshCw, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Participant {
  id: string;
  phone: string;
  jid: string;
  name?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  photoUrl?: string | null;
}

interface GroupParticipantsPanelProps {
  groupJid: string;
  groupName: string;
  groupPhoto?: string | null;
  participantCount: number;
  apiKey: string;
  onSelectParticipant?: (phone: string, name?: string) => void;
}

const DEFAULT_AVATAR =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMTIgMjEyIj48cGF0aCBmaWxsPSIjREZFNUU3IiBkPSJNMCAwaDIxMnYyMTJIMHoiLz48cGF0aCBmaWxsPSIjRkZGIiBkPSJNMTA2IDEwNmMtMjUuNCAwLTQ2LTIwLjYtNDYtNDZzMjAuNi00NiA0Ni00NiA0NiAyMC42IDQ2IDQ2LTIwLjYgNDYtNDYgNDZ6bTAgMTNjMzAuNiAwIDkyIDE1LjQgOTIgNDZ2MjNIMTR2LTIzYzAtMzAuNiA2MS40LTQ2IDkyLTQ2eiIvPjwvc3ZnPg==";

const RATE_LIMIT_DELAY_MS = 350; // Delay between API calls to respect rate limits
const BATCH_SIZE = 10; // Process in batches

const getInitials = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const formatPhone = (phone: string): string => {
  const clean = phone.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
  if (clean.length === 13 && clean.startsWith("55")) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12 && clean.startsWith("55")) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  return phone.replace(/@s\.whatsapp\.net$/, "");
};

export const GroupParticipantsPanel = ({
  groupJid,
  groupName,
  groupPhoto,
  participantCount,
  apiKey,
  onSelectParticipant,
}: GroupParticipantsPanelProps) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingAllPhotos, setIsLoadingAllPhotos] = useState(false);
  const [photoLoadProgress, setPhotoLoadProgress] = useState({ current: 0, total: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchParticipants = async () => {
    if (!apiKey || !groupJid) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("[GroupParticipantsPanel] Fetching participants", {
        groupJid,
        apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : "",
      });

      const response = await fetch(
        `https://www.wasenderapi.com/api/groups/${encodeURIComponent(groupJid)}/metadata`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 429) {
        setError("Limite da WaSender atingido. Tente novamente em alguns segundos.");
        return;
      }

      if (response.status === 401 || response.status === 403) {
        setError("Sessão WaSender inválida/expirada. Selecione a conta novamente.");
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const result = await response.json();
      console.log("[GroupParticipantsPanel] Metadata:", result);

      const rawParticipants = result?.data?.participants;
      if (result?.success && Array.isArray(rawParticipants)) {
        const participantsList: Participant[] = rawParticipants.map((p: any) => ({
          id: p.id || p.jid || "",
          jid: p.jid || p.id || "",
          phone: p.pn || p.jid?.replace(/@s\.whatsapp\.net$/, "") || "",
          name: p.name || p.notify || undefined,
          isAdmin: p.isAdmin || p.admin === "admin",
          isSuperAdmin: p.isSuperAdmin || p.admin === "superadmin",
          photoUrl: null,
        }));

        setParticipants(participantsList);
        // Auto-start loading all profile pictures
        autoLoadAllPhotos(participantsList);
      } else {
        setParticipants([]);
        setError("Participantes não disponíveis para este grupo.");
      }
    } catch (err: any) {
      console.error("[GroupParticipantsPanel] Error:", err);
      setError("Erro ao carregar participantes");
    } finally {
      setIsLoading(false);
    }
  };

  const autoLoadAllPhotos = async (participantsList: Participant[]) => {
    const toFetch = participantsList.filter((p) => p.jid);
    if (toFetch.length === 0) return;

    // Abort any previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoadingAllPhotos(true);
    setPhotoLoadProgress({ current: 0, total: toFetch.length });

    let processed = 0;
    let rateLimitHits = 0;

    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      if (signal.aborted) break;

      const batch = toFetch.slice(i, i + BATCH_SIZE);

      for (const participant of batch) {
        if (signal.aborted) break;

        try {
          const picResponse = await fetch(
            `https://www.wasenderapi.com/api/contacts/${encodeURIComponent(participant.jid)}/picture`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              signal,
            }
          );

          if (picResponse.status === 429) {
            rateLimitHits++;
            console.log("[GroupParticipantsPanel] Rate limited, waiting longer...");
            await new Promise((resolve) => setTimeout(resolve, 2000));
            if (rateLimitHits >= 3) {
              console.log("[GroupParticipantsPanel] Too many rate limits, stopping");
              break;
            }
            continue;
          }

          rateLimitHits = 0;

          if (picResponse.ok) {
            const picResult = await picResponse.json();
            const imgUrl = picResult?.data?.imgUrl || picResult?.imgUrl || null;

            if (imgUrl) {
              setParticipants((prev) =>
                prev.map((p) => (p.id === participant.id ? { ...p, photoUrl: imgUrl } : p))
              );
            }
          }
        } catch (e: any) {
          if (e.name === "AbortError") break;
          console.error("[GroupParticipantsPanel] Error fetching picture:", e);
        }

        processed++;
        setPhotoLoadProgress({ current: processed, total: toFetch.length });
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }

      if (!signal.aborted && i + BATCH_SIZE < toFetch.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    setIsLoadingAllPhotos(false);
    setPhotoLoadProgress({ current: 0, total: 0 });
  };

  const cancelPhotoLoading = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoadingAllPhotos(false);
    setPhotoLoadProgress({ current: 0, total: 0 });
  };

  useEffect(() => {
    fetchParticipants();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [groupJid, apiKey]);

  return (
    <div className="w-[340px] border-l border-border bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 dark:bg-muted/30 px-4 py-4">
        <div className="flex items-center gap-3">
          {groupPhoto ? (
            <img
              src={groupPhoto}
              alt={groupName}
              className="w-12 h-12 rounded-full object-cover bg-muted"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_AVATAR;
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-medium">
              {getInitials(groupName)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate">{groupName}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              {participantCount > 0
                ? `${participantCount} participantes`
                : `${participants.length || "—"} participantes`}
            </p>
          </div>
        </div>
      </div>

      {/* Participants List Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <span className="text-sm font-medium text-foreground">Participantes</span>
        <div className="flex items-center gap-1">
          {/* Progress indicator during photo loading */}
          {isLoadingAllPhotos && (
            <button
              onClick={cancelPhotoLoading}
              className="flex items-center gap-1.5 px-2 py-1 text-xs bg-muted rounded-md hover:bg-muted/80 transition-colors"
              title="Clique para cancelar"
            >
              <RefreshCw className="w-3 h-3 text-primary animate-spin" />
              <span className="text-muted-foreground">
                {photoLoadProgress.current}/{photoLoadProgress.total}
              </span>
            </button>
          )}
          
          {/* Refresh button */}
          <button
            onClick={fetchParticipants}
            disabled={isLoading || isLoadingAllPhotos}
            className="p-1.5 hover:bg-muted rounded-md transition-colors disabled:opacity-50"
            title="Atualizar participantes"
          >
            <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading && participants.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-8 px-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={fetchParticipants} className="mt-2 text-xs text-primary hover:underline">
              Tentar novamente
            </button>
          </div>
        ) : participants.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Nenhum participante encontrado</div>
        ) : (
          <div className="divide-y divide-border/30">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onSelectParticipant?.(participant.phone, participant.name)}
              >
                {/* Avatar with photo support */}
                {participant.photoUrl ? (
                  <img
                    src={participant.photoUrl}
                    alt={participant.name || participant.phone}
                    className="w-10 h-10 rounded-full object-cover bg-muted flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground flex-shrink-0",
                    participant.photoUrl && "hidden"
                  )}
                >
                  {participant.name ? getInitials(participant.name) : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {participant.name || formatPhone(participant.phone)}
                    </span>
                    {(participant.isAdmin || participant.isSuperAdmin) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium">
                        {participant.isSuperAdmin ? "Dono" : "Admin"}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate block">{formatPhone(participant.phone)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default GroupParticipantsPanel;

