"use client";

import * as React from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, BellRing, CalendarPlus, Mic } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch, Empty } from "@/components/ui/misc";
import { BottomSheet } from "@/components/ui/sheet";
import { ClientGate } from "@/components/client-gate";
import { VoiceSheet } from "@/components/voice-sheet";
import { usePlannerStore } from "@/stores/planner";
import { requestNotificationPermission } from "@/lib/notifications";
import { parseTodoLocal, type ParsedTodo } from "@/lib/todo-parser";
import { speechSupported } from "@/hooks/use-speech";
import { cn, todayStr, vibrate } from "@/lib/utils";
import type { Todo } from "@/lib/types";

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function CalendarView({
  selected,
  onSelect,
  markedDates,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  markedDates: Set<string>;
}) {
  const [cursor, setCursor] = React.useState(startOfMonth(selected));
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
  });
  const today = new Date();

  return (
    <Card>
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <button
            aria-label="上个月"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted active:scale-90"
            onClick={() => setCursor((c) => addMonths(c, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">{format(cursor, "yyyy年M月")}</span>
          <button
            aria-label="下个月"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted active:scale-90"
            onClick={() => setCursor((c) => addMonths(c, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
          {WEEK_LABELS.map((w) => (
            <span key={w} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = todayStr(d);
            const isSel = isSameDay(d, selected);
            const isToday = isSameDay(d, today);
            const inMonth = isSameMonth(d, cursor);
            return (
              <button
                key={key}
                onClick={() => onSelect(d)}
                className="flex h-11 flex-col items-center justify-center"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-[13px] transition-colors",
                    isSel
                      ? "bg-primary font-semibold text-primary-foreground"
                      : isToday
                        ? "font-semibold text-primary"
                        : inMonth
                          ? "text-foreground"
                          : "text-muted-foreground/40"
                  )}
                >
                  {d.getDate()}
                </span>
                <span
                  className={cn(
                    "h-1 w-1 rounded-full",
                    markedDates.has(key) && !isSel ? "bg-primary/70" : "bg-transparent"
                  )}
                />
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** 待办行：左滑露出操作 / 点复选框完成（划掉动画） */
function TodoRow({ todo }: { todo: Todo }) {
  const { toggleTodo, removeTodo } = usePlannerStore();
  const [offset, setOffset] = React.useState(0);
  const [swiping, setSwiping] = React.useState(false);
  const startX = React.useRef(0);
  const startOffset = React.useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startOffset.current = offset;
    setSwiping(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current + startOffset.current;
    setOffset(Math.min(0, Math.max(-136, dx)));
  };
  const onTouchEnd = () => {
    setSwiping(false);
    setOffset((o) => (o < -60 ? -136 : 0));
  };

  const done = todo.done;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* 底部操作层 */}
      <div className="absolute inset-y-0 right-0 flex w-[136px]">
        <button
          className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-success text-[11px] text-success-foreground"
          onClick={() => {
            vibrate(20);
            toggleTodo(todo.id);
            setOffset(0);
          }}
        >
          <Check className="h-4 w-4" />
          {done ? "撤销" : "完成"}
        </button>
        <button
          className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-destructive text-[11px] text-destructive-foreground"
          onClick={() => {
            vibrate([20, 30, 20]);
            removeTodo(todo.id);
          }}
        >
          <Trash2 className="h-4 w-4" />
          删除
        </button>
      </div>
      {/* 内容层 */}
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-xl border bg-card p-3.5",
          !swiping && "transition-transform duration-200"
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <button
          aria-label={done ? "标记未完成" : "标记完成"}
          onClick={() => {
            vibrate(15);
            toggleTodo(todo.id);
          }}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
            done ? "border-success bg-success text-success-foreground" : "border-muted-foreground/40"
          )}
        >
          {done && <Check className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "strike-wrap truncate text-[15px] transition-colors",
              done && "striked text-muted-foreground"
            )}
          >
            {todo.title}
          </p>
          {todo.time && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              {todo.remind && <BellRing className="h-3 w-3 text-primary" />}
              {todo.time}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlannerPage() {
  const [selected, setSelected] = React.useState(() => new Date());
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [time, setTime] = React.useState("");
  const [remind, setRemind] = React.useState(false);
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const [parsing, setParsing] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState("");
  const todos = usePlannerStore((s) => s.todos);
  const addTodo = usePlannerStore((s) => s.addTodo);
  const speechOK = React.useMemo(() => speechSupported(), []);

  const applyParsed = (p: ParsedTodo) => {
    const [y, m, d] = p.date.split("-").map(Number);
    setSelected(new Date(y, m - 1, d));
    setTitle(p.title);
    setTime(p.time ?? "");
    setRemind(p.remind);
    setVoiceOpen(false);
    setSheetOpen(true);
    vibrate(20);
  };

  const handleVoice = async (text: string) => {
    setParsing(true);
    setVoiceError("");
    try {
      const res = await fetch("/api/ai/parse-todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await res.json();
      if (data.parsed) {
        applyParsed(data.parsed);
        return;
      }
      throw new Error("empty");
    } catch {
      const local = parseTodoLocal(text);
      if (local) applyParsed(local);
      else setVoiceError("没听懂，试试「明天下午三点提醒我给妈妈打电话」");
    } finally {
      setParsing(false);
    }
  };

  const selKey = todayStr(selected);
  const dayTodos = todos
    .filter((t) => t.date === selKey)
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.time ?? "99").localeCompare(b.time ?? "99"));
  const marked = new Set(todos.filter((t) => !t.done).map((t) => t.date));

  const submit = async () => {
    if (!title.trim()) return;
    if (remind && time) await requestNotificationPermission();
    addTodo({ title, date: selKey, time: time || undefined, remind });
    setTitle("");
    setTime("");
    setRemind(false);
    setSheetOpen(false);
    vibrate(20);
  };

  return (
    <div className="space-y-4 p-4">
      <ClientGate>
        <CalendarView selected={selected} onSelect={setSelected} markedDates={marked} />

        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {format(selected, "M月d日")} · {dayTodos.length ? `${dayTodos.filter((t) => t.done).length}/${dayTodos.length} 已完成` : "暂无待办"}
          </h2>
          <div className="flex gap-2">
            {speechOK && (
              <Button size="sm" variant="secondary" onClick={() => setVoiceOpen(true)} aria-label="语音添加">
                <Mic className="h-4 w-4" /> 语音
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setSheetOpen(true)}>
              <Plus className="h-4 w-4" /> 添加
            </Button>
          </div>
        </div>

        {dayTodos.length === 0 ? (
          <button className="w-full" onClick={() => setSheetOpen(true)}>
            <Empty
              icon={<CalendarPlus className="h-10 w-10" />}
              title="这一天还没有安排"
              hint="点击空白处添加待办"
            />
          </button>
        ) : (
          <div className="space-y-2.5">
            {dayTodos.map((t) => (
              <TodoRow key={t.id} todo={t} />
            ))}
            <button
              onClick={() => setSheetOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-3.5 text-sm text-muted-foreground active:bg-muted"
            >
              <Plus className="h-4 w-4" /> 继续添加
            </button>
          </div>
        )}

        <VoiceSheet
          open={voiceOpen}
          onClose={() => setVoiceOpen(false)}
          title="语音添加待办"
          hint="点击开始，说「明天下午三点提醒我给妈妈打电话」"
          parsing={parsing}
          externalError={voiceError}
          onConfirm={(t) => void handleVoice(t)}
        />

        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={`添加待办 · ${format(selected, "M月d日")}`}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="todo-title">要做什么？</Label>
              <Input
                id="todo-title"
                autoFocus
                placeholder="如：给朋友准备生日礼物"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submit()}
              />
            </div>
            <div>
              <Label htmlFor="todo-time">提醒时间（可选）</Label>
              <Input id="todo-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted p-3.5">
              <div>
                <p className="text-sm font-medium">到点提醒</p>
                <p className="text-xs text-muted-foreground">通过系统通知推送（需授权）</p>
              </div>
              <Switch checked={remind} onChange={setRemind} disabled={!time} />
            </div>
            <Button className="w-full" size="lg" onClick={() => void submit()} disabled={!title.trim()}>
              保存
            </Button>
          </div>
        </BottomSheet>
      </ClientGate>
    </div>
  );
}
