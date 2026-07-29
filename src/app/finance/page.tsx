"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Mic, MicOff, Trash2, Wallet, TrendingDown, TrendingUp, Keyboard, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Segmented, Badge, Empty } from "@/components/ui/misc";
import { BottomSheet } from "@/components/ui/sheet";
import { ClientGate } from "@/components/client-gate";
import { useFinanceStore, monthTotals } from "@/stores/finance";
import { parseExpenseLocal } from "@/lib/expense-parser";
import { requestMediaPermission } from "@/lib/notifications";
import { cn, fmtMoney, monthStr, vibrate } from "@/lib/utils";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type ParsedExpense, type RecordType } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
function getSpeechRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return SR ? new SR() : null;
}

function VoiceSheet({
  open,
  onClose,
  onParsed,
}: {
  open: boolean;
  onClose: () => void;
  onParsed: (p: ParsedExpense, source: "voice" | "ai") => void;
}) {
  const [supported, setSupported] = React.useState(true);
  const [listening, setListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");
  const [parsing, setParsing] = React.useState(false);
  const [error, setError] = React.useState("");
  const recRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (!open) return;
    setTranscript("");
    setError("");
    const rec = getSpeechRecognition();
    if (!rec) {
      setSupported(false);
      return;
    }
    setSupported(true);
    recRef.current = rec;
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setTranscript(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error === "not-allowed") setError("麦克风权限被拒绝，请在设置中开启");
      else if (e.error !== "aborted") setError("识别出错了，再试一次");
    };
    return () => {
      try {
        rec.abort();
      } catch { /* noop */ }
    };
  }, [open]);

  const toggle = async () => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      return;
    }
    setError("");
    await requestMediaPermission("microphone");
    setTranscript("");
    try {
      rec.start();
      setListening(true);
      vibrate(20);
    } catch {
      setError("无法启动识别");
    }
  };

  const confirm = async () => {
    if (!transcript.trim() || parsing) return;
    setParsing(true);
    try {
      const res = await fetch("/api/ai/parse-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await res.json();
      if (data.parsed) {
        onParsed(data.parsed, data.source === "ai" ? "ai" : "voice");
        return;
      }
      throw new Error("empty");
    } catch {
      const local = parseExpenseLocal(transcript);
      if (local) {
        onParsed(local, "voice");
      } else {
        setError("没听清金额，试试「午饭花了25块」这样说");
      }
    } finally {
      setParsing(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="语音记账">
      {supported ? (
        <div className="flex flex-col items-center gap-4 py-2">
          <button
            onClick={() => void toggle()}
            className={cn(
              "flex h-24 w-24 items-center justify-center rounded-full transition-all active:scale-90",
              listening
                ? "bg-destructive text-destructive-foreground shadow-[0_0_0_12px_hsl(var(--destructive)/0.15)] animate-pulse-soft"
                : "bg-primary text-primary-foreground shadow-lg"
            )}
          >
            {listening ? <MicOff className="h-9 w-9" /> : <Mic className="h-9 w-9" />}
          </button>
          <p className="text-xs text-muted-foreground">
            {listening ? "正在聆听… 再点一下结束" : "点击开始，说「今天午饭花了25块」"}
          </p>
          <div className="min-h-[3rem] w-full rounded-xl bg-muted p-3.5 text-center text-[15px]">
            {transcript || <span className="text-muted-foreground/60">识别结果显示在这里</span>}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button className="w-full" size="lg" disabled={!transcript.trim() || parsing} onClick={() => void confirm()}>
            <Sparkles className="h-4 w-4" />
            {parsing ? "AI 解析中…" : "解析并记账"}
          </Button>
        </div>
      ) : (
        <div className="py-4 text-center">
          <p className="text-sm text-muted-foreground">
            当前浏览器不支持语音识别，
            <br />
            已为你切换到手动记账。
          </p>
        </div>
      )}
    </BottomSheet>
  );
}

function ManualSheet({
  open,
  onClose,
  prefill,
  source,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: ParsedExpense | null;
  source: "voice" | "manual" | "ai";
}) {
  const addRecord = useFinanceStore((s) => s.addRecord);
  const [type, setType] = React.useState<RecordType>("expense");
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState<string>(EXPENSE_CATEGORIES[0]);
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (open && prefill) {
      setType(prefill.type);
      setAmount(String(prefill.amount));
      setCategory(prefill.category);
      setNote(prefill.note);
    } else if (open) {
      setType("expense");
      setAmount("");
      setCategory(EXPENSE_CATEGORIES[0]);
      setNote("");
    }
  }, [open, prefill]);

  const cats = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const submit = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    addRecord({ type, amount: n, category, note: note.trim() || category, source });
    vibrate(25);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={prefill ? "确认记账" : "手动记账"}>
      <div className="space-y-4">
        {prefill && (
          <div className="flex items-center gap-1.5 rounded-xl bg-accent/10 p-3 text-xs text-accent">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            已自动解析，确认或修改后保存
          </div>
        )}
        <Segmented
          value={type}
          onChange={(v) => {
            setType(v);
            setCategory(v === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
          }}
          options={[
            { label: "支出", value: "expense" },
            { label: "收入", value: "income" },
          ]}
        />
        <div>
          <Label htmlFor="f-amount">金额 ¥</Label>
          <Input
            id="f-amount"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            className="text-2xl font-bold h-14"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <Label>类别</Label>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "h-9 rounded-full border px-4 text-sm transition-colors",
                  category === c ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="f-note">备注</Label>
          <Input id="f-note" placeholder="如：午饭" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button className="w-full" size="lg" onClick={submit} disabled={!amount || Number(amount) <= 0}>
          保存
        </Button>
      </div>
    </BottomSheet>
  );
}

function FinanceContent() {
  const searchParams = useSearchParams();
  const records = useFinanceStore((s) => s.records);
  const removeRecord = useFinanceStore((s) => s.removeRecord);
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [prefill, setPrefill] = React.useState<ParsedExpense | null>(null);
  const [prefillSource, setPrefillSource] = React.useState<"voice" | "manual" | "ai">("manual");
  const speechOK = React.useMemo(() => getSpeechRecognition() !== null, []);

  React.useEffect(() => {
    if (searchParams.get("voice") === "1") {
      if (getSpeechRecognition()) setVoiceOpen(true);
      else setManualOpen(true);
    }
  }, [searchParams]);

  const month = monthStr();
  const { expense, income } = monthTotals(records, month);

  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof records>();
    for (const r of records) {
      const arr = map.get(r.date) ?? [];
      arr.push(r);
      map.set(r.date, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [records]);

  return (
    <>
      {/* 月度汇总 */}
      <Card className="border-none bg-gradient-to-br from-primary to-primary/85 text-primary-foreground">
        <CardContent className="p-5">
          <p className="text-[11px] uppercase tracking-widest opacity-85">{month.replace("-", " 年 ")} 月</p>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="flex items-center gap-1 text-xs opacity-85">
                <TrendingDown className="h-3.5 w-3.5" /> 本月支出
              </p>
              <p className="text-3xl font-bold tabular-nums">{fmtMoney(expense)}</p>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-xs opacity-85">
                <TrendingUp className="h-3.5 w-3.5" /> 收入
              </p>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(income)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 记账入口 */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          className="h-14"
          onClick={() => (speechOK ? setVoiceOpen(true) : setManualOpen(true))}
        >
          <Mic className="h-5 w-5" /> 语音记账
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="h-14"
          onClick={() => {
            setPrefill(null);
            setPrefillSource("manual");
            setManualOpen(true);
          }}
        >
          <Keyboard className="h-5 w-5" /> 手动记账
        </Button>
      </div>
      {!speechOK && (
        <p className="text-center text-[11px] text-muted-foreground">当前环境不支持语音识别，已自动降级为手动记账</p>
      )}

      {/* 记录列表 */}
      {grouped.length === 0 ? (
        <Empty icon={<Wallet className="h-10 w-10" />} title="还没有账目" hint="试试对它说：今天午饭花了25块" />
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, list]) => (
            <div key={date}>
              <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">{date}</p>
              <Card>
                <CardContent className="divide-y p-0">
                  {list.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3.5">
                      <Badge
                        className={cn(
                          "shrink-0",
                          r.type === "expense" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                        )}
                      >
                        {r.category}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{r.note}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {r.source === "voice" ? "语音" : r.source === "ai" ? "AI 解析" : "手动"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          r.type === "expense" ? "text-foreground" : "text-success"
                        )}
                      >
                        {r.type === "expense" ? "-" : "+"}
                        {fmtMoney(r.amount)}
                      </span>
                      <button
                        aria-label="删除"
                        onClick={() => removeRecord(r.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/50 active:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      <VoiceSheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onParsed={(p, src) => {
          setVoiceOpen(false);
          setPrefill(p);
          setPrefillSource(src);
          setManualOpen(true);
        }}
      />
      <ManualSheet open={manualOpen} onClose={() => setManualOpen(false)} prefill={prefill} source={prefillSource} />
    </>
  );
}

export default function FinancePage() {
  return (
    <div className="space-y-4 p-4">
      <ClientGate>
        <React.Suspense fallback={null}>
          <FinanceContent />
        </React.Suspense>
      </ClientGate>
    </div>
  );
}
