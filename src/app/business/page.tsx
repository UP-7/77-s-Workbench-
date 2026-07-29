"use client";

import * as React from "react";
import {
  Plus,
  Package,
  ScanLine,
  Trash2,
  Wrench,
  BarChart3,
  Store,
  CircleDollarSign,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Segmented, Badge, Empty } from "@/components/ui/misc";
import { BottomSheet, ConfirmDialog } from "@/components/ui/sheet";
import { ClientGate } from "@/components/client-gate";
import { useBusinessStore, profitTrend, bestSellers } from "@/stores/business";
import { cn, fmtMoney, vibrate } from "@/lib/utils";
import { GOURD_STATUS_LABEL, type Gourd, type GourdStatus } from "@/lib/types";

const STATUS_TONE: Record<GourdStatus, string> = {
  in_stock: "bg-success/12 text-success",
  reserved: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  sold: "bg-muted text-muted-foreground",
};

const VARIETIES = ["美国八宝", "本长手捻", "苹果肚", "蚂蚁肚", "异形", "大葫芦", "其他"];

/* ---------------- 扫码定位（BarcodeDetector，可降级为输入编号） ---------------- */
function ScanSheet({
  open,
  onClose,
  onFound,
}: {
  open: boolean;
  onClose: () => void;
  onFound: (code: string) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [supported, setSupported] = React.useState(false);
  const [manual, setManual] = React.useState("");
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const hasDetector = typeof window !== "undefined" && "BarcodeDetector" in window;
    setSupported(hasDetector);
    setErr("");

    if (hasDetector) {
      void (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detector = new (window as any).BarcodeDetector({
            formats: ["qr_code", "code_128", "ean_13"],
          });
          timer = setInterval(async () => {
            if (!videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0) {
                vibrate(40);
                onFound(String(codes[0].rawValue));
              }
            } catch {
              /* 单帧失败忽略 */
            }
          }, 600);
        } catch {
          setErr("无法打开摄像头，可手动输入编号");
        }
      })();
    }
    return () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onFound]);

  return (
    <BottomSheet open={open} onClose={onClose} title="扫码定位葫芦">
      {supported && !err ? (
        <div className="overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <p className="p-2 text-center text-[11px] text-white/60">对准贴在葫芦上的编号二维码 / 条码</p>
        </div>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">
          {err || "当前浏览器不支持扫码，输入编号同样可以快速定位。"}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Input placeholder="输入编号，如 HL-0001" value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} />
        <Button disabled={!manual.trim()} onClick={() => onFound(manual.trim())}>
          定位
        </Button>
      </div>
    </BottomSheet>
  );
}

/* ---------------- 库存 ---------------- */
function StockTab() {
  const { gourds, cycleStatus, markSold, removeGourd, addGourd } = useBusinessStore();
  const [addOpen, setAddOpen] = React.useState(false);
  const [scanOpen, setScanOpen] = React.useState(false);
  const [sellTarget, setSellTarget] = React.useState<Gourd | null>(null);
  const [salePrice, setSalePrice] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<Gourd | null>(null);
  const [highlight, setHighlight] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [variety, setVariety] = React.useState(VARIETIES[0]);
  const [cost, setCost] = React.useState("");
  const [shipping, setShipping] = React.useState("");

  const handleStatusTap = (g: Gourd) => {
    vibrate(15);
    if (g.status === "reserved") {
      // 预定 → 已售：需要录入售价
      setSellTarget(g);
      setSalePrice(g.salePrice ? String(g.salePrice) : "");
    } else {
      cycleStatus(g.id);
    }
  };

  const onScanFound = (code: string) => {
    setScanOpen(false);
    const hit = gourds.find((g) => g.code.toUpperCase() === code.toUpperCase());
    if (hit) {
      setHighlight(hit.id);
      document.getElementById(`gourd-${hit.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlight(null), 2600);
    }
  };

  const submitAdd = () => {
    if (!name.trim() || !cost) return;
    addGourd({
      name,
      variety,
      costPrice: Number(cost) || 0,
      shippingCost: Number(shipping) || 0,
    });
    vibrate(20);
    setAddOpen(false);
    setName(""); setCost(""); setShipping("");
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> 进货入库
        </Button>
        <Button variant="secondary" onClick={() => setScanOpen(true)}>
          <ScanLine className="h-4 w-4" /> 扫码
        </Button>
      </div>

      {gourds.length === 0 ? (
        <Empty icon={<Package className="h-10 w-10" />} title="仓库还是空的" hint="点击进货入库，登记第一只葫芦" />
      ) : (
        gourds.map((g) => {
          const cost = g.costPrice + g.shippingCost;
          const profit = g.status === "sold" && g.salePrice ? g.salePrice - cost : null;
          return (
            <Card
              key={g.id}
              id={`gourd-${g.id}`}
              className={cn("transition-all", highlight === g.id && "ring-2 ring-primary")}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{g.code}</span>
                    {g.reservedBy && <span className="text-[10px] text-amber-600">留给 {g.reservedBy}</span>}
                  </div>
                  <p className="truncate text-[15px] font-semibold">{g.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {g.variety} · 成本 {fmtMoney(cost)}
                    {g.status === "sold" && g.salePrice != null && (
                      <>
                        {" "}· 售 {fmtMoney(g.salePrice)}
                        <span className={cn("ml-1 font-medium", (profit ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                          {(profit ?? 0) >= 0 ? "赚" : "亏"} {fmtMoney(Math.abs(profit ?? 0))}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <button onClick={() => handleStatusTap(g)} aria-label="切换状态" className="active:scale-90">
                  <Badge className={cn("h-8 px-3 text-xs", STATUS_TONE[g.status])}>
                    {GOURD_STATUS_LABEL[g.status]} →
                  </Badge>
                </button>
                <button
                  aria-label="删除"
                  onClick={() => setDeleteTarget(g)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40 active:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* 进货表单 */}
      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="进货入库">
        <div className="space-y-4">
          <div>
            <Label htmlFor="g-name">名称</Label>
            <Input id="g-name" placeholder="如：八宝葫芦 4.5cm" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>品种</Label>
            <div className="flex flex-wrap gap-2">
              {VARIETIES.map((v) => (
                <button
                  key={v}
                  onClick={() => setVariety(v)}
                  className={cn(
                    "h-9 rounded-full border px-4 text-sm",
                    variety === v ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="g-cost">进货价 ¥</Label>
              <Input id="g-cost" type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="g-ship">快递费 ¥</Label>
              <Input id="g-ship" type="number" inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} />
            </div>
          </div>
          <Button className="w-full" size="lg" onClick={submitAdd} disabled={!name.trim() || !cost}>
            入库（自动生成编号）
          </Button>
        </div>
      </BottomSheet>

      {/* 售出登记 */}
      <BottomSheet open={Boolean(sellTarget)} onClose={() => setSellTarget(null)} title={`售出 · ${sellTarget?.name ?? ""}`}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="sale-price">成交价 ¥</Label>
            <Input
              id="sale-price"
              type="number"
              inputMode="decimal"
              className="h-14 text-2xl font-bold"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              autoFocus
            />
          </div>
          {sellTarget && salePrice && (
            <p className="text-center text-sm text-muted-foreground">
              成本 {fmtMoney(sellTarget.costPrice + sellTarget.shippingCost)} · 预计
              <span className="mx-1 font-semibold text-success">
                {fmtMoney(Number(salePrice) - sellTarget.costPrice - sellTarget.shippingCost)}
              </span>
              利润
            </p>
          )}
          <Button
            className="w-full"
            size="lg"
            disabled={!salePrice || Number(salePrice) <= 0}
            onClick={() => {
              if (sellTarget) {
                markSold(sellTarget.id, Number(salePrice));
                vibrate([30, 40, 30]);
              }
              setSellTarget(null);
            }}
          >
            确认售出
          </Button>
        </div>
      </BottomSheet>

      <ScanSheet open={scanOpen} onClose={() => setScanOpen(false)} onFound={onScanFound} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`删除 ${deleteTarget?.name}？`}
        description="删除后无法恢复。"
        confirmText="删除"
        danger
        onConfirm={() => deleteTarget && removeGourd(deleteTarget.id)}
      />
    </div>
  );
}

/* ---------------- 账目（经营支出） ---------------- */
function ExpenseTab() {
  const { expenses, addExpense, removeExpense, gourds } = useBusinessStore();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [kind, setKind] = React.useState<"tool" | "shipping" | "other">("tool");

  const sold = gourds.filter((g) => g.status === "sold");

  return (
    <div className="space-y-4">
      <Button className="w-full" onClick={() => setOpen(true)}>
        <Wrench className="h-4 w-4" /> 记一笔经营支出（工具/损耗）
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">经营支出</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {expenses.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">暂无支出记录</p>
          ) : (
            expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3.5">
                <Badge className="bg-muted text-muted-foreground shrink-0">
                  {e.kind === "tool" ? "工具" : e.kind === "shipping" ? "快递" : "其他"}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{e.name}</p>
                  <p className="text-[10px] text-muted-foreground">{e.date}</p>
                </div>
                <span className="font-semibold tabular-nums">-{fmtMoney(e.amount)}</span>
                <button
                  aria-label="删除"
                  onClick={() => removeExpense(e.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40 active:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">销售流水（{sold.length}）</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {sold.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">还没有售出记录</p>
          ) : (
            sold.map((g) => (
              <div key={g.id} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{g.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {g.soldAt} · 成本 {fmtMoney(g.costPrice + g.shippingCost)}
                  </p>
                </div>
                <span className="font-semibold tabular-nums text-success">+{fmtMoney(g.salePrice ?? 0)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="经营支出">
        <div className="space-y-4">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { label: "工具损耗", value: "tool" },
              { label: "快递", value: "shipping" },
              { label: "其他", value: "other" },
            ]}
          />
          <div>
            <Label htmlFor="be-name">名目</Label>
            <Input id="be-name" placeholder="如：电烙铁" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="be-amount">金额 ¥</Label>
            <Input id="be-amount" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={!name.trim() || !amount}
            onClick={() => {
              addExpense({ name, amount: Number(amount), kind });
              vibrate(20);
              setOpen(false);
              setName("");
              setAmount("");
            }}
          >
            保存
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

/* ---------------- 仪表盘 ---------------- */
function DashboardTab() {
  const { gourds, expenses } = useBusinessStore();
  const trend = profitTrend(gourds, expenses, 6);
  const sellers = bestSellers(gourds);

  const totalRevenue = gourds.reduce((s, g) => s + (g.status === "sold" ? g.salePrice ?? 0 : 0), 0);
  const totalCost =
    gourds.reduce((s, g) => s + (g.status === "sold" ? g.costPrice + g.shippingCost : 0), 0) +
    expenses.reduce((s, e) => s + e.amount, 0);
  const totalProfit = totalRevenue - totalCost;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "总收入", value: totalRevenue, tone: "text-foreground" },
          { label: "总成本", value: totalCost, tone: "text-muted-foreground" },
          { label: "净利润", value: totalProfit, tone: totalProfit >= 0 ? "text-success" : "text-destructive" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className={cn("mt-1 text-sm font-bold tabular-nums", s.tone)}>{fmtMoney(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <BarChart3 className="h-4 w-4 text-primary" /> 月度利润趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [fmtMoney(v), "利润"]}
                />
                <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
                  {trend.map((t) => (
                    <Cell key={t.month} fill={t.profit >= 0 ? "hsl(27 55% 45%)" : "hsl(4 66% 55%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <CircleDollarSign className="h-4 w-4 text-primary" /> 最畅销品种
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sellers.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">出货后这里会给出畅销榜</p>
          ) : (
            <div className="space-y-2.5">
              {sellers.slice(0, 5).map((s, i) => (
                <div key={s.variety} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm">{s.variety}</span>
                  <span className="text-xs text-muted-foreground">{s.count} 只</span>
                  <span className="text-sm font-semibold tabular-nums">{fmtMoney(s.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BusinessPage() {
  const [tab, setTab] = React.useState<"stock" | "ledger" | "board">("stock");
  const gourds = useBusinessStore((s) => s.gourds);
  const inStock = gourds.filter((g) => g.status === "in_stock").length;

  return (
    <div className="space-y-4 p-4">
      <ClientGate>
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Store className="h-3.5 w-3.5" />
          在库 {inStock} · 预定 {gourds.filter((g) => g.status === "reserved").length} · 已售{" "}
          {gourds.filter((g) => g.status === "sold").length}
        </div>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { label: "库存", value: "stock" },
            { label: "账目", value: "ledger" },
            { label: "仪表盘", value: "board" },
          ]}
        />
        {tab === "stock" && <StockTab />}
        {tab === "ledger" && <ExpenseTab />}
        {tab === "board" && <DashboardTab />}
      </ClientGate>
    </div>
  );
}
