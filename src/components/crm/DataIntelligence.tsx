import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Loader2, FileText, BarChart3, Table2, AlertCircle, CheckCircle2, Mail, User, Hash, Calendar, FileSpreadsheet } from "lucide-react";

// Types for Data Intelligence
export interface ColumnAnalysis {
  name: string;
  type: 'email' | 'name' | 'phone' | 'number' | 'date' | 'text' | 'unknown';
  validCount: number;
  totalCount: number;
  sampleValues: string[];
  issues?: string[];
}

export interface DataStats {
  totalRows: number;
  validEmails: number;
  invalidEmails: number;
  duplicateEmails: number;
  missingNames: number;
  completenessScore: number; // 0-100
}

export interface InsightStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  type: 'file' | 'columns' | 'stats' | 'quality' | 'recommendation';
  data?: {
    fileName?: string;
    fileSize?: string;
    columns?: ColumnAnalysis[];
    stats?: DataStats;
    recommendations?: string[];
    qualityIssues?: { type: 'error' | 'warning' | 'info'; message: string }[];
  };
}

interface DataIntelligenceProps {
  steps: InsightStep[];
  className?: string;
}

const typeIcons = {
  email: Mail,
  name: User,
  phone: Hash,
  number: Hash,
  date: Calendar,
  text: FileText,
  unknown: FileText,
};

const typeColors = {
  email: 'text-blue-500',
  name: 'text-green-500',
  phone: 'text-purple-500',
  number: 'text-orange-500',
  date: 'text-pink-500',
  text: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
};

function StepIcon({ status }: { status: InsightStep['status'] }) {
  if (status === 'completed') {
    return (
      <motion.div 
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        className="w-4 h-4 rounded-full bg-foreground/80 flex items-center justify-center flex-shrink-0"
      >
        <Check className="w-2.5 h-2.5 text-background" strokeWidth={3} />
      </motion.div>
    );
  }
  
  if (status === 'in_progress') {
    return (
      <div className="w-4 h-4 rounded-full border-2 border-foreground/40 bg-background flex items-center justify-center flex-shrink-0">
        <Loader2 className="w-2.5 h-2.5 text-foreground/60 animate-spin" />
      </div>
    );
  }
  
  return <div className="w-4 h-4 rounded-full border-2 border-foreground/20 bg-background flex-shrink-0" />;
}

function ColumnCard({ column }: { column: ColumnAnalysis }) {
  const Icon = typeIcons[column.type] || FileText;
  const colorClass = typeColors[column.type] || 'text-muted-foreground';
  const percentage = Math.round((column.validCount / column.totalCount) * 100);
  
  return (
    <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn("w-6 h-6 rounded flex items-center justify-center bg-background border border-foreground/10", colorClass)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{column.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{column.type}</p>
        </div>
        <div className="text-right">
          <p className={cn("text-sm font-medium", percentage === 100 ? "text-green-500" : percentage > 80 ? "text-foreground" : "text-amber-500")}>
            {percentage}%
          </p>
          <p className="text-xs text-muted-foreground">{column.validCount}/{column.totalCount}</p>
        </div>
      </div>
      
      {column.sampleValues.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {column.sampleValues.slice(0, 3).map((val, i) => (
            <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground truncate max-w-[100px]">
              {val || '(vazio)'}
            </span>
          ))}
        </div>
      )}
      
      {column.issues && column.issues.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-amber-500">
          <AlertCircle className="w-3 h-3" />
          {column.issues[0]}
        </div>
      )}
    </div>
  );
}

function StatsCard({ stats }: { stats: DataStats }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg p-3 text-center">
        <p className="text-2xl font-semibold text-foreground">{stats.totalRows}</p>
        <p className="text-xs text-muted-foreground">Total de linhas</p>
      </div>
      <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg p-3 text-center">
        <p className="text-2xl font-semibold text-green-500">{stats.validEmails}</p>
        <p className="text-xs text-muted-foreground">Emails válidos</p>
      </div>
      <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg p-3 text-center">
        <p className="text-2xl font-semibold text-amber-500">{stats.duplicateEmails}</p>
        <p className="text-xs text-muted-foreground">Duplicados</p>
      </div>
      <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg p-3 text-center">
        <p className="text-2xl font-semibold text-foreground">{stats.completenessScore}%</p>
        <p className="text-xs text-muted-foreground">Qualidade</p>
      </div>
    </div>
  );
}

function QualityIssuesList({ issues }: { issues: { type: 'error' | 'warning' | 'info'; message: string }[] }) {
  const iconMap = {
    error: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
    warning: <AlertCircle className="w-3.5 h-3.5 text-amber-500" />,
    info: <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />,
  };
  
  const bgMap = {
    error: 'bg-red-500/10 border-red-500/20',
    warning: 'bg-amber-500/10 border-amber-500/20',
    info: 'bg-blue-500/10 border-blue-500/20',
  };
  
  return (
    <div className="space-y-2">
      {issues.map((issue, i) => (
        <div key={i} className={cn("flex items-start gap-2 p-2.5 rounded-lg border", bgMap[issue.type])}>
          {iconMap[issue.type]}
          <p className="text-xs text-foreground">{issue.message}</p>
        </div>
      ))}
    </div>
  );
}

function FileInfoCard({ fileName, fileSize }: { fileName: string; fileSize?: string }) {
  return (
    <div className="bg-foreground/[0.03] border border-foreground/[0.06] rounded-lg p-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
        <FileSpreadsheet className="w-5 h-5 text-green-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
        {fileSize && <p className="text-xs text-muted-foreground">{fileSize}</p>}
      </div>
      <CheckCircle2 className="w-5 h-5 text-green-500" />
    </div>
  );
}

export function DataIntelligence({ steps, className }: DataIntelligenceProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(() => {
    // Auto-expand completed steps with data
    return new Set(steps.filter(s => s.status === 'completed' && s.data).map(s => s.id));
  });

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  if (steps.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("rounded-xl overflow-hidden", className)}
    >
      <div className="space-y-0 relative">
        <AnimatePresence initial={false}>
          {steps.map((step, index) => {
            const isExpanded = expandedSteps.has(step.id);
            const hasData = !!step.data;
            const isLast = index === steps.length - 1;
            
            return (
              <motion.div 
                key={step.id} 
                className="relative"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: index * 0.1 }}
              >
                {/* Vertical line connecting steps */}
                {!isLast && (
                  <div className="absolute left-[7px] top-[24px] h-[calc(100%-8px)] w-0 border-l border-dashed border-foreground/15" />
                )}
                
                {/* Step header */}
                <button
                  onClick={() => hasData && toggleStep(step.id)}
                  className={cn(
                    "w-full py-2.5 flex items-start gap-3 text-left transition-colors relative z-10",
                    hasData && "hover:opacity-80 cursor-pointer",
                    !hasData && "cursor-default"
                  )}
                >
                  <StepIcon status={step.status} />
                  
                  <div className="flex-1 min-w-0 pt-px">
                    <span className={cn(
                      "text-sm block",
                      step.status === 'completed' && "text-foreground font-medium",
                      step.status === 'in_progress' && "text-foreground font-medium",
                      step.status === 'pending' && "text-muted-foreground"
                    )}>
                      {step.title}
                    </span>
                    {step.description && (
                      <span className="text-xs text-muted-foreground/70 italic block mt-0.5">
                        {step.description}
                      </span>
                    )}
                  </div>
                  
                  {hasData && (
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform duration-200 mt-0.5",
                      isExpanded && "rotate-180"
                    )} />
                  )}
                </button>
                
                {/* Expandable content */}
                <AnimatePresence>
                  {hasData && isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pb-4 pl-7 pr-1 space-y-3">
                        {/* File info */}
                        {step.data?.fileName && (
                          <FileInfoCard fileName={step.data.fileName} fileSize={step.data.fileSize} />
                        )}
                        
                        {/* Columns analysis */}
                        {step.data?.columns && step.data.columns.length > 0 && (
                          <div className="space-y-2">
                            {step.data.columns.map((col, i) => (
                              <ColumnCard key={i} column={col} />
                            ))}
                          </div>
                        )}
                        
                        {/* Stats */}
                        {step.data?.stats && (
                          <StatsCard stats={step.data.stats} />
                        )}
                        
                        {/* Quality issues */}
                        {step.data?.qualityIssues && step.data.qualityIssues.length > 0 && (
                          <QualityIssuesList issues={step.data.qualityIssues} />
                        )}
                        
                        {/* Recommendations */}
                        {step.data?.recommendations && step.data.recommendations.length > 0 && (
                          <div className="space-y-2">
                            {step.data.recommendations.map((rec, i) => (
                              <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5" />
                                <p className="text-xs text-foreground">{rec}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Helper to create CSV analysis steps with rich data
export function createCsvAnalysisSteps(
  csvData: {
    fileName: string;
    headers: string[];
    rawData: Array<Record<string, string>>;
    mappedColumns: Record<string, string>;
  }
): InsightStep[] {
  const { fileName, headers, rawData, mappedColumns } = csvData;
  const totalRows = rawData.length;
  
  // Analyze columns
  const columnAnalyses: ColumnAnalysis[] = headers.map(header => {
    const values = rawData.map(row => row[header] || '');
    const nonEmptyValues = values.filter(v => v.trim() !== '');
    
    // Detect type
    let type: ColumnAnalysis['type'] = 'text';
    const sampleNonEmpty = nonEmptyValues.slice(0, 10);
    
    if (header.toLowerCase().includes('email') || mappedColumns.email === header) {
      type = 'email';
    } else if (header.toLowerCase().includes('nome') || header.toLowerCase().includes('name') || mappedColumns.name === header) {
      type = 'name';
    } else if (header.toLowerCase().includes('telefone') || header.toLowerCase().includes('phone') || header.toLowerCase().includes('whatsapp')) {
      type = 'phone';
    } else if (sampleNonEmpty.every(v => !isNaN(Number(v)))) {
      type = 'number';
    } else if (sampleNonEmpty.some(v => /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(v))) {
      type = 'date';
    }
    
    // Count valid values based on type
    let validCount = nonEmptyValues.length;
    const issues: string[] = [];
    
    if (type === 'email') {
      const validEmails = nonEmptyValues.filter(v => v.includes('@') && v.includes('.'));
      validCount = validEmails.length;
      if (validCount < nonEmptyValues.length) {
        issues.push(`${nonEmptyValues.length - validCount} emails inválidos`);
      }
    }
    
    if (nonEmptyValues.length < totalRows * 0.5) {
      issues.push(`${totalRows - nonEmptyValues.length} valores vazios`);
    }
    
    return {
      name: header,
      type,
      validCount,
      totalCount: totalRows,
      sampleValues: sampleNonEmpty.slice(0, 3),
      issues: issues.length > 0 ? issues : undefined,
    };
  });
  
  // Calculate stats
  const emailColumn = columnAnalyses.find(c => c.type === 'email');
  const nameColumn = columnAnalyses.find(c => c.type === 'name');
  
  const validEmails = emailColumn ? emailColumn.validCount : 0;
  const emailValues = emailColumn 
    ? rawData.map(row => row[emailColumn.name]?.toLowerCase().trim()).filter(e => e?.includes('@'))
    : [];
  const uniqueEmails = new Set(emailValues);
  const duplicateEmails = emailValues.length - uniqueEmails.size;
  
  const missingNames = nameColumn ? totalRows - nameColumn.validCount : totalRows;
  
  const completenessFactors = [
    emailColumn ? emailColumn.validCount / totalRows : 0,
    nameColumn ? nameColumn.validCount / totalRows : 0,
  ];
  const completenessScore = Math.round(
    (completenessFactors.reduce((a, b) => a + b, 0) / completenessFactors.length) * 100
  );
  
  const stats: DataStats = {
    totalRows,
    validEmails,
    invalidEmails: emailColumn ? totalRows - validEmails : 0,
    duplicateEmails,
    missingNames,
    completenessScore,
  };
  
  // Generate quality issues
  const qualityIssues: { type: 'error' | 'warning' | 'info'; message: string }[] = [];
  
  if (!emailColumn) {
    qualityIssues.push({ type: 'error', message: 'Nenhuma coluna de email identificada' });
  } else if (stats.invalidEmails > 0) {
    qualityIssues.push({ type: 'warning', message: `${stats.invalidEmails} emails com formato inválido serão ignorados` });
  }
  
  if (duplicateEmails > 0) {
    qualityIssues.push({ type: 'warning', message: `${duplicateEmails} emails duplicados encontrados` });
  }
  
  if (!nameColumn) {
    qualityIssues.push({ type: 'info', message: 'Coluna de nome não identificada - personalização limitada' });
  }
  
  if (completenessScore >= 80) {
    qualityIssues.push({ type: 'info', message: `Lista com ${completenessScore}% de qualidade - ótima para disparo` });
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (validEmails > 0 && completenessScore >= 60) {
    recommendations.push(`${validEmails} leads prontos para disparo`);
  }
  
  if (nameColumn && nameColumn.validCount > totalRows * 0.8) {
    recommendations.push('Personalização com nome disponível');
  }
  
  // Build steps
  return [
    {
      id: 'file_read',
      title: 'Leitura do arquivo',
      description: 'Reading and parsing CSV file',
      status: 'completed',
      type: 'file',
      data: {
        fileName,
        fileSize: `${totalRows} linhas • ${headers.length} colunas`,
      }
    },
    {
      id: 'column_analysis',
      title: 'Análise das colunas',
      description: 'Identifying column types and data quality',
      status: 'completed',
      type: 'columns',
      data: {
        columns: columnAnalyses,
      }
    },
    {
      id: 'stats_summary',
      title: 'Resumo estatístico',
      description: 'Calculating totals and metrics',
      status: 'completed',
      type: 'stats',
      data: {
        stats,
      }
    },
    {
      id: 'quality_check',
      title: 'Verificação de qualidade',
      description: 'Checking data integrity and issues',
      status: 'completed',
      type: 'quality',
      data: {
        qualityIssues,
        recommendations,
      }
    },
  ];
}
