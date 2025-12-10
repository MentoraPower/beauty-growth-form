import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Mail, Send, Settings, Eye, Edit, Plus, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface SentEmail {
  id: string;
  lead_id: string | null;
  lead_name: string;
  lead_email: string;
  subject: string;
  body_html: string;
  status: string;
  resend_id: string | null;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
}

interface EmailSettings {
  id: string;
  delay_minutes: number;
  from_name: string;
  from_email: string;
}

const Emails = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", subject: "", body_html: "" });
  const [settingsForm, setSettingsForm] = useState({ delay_minutes: 0, from_name: "", from_email: "" });

  const initializeDefaultData = async () => {
    // Check if default template exists
    const { data: existingTemplates } = await supabase
      .from("email_templates")
      .select("id")
      .limit(1);

    if (!existingTemplates || existingTemplates.length === 0) {
      // Insert default template
      await supabase.from("email_templates").insert({
        name: "Boas-vindas",
        subject: "Seu cadastro foi realizado com sucesso",
        body_html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background: linear-gradient(135deg, #CC3A33 0%, #A10000 100%); border-radius: 24px; overflow: hidden;">
          <tr>
            <td style="padding: 48px 40px 40px 40px;">
              <!-- Logo/Brand -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <span style="font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: 4px; text-transform: uppercase;">SCALE</span>
                  </td>
                </tr>
              </table>
              
              <!-- Main Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(255,255,255,0.95); border-radius: 16px; overflow: hidden;">
                <tr>
                  <td style="padding: 40px 32px;">
                    <!-- Success Icon -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 24px;">
                          <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #CC3A33 0%, #A10000 100%); border-radius: 50%; display: inline-block; line-height: 64px; text-align: center;">
                            <span style="color: #ffffff; font-size: 28px;">&#10003;</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Title -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 16px;">
                          <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1a1a1a;">Cadastro realizado</h1>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Greeting -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 24px;">
                          <p style="margin: 0; font-size: 18px; color: #CC3A33; font-weight: 600;">Olá, {{name}}</p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Message -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 32px;">
                          <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #4a4a4a; text-align: center;">
                            Nosso time vai entrar em contato com você nas próximas 24 horas.
                          </p>
                          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #4a4a4a; text-align: center;">
                            A Scale é o seu próximo passo para escalar o seu negócio no mundo da beleza.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Divider -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom: 24px;">
                          <div style="height: 1px; background: linear-gradient(90deg, transparent, #e0e0e0, transparent);"></div>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Info Cards -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #fafafa; border-radius: 12px;">
                            <tr>
                              <td style="padding: 20px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td width="40" valign="top">
                                      <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #CC3A33 0%, #A10000 100%); border-radius: 8px; text-align: center; line-height: 32px;">
                                        <span style="color: #ffffff; font-size: 14px;">&#9993;</span>
                                      </div>
                                    </td>
                                    <td style="padding-left: 12px;">
                                      <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: #1a1a1a;">Fique atento</p>
                                      <p style="margin: 0; font-size: 12px; color: #666666;">Verifique seu WhatsApp e e-mail</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Footer -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-top: 32px;">
                    <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.8);">Scale Beauty</p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: rgba(255,255,255,0.6);">Assessoria de marketing por Emile Bitetti</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        is_default: true,
      });
    }

    // Check if settings exist
    const { data: existingSettings } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .single();

    if (!existingSettings) {
      // Insert default settings
      await supabase.from("email_settings").insert({
        delay_minutes: 0,
        from_name: "Scale Beauty",
        from_email: "contato@scalebeauty.com.br",
      });
    } else if (existingSettings.from_email === "onboarding@resend.dev") {
      // Update to verified domain
      await supabase
        .from("email_settings")
        .update({ from_email: "contato@scalebeauty.com.br" })
        .eq("id", existingSettings.id);
    }
  };

  useEffect(() => {
    initializeDefaultData().then(() => fetchData());
    
    const sentEmailsChannel = supabase
      .channel("sent-emails-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "sent_emails" }, () => {
        fetchSentEmails();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sentEmailsChannel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchTemplates(), fetchSentEmails(), fetchSettings()]);
    setLoading(false);
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching templates:", error);
      return;
    }
    setTemplates(data || []);
  };

  const fetchSentEmails = async () => {
    const { data, error } = await supabase
      .from("sent_emails")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching sent emails:", error);
      return;
    }
    setSentEmails(data || []);
  };

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .single();
    
    if (error && error.code !== "PGRST116") {
      console.error("Error fetching settings:", error);
      return;
    }
    
    if (data) {
      setSettings(data);
      setSettingsForm({
        delay_minutes: data.delay_minutes,
        from_name: data.from_name,
        from_email: data.from_email,
      });
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    const { error } = await supabase
      .from("email_templates")
      .update({
        name: editForm.name,
        subject: editForm.subject,
        body_html: editForm.body_html,
      })
      .eq("id", selectedTemplate.id);

    if (error) {
      toast.error("Erro ao salvar template");
      return;
    }

    toast.success("Template salvo com sucesso");
    setIsEditing(false);
    fetchTemplates();
  };

  const handleCreateTemplate = async () => {
    const { error } = await supabase
      .from("email_templates")
      .insert({
        name: "Novo Template",
        subject: "Assunto do E-mail",
        body_html: "<p>Conteúdo do e-mail</p>",
        is_default: false,
      });

    if (error) {
      toast.error("Erro ao criar template");
      return;
    }

    toast.success("Template criado com sucesso");
    fetchTemplates();
  };

  const handleSaveSettings = async () => {
    if (!settings) {
      const { error } = await supabase
        .from("email_settings")
        .insert(settingsForm);
      
      if (error) {
        toast.error("Erro ao salvar configurações");
        return;
      }
    } else {
      const { error } = await supabase
        .from("email_settings")
        .update(settingsForm)
        .eq("id", settings.id);
      
      if (error) {
        toast.error("Erro ao salvar configurações");
        return;
      }
    }

    toast.success("Configurações salvas com sucesso");
    fetchSettings();
  };

  const handleSetDefault = async (templateId: string) => {
    // Remove default from all templates
    await supabase
      .from("email_templates")
      .update({ is_default: false })
      .neq("id", templateId);

    // Set new default
    const { error } = await supabase
      .from("email_templates")
      .update({ is_default: true })
      .eq("id", templateId);

    if (error) {
      toast.error("Erro ao definir template padrão");
      return;
    }

    toast.success("Template padrão definido");
    fetchTemplates();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "sent":
        return "Enviado";
      case "failed":
        return "Falhou";
      default:
        return "Pendente";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">E-mails</h1>
            <p className="text-muted-foreground text-sm">Gerencie templates e visualize e-mails enviados</p>
          </div>
        </div>

        <Tabs defaultValue="templates" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="sent" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Enviados
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-6">
            <div className="flex justify-end mb-4">
              <Button onClick={handleCreateTemplate} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Template
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="relative">
                  {template.is_default && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500/10 text-emerald-600 text-xs rounded-full">
                      Padrão
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <p className="text-sm text-muted-foreground truncate">{template.subject}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => setSelectedTemplate(template)}
                          >
                            <Eye className="h-3 w-3" />
                            Ver
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{template.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">Assunto</label>
                              <p className="text-muted-foreground">{template.subject}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Preview</label>
                              <div
                                className="mt-2 p-4 border rounded-lg bg-white"
                                dangerouslySetInnerHTML={{ __html: template.body_html }}
                              />
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setSelectedTemplate(template);
                              setEditForm({
                                name: template.name,
                                subject: template.subject,
                                body_html: template.body_html,
                              });
                              setIsEditing(true);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                            Editar
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Editar Template</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">Nome</label>
                              <Input
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Assunto</label>
                              <Input
                                value={editForm.subject}
                                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Conteúdo HTML</label>
                              <p className="text-xs text-muted-foreground mb-2">
                                Use {"{{name}}"} para inserir o nome do lead
                              </p>
                              <Textarea
                                value={editForm.body_html}
                                onChange={(e) => setEditForm({ ...editForm, body_html: e.target.value })}
                                className="min-h-[300px] font-mono text-sm"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setIsEditing(false)}>
                                Cancelar
                              </Button>
                              <Button onClick={handleSaveTemplate}>
                                Salvar
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {!template.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(template.id)}
                        >
                          Definir como padrão
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sent" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">E-mails Enviados</CardTitle>
              </CardHeader>
              <CardContent>
                {sentEmails.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum e-mail enviado ainda
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sentEmails.map((email) => (
                      <Dialog key={email.id}>
                        <DialogTrigger asChild>
                          <div
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => setSelectedEmail(email)}
                          >
                            <div className="flex items-center gap-3">
                              {getStatusIcon(email.status)}
                              <div>
                                <p className="font-medium">{email.lead_name}</p>
                                <p className="text-sm text-muted-foreground">{email.lead_email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm">{getStatusLabel(email.status)}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(email.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Detalhes do E-mail</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium">Destinatário</label>
                                <p className="text-muted-foreground">{email.lead_name}</p>
                                <p className="text-sm text-muted-foreground">{email.lead_email}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium">Status</label>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(email.status)}
                                  <span>{getStatusLabel(email.status)}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Assunto</label>
                              <p className="text-muted-foreground">{email.subject}</p>
                            </div>
                            {email.error_message && (
                              <div>
                                <label className="text-sm font-medium text-red-500">Erro</label>
                                <p className="text-red-500">{email.error_message}</p>
                              </div>
                            )}
                            <div>
                              <label className="text-sm font-medium">Conteúdo</label>
                              <div
                                className="mt-2 p-4 border rounded-lg bg-white"
                                dangerouslySetInnerHTML={{ __html: email.body_html }}
                              />
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Configurações de E-mail</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Delay após cadastro (minutos)</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Tempo de espera antes de enviar o e-mail após o cadastro
                  </p>
                  <Input
                    type="number"
                    min="0"
                    value={settingsForm.delay_minutes}
                    onChange={(e) => setSettingsForm({ ...settingsForm, delay_minutes: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Nome do remetente</label>
                  <Input
                    value={settingsForm.from_name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, from_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">E-mail do remetente</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Precisa ser um domínio verificado no Resend
                  </p>
                  <Input
                    type="email"
                    value={settingsForm.from_email}
                    onChange={(e) => setSettingsForm({ ...settingsForm, from_email: e.target.value })}
                  />
                </div>
                <div className="pt-4">
                  <Button onClick={handleSaveSettings}>
                    Salvar Configurações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Emails;
