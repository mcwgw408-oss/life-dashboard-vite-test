import {
  ArrowLeft,
  Beef,
  BookOpen,
  CalendarDays,
  Check,
  Clipboard,
  ClipboardCheck,
  Coffee,
  Crown,
  Dumbbell,
  HeartPulse,
  Home,
  ListChecks,
  Milk,
  NotebookPen,
  PackagePlus,
  Plus,
  Search,
  ShoppingBasket,
  Shuffle,
  Sparkles,
  Trash2,
  Wheat,
} from "lucide-react";
import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";

type View = "home" | "tasks" | "recovery" | "state" | "signs" | "library" | "roulette" | "shopping" | "visitMemo";
type TaskStatus = "todo" | "doing" | "done";
type TaskPriority = "low" | "medium" | "high";
type MoodStatus = "stable" | "uneasy" | "tired" | "slipping" | "recovering";
type Energy = "low" | "middle" | "high";
type Mind = "calm" | "uneasy" | "overloaded";
type Need = "rest" | "light" | "connect";
type SignId = "sleep" | "body" | "thoughts" | "noise" | "messages" | "food" | "irritation" | "isolation";
type CategoryId = "staple" | "side" | "drink" | "daily" | "heavy" | "treat";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  project: string;
  dueDate: string;
  memo: string;
  createdAt: string;
};

type RecoveryLog = {
  id: string;
  date: string;
  status: MoodStatus;
  bodyNote: string;
  feelingNote: string;
  doneOneThing: string;
  recoveryTrigger: string;
  todayWord: string;
  createdAt: string;
};

type BranchState = { energy: Energy; mind: Mind; need: Need };
type SignCheck = { id: string; date: string; checked: SignId[]; note: string; createdAt: string };
type LibraryEntry = { id: string; title: string; body: string; tag: string; custom?: boolean };
type RouletteAction = { id: string; text: string; category: string; favorite?: boolean; custom?: boolean };
type RouletteHistory = { id: string; text: string; status: "drawn" | "done" | "skipped"; createdAt: string };

type ShoppingItem = {
  id: string;
  name: string;
  category: CategoryId;
  checked: boolean;
  today: boolean;
  createdAt: number;
  checkedAt?: number;
};

type VisitMemoDay = {
  id: string;
  date: string;
  sleepHours: string;
  bowel: "yes" | "no" | "";
  breakfast: string;
  lunch: string;
  dinner: string;
  snack: string;
  medicineCount: string;
};

type VisitMemo = {
  days: VisitMemoDay[];
  other: string;
  achieved: string;
  happy: string;
  mustTalk: string;
  chat: string;
};

type VisitMemoSummaryKey = Exclude<keyof VisitMemo, "days">;

const TASK_STORAGE_KEY = "notion-simple-task-manager-v2";
const LEGACY_TASK_STORAGE_KEY = "notion-simple-task-manager";
const RECOVERY_STORAGE_KEY = "notion-recovery-log-v1";
const BRANCH_STORAGE_KEY = "state-branch-ui-v1";
const SIGNS_STORAGE_KEY = "early-sign-checks-v1";
const LIBRARY_STORAGE_KEY = "comfort-library-custom-v1";
const ROULETTE_ACTIONS_STORAGE_KEY = "today-roulette-actions-v1";
const ROULETTE_HISTORY_STORAGE_KEY = "today-roulette-history-v1";
const SHOPPING_STORAGE_KEY = "shopping-list-mobile-v1";
const VISIT_MEMO_STORAGE_KEY = "visit-nursing-medical-memo-v1";

const today = toDateInputValue(new Date());

const menuItems: Array<{ view: Exclude<View, "home">; title: string; description: string; icon: typeof Home }> = [
  { view: "tasks", title: "タスク管理", description: "やること、期限、優先度を整理", icon: ListChecks },
  { view: "recovery", title: "回復ログ", description: "体調と気持ちを短く記録", icon: HeartPulse },
  { view: "state", title: "今の状態 分岐UI", description: "今の状態から次の一手を選ぶ", icon: Sparkles },
  { view: "signs", title: "崩れ始めサイン チェックUI", description: "早めのサインを拾って守りを固める", icon: ClipboardCheck },
  { view: "library", title: "安心文庫ビューア", description: "安心文をタグで保存して読み返す", icon: BookOpen },
  { view: "roulette", title: "今日やることルーレット", description: "迷った時に小さな行動を1つ選ぶ", icon: Shuffle },
  { view: "shopping", title: "買い物リスト", description: "買い忘れを減らす片手用リスト", icon: ShoppingBasket },
];

menuItems.push({ view: "visitMemo", title: "訪看・診察メモ", description: "毎日の記録をコピー用に整える", icon: NotebookPen });

const moodOptions: Array<{ value: MoodStatus; label: string }> = [
  { value: "stable", label: "安定" },
  { value: "uneasy", label: "やや不安" },
  { value: "tired", label: "疲れている" },
  { value: "slipping", label: "崩れ始め" },
  { value: "recovering", label: "回復中" },
];

const moodLabel = Object.fromEntries(moodOptions.map((item) => [item.value, item.label])) as Record<MoodStatus, string>;
const priorityLabel: Record<TaskPriority, string> = { low: "低", medium: "中", high: "高" };
const statusLabel: Record<TaskStatus, string> = { todo: "未着手", doing: "進行中", done: "完了" };

const signOptions: Array<{ id: SignId; label: string; guide: string }> = [
  { id: "sleep", label: "眠りが浅い", guide: "寝る前の刺激を減らして、予定を詰めすぎない。" },
  { id: "body", label: "体が重い", guide: "水分、食事、横になる時間を先に確保する。" },
  { id: "thoughts", label: "考えが止まらない", guide: "紙に書き出して、判断は明日に回す。" },
  { id: "noise", label: "音や光がつらい", guide: "通知、照明、画面の明るさを弱める。" },
  { id: "messages", label: "連絡が重い", guide: "返信する時間を決めて、それまでは見ない。" },
  { id: "food", label: "食事が抜けがち", guide: "食べやすいものを先に置く。" },
  { id: "irritation", label: "焦りやすい", guide: "タスクを1つだけ残して、他を保留にする。" },
  { id: "isolation", label: "抱え込みやすい", guide: "一言だけ誰かに送る選択肢を持つ。" },
];

const defaultLibrary: LibraryEntry[] = [
  { id: "enough", title: "今日はここまでで十分", body: "できた量ではなく、続けようとしていることを数えていい。", tag: "休み" },
  { id: "slow", title: "急がなくていい", body: "今の速度を基準にして、呼吸と水分と安全な場所を先にする。", tag: "落ち着き" },
  { id: "one", title: "次は1つだけ", body: "全部を整えなくていい。1つ終えたら、その時点で見直せばいい。", tag: "行動" },
];

const defaultRouletteActions: RouletteAction[] = [
  { id: "water", text: "水を飲む", category: "回復" },
  { id: "breath", text: "深呼吸を4回する", category: "回復" },
  { id: "log", text: "回復ログを1行書く", category: "記録" },
  { id: "desk", text: "机の上を1つ片付ける", category: "生活" },
  { id: "music", text: "好きな音楽を1曲流す", category: "回復" },
  { id: "task", text: "タスクを1つだけ進める", category: "作業" },
];

const shoppingCategories: Array<{ id: CategoryId; label: string; icon: typeof ShoppingBasket; color: string }> = [
  { id: "staple", label: "主食", icon: Wheat, color: "#45745f" },
  { id: "side", label: "おかず", icon: Beef, color: "#b8584c" },
  { id: "drink", label: "飲み物", icon: Milk, color: "#3f70a4" },
  { id: "daily", label: "日用品", icon: Home, color: "#75685b" },
  { id: "heavy", label: "重いもの", icon: Dumbbell, color: "#5f5f77" },
  { id: "treat", label: "ぜいたく枠", icon: Crown, color: "#b07726" },
];

const frequentItems: Array<{ name: string; category: CategoryId }> = [
  { name: "米", category: "staple" },
  { name: "食パン", category: "staple" },
  { name: "卵", category: "side" },
  { name: "納豆", category: "side" },
  { name: "牛乳", category: "drink" },
  { name: "お茶", category: "drink" },
  { name: "トイレットペーパー", category: "daily" },
  { name: "洗剤", category: "daily" },
  { name: "水 2L", category: "heavy" },
  { name: "猫砂", category: "heavy" },
  { name: "アイス", category: "treat" },
  { name: "チョコ", category: "treat" },
];

const shoppingCategoryById = Object.fromEntries(shoppingCategories.map((category) => [category.id, category])) as Record<
  CategoryId,
  (typeof shoppingCategories)[number]
>;

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeTask(item: Partial<Task> & { notes?: string; title?: string }): Task | null {
  if (!item.title) return null;
  return {
    id: item.id || createId("task"),
    title: String(item.title),
    status: item.status === "doing" || item.status === "done" ? item.status : "todo",
    priority: item.priority === "low" || item.priority === "high" ? item.priority : "medium",
    project: item.project || "Inbox",
    dueDate: item.dueDate || "",
    memo: item.memo || item.notes || "",
    createdAt: item.createdAt || new Date().toISOString(),
  };
}

function loadTasks() {
  const current = readStorage<Array<Partial<Task>>>(TASK_STORAGE_KEY, []).map(normalizeTask).filter(Boolean) as Task[];
  if (current.length > 0) return current;
  return readStorage<Array<Partial<Task> & { notes?: string }>>(LEGACY_TASK_STORAGE_KEY, []).map(normalizeTask).filter(Boolean) as Task[];
}

function createShoppingItem(name: string, category: CategoryId, todayOnly = true): ShoppingItem {
  return {
    id: globalThis.crypto?.randomUUID?.() || createId("shopping"),
    name,
    category,
    checked: false,
    today: todayOnly,
    createdAt: Date.now(),
  };
}

function loadShoppingItems() {
  const fallback = [createShoppingItem("卵", "side"), createShoppingItem("牛乳", "drink"), createShoppingItem("食パン", "staple")];
  return readStorage<ShoppingItem[]>(SHOPPING_STORAGE_KEY, fallback);
}

function createVisitMemoDay(date = today): VisitMemoDay {
  return {
    id: globalThis.crypto?.randomUUID?.() || createId("visit-memo-day"),
    date,
    sleepHours: "",
    bowel: "",
    breakfast: "",
    lunch: "",
    dinner: "",
    snack: "",
    medicineCount: "0",
  };
}

function loadVisitMemo(): VisitMemo {
  return readStorage<VisitMemo>(VISIT_MEMO_STORAGE_KEY, createEmptyVisitMemo());
}

function createEmptyVisitMemo(): VisitMemo {
  return {
    days: [createVisitMemoDay()],
    other: "",
    achieved: "",
    happy: "",
    mustTalk: "",
    chat: "",
  };
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short" }).format(new Date(`${date}T00:00:00`));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function App() {
  const [view, setView] = useState<View>("home");
  const title = view === "home" ? "ミニアプリ集" : menuItems.find((item) => item.view === view)?.title || "ミニアプリ集";

  return (
    <main className="app-shell">
      <section className="app-frame">
        <header className="topbar">
          <button className="home-button" type="button" onClick={() => setView(view === "home" ? "shopping" : "home")} aria-label="ホームへ戻る">
            {view === "home" ? <ShoppingBasket size={19} /> : <ArrowLeft size={19} />}
          </button>
          <div>
            <p className="eyebrow">Life dashboard</p>
            <h1>{title}</h1>
          </div>
        </header>

        {view === "home" ? (
          <HomeView setView={setView} />
        ) : (
          <>
            <nav className="quick-tabs" aria-label="ミニアプリ切り替え">
              {menuItems.map((item) => (
                <button key={item.view} className={view === item.view ? "active" : ""} type="button" onClick={() => setView(item.view)}>
                  {item.title}
                </button>
              ))}
            </nav>
            {view === "tasks" && <TaskManager />}
            {view === "recovery" && <RecoveryLogApp />}
            {view === "state" && <StateBranchUi />}
            {view === "signs" && <SignsCheckUi />}
            {view === "library" && <ComfortLibrary />}
            {view === "roulette" && <RouletteApp />}
            {view === "shopping" && <ShoppingListApp />}
            {view === "visitMemo" && <VisitMemoApp />}
          </>
        )}
      </section>
    </main>
  );
}

function HomeView({ setView }: { setView: (view: View) => void }) {
  const tasks = loadTasks();
  const shopping = readStorage<ShoppingItem[]>(SHOPPING_STORAGE_KEY, []);
  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const shoppingLeft = shopping.filter((item) => item.today && !item.checked).length;

  return (
    <>
      <section className="home-summary">
        <Stat label="未完了タスク" value={`${openTasks}件`} />
        <Stat label="今日の買い物" value={`${shoppingLeft}件`} />
        <Stat label="保存先" value="localStorage" />
      </section>
      <section className="home-grid" aria-label="ホームメニュー">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button className="menu-card" key={item.view} type="button" onClick={() => setView(item.view)}>
              <span className="menu-icon">
                <Icon size={23} />
              </span>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </button>
          );
        })}
      </section>
    </>
  );
}

function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<TaskStatus | "all">("all");

  useEffect(() => window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks)), [tasks]);

  const visibleTasks = tasks
    .filter((task) => filter === "all" || task.status === filter)
    .sort((a, b) => (a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : statusRank(a.status) - statusRank(b.status)));

  function addTask(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setTasks((current) => [
      { id: createId("task"), title: title.trim(), project: "Inbox", dueDate: "", priority: "medium", memo: "", status: "todo", createdAt: new Date().toISOString() },
      ...current,
    ]);
    setTitle("");
  }

  function updateTask(id: string, patch: Partial<Task>) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  }

  return (
    <section className="panel">
      <form className="inline-form" onSubmit={addTask}>
        <label>
          <span>タスク名</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例: 申請書を確認する" />
        </label>
        <button className="primary-button" type="submit">
          <Plus size={18} />
          追加
        </button>
      </form>
      <div className="segmented">
        {(["all", "todo", "doing", "done"] as const).map((item) => (
          <button key={item} className={filter === item ? "active" : ""} type="button" onClick={() => setFilter(item)}>
            {item === "all" ? "すべて" : statusLabel[item]}
          </button>
        ))}
      </div>
      <div className="task-list">
        {visibleTasks.length === 0 ? (
          <Empty text="表示できるタスクはありません。" />
        ) : (
          visibleTasks.map((task) => (
            <article className={`task-card ${task.status}`} key={task.id}>
              <button className="check-button" type="button" onClick={() => updateTask(task.id, { status: task.status === "done" ? "todo" : "done" })}>
                {task.status === "done" ? <Check size={17} /> : null}
              </button>
              <div className="task-main">
                <input className="task-title" value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} />
                <div className="task-meta">
                  <span>{statusLabel[task.status]}</span>
                  <span>優先度 {priorityLabel[task.priority]}</span>
                  {task.dueDate ? (
                    <span>
                      <CalendarDays size={14} />
                      {task.dueDate}
                    </span>
                  ) : null}
                </div>
              </div>
              <select value={task.status} onChange={(event) => updateTask(task.id, { status: event.target.value as TaskStatus })}>
                <option value="todo">未着手</option>
                <option value="doing">進行中</option>
                <option value="done">完了</option>
              </select>
              <button className="icon-button danger" type="button" onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))}>
                <Trash2 size={16} />
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function RecoveryLogApp() {
  const [logs, setLogs] = useState<RecoveryLog[]>(readStorage<RecoveryLog[]>(RECOVERY_STORAGE_KEY, []));
  const [status, setStatus] = useState<MoodStatus>("stable");
  const [bodyNote, setBodyNote] = useState("");
  const [feelingNote, setFeelingNote] = useState("");
  const [doneOneThing, setDoneOneThing] = useState("");
  const [recoveryTrigger, setRecoveryTrigger] = useState("");
  const [todayWord, setTodayWord] = useState("");

  useEffect(() => window.localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(logs)), [logs]);

  function saveLog(event: FormEvent) {
    event.preventDefault();
    setLogs((current) => [{ id: createId("recovery"), date: today, status, bodyNote, feelingNote, doneOneThing, recoveryTrigger, todayWord, createdAt: new Date().toISOString() }, ...current]);
    setBodyNote("");
    setFeelingNote("");
    setDoneOneThing("");
    setRecoveryTrigger("");
    setTodayWord("");
  }

  return (
    <section className="panel two-column">
      <form className="stack" onSubmit={saveLog}>
        <div className="choice-grid five">
          {moodOptions.map((item) => (
            <button className={status === item.value ? "selected" : ""} key={item.value} type="button" onClick={() => setStatus(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
        <TextArea label="体の状態" value={bodyNote} onChange={setBodyNote} />
        <TextArea label="気持ちの状態" value={feelingNote} onChange={setFeelingNote} />
        <TextArea label="できたことを1つ" value={doneOneThing} onChange={setDoneOneThing} />
        <TextArea label="効いた回復トリガー" value={recoveryTrigger} onChange={setRecoveryTrigger} />
        <label className="field">
          <span>今日のひとこと</span>
          <input value={todayWord} onChange={(event) => setTodayWord(event.target.value)} placeholder="今日はここまでで十分" />
        </label>
        <button className="primary-button full" type="submit">
          <Plus size={18} />
          保存
        </button>
      </form>
      <div className="stack">
        {logs.length === 0 ? <Empty text="まだログはありません。" /> : logs.map((log) => <LogCard key={log.id} log={log} onDelete={() => setLogs((current) => current.filter((item) => item.id !== log.id))} />)}
      </div>
    </section>
  );
}

function StateBranchUi() {
  const [state, setState] = useState<BranchState>(readStorage<BranchState>(BRANCH_STORAGE_KEY, { energy: "middle", mind: "calm", need: "light" }));
  useEffect(() => window.localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(state)), [state]);
  const result = getStateResult(state);

  return (
    <section className="panel">
      <BranchGroup label="エネルギー" value={state.energy} options={[["low", "低い"], ["middle", "ふつう"], ["high", "高め"]]} onChange={(energy) => setState((current) => ({ ...current, energy }))} />
      <BranchGroup label="頭と心" value={state.mind} options={[["calm", "落ち着き"], ["uneasy", "不安"], ["overloaded", "過負荷"]]} onChange={(mind) => setState((current) => ({ ...current, mind }))} />
      <BranchGroup label="今ほしいもの" value={state.need} options={[["rest", "休み"], ["light", "軽い行動"], ["connect", "つながる"]]} onChange={(need) => setState((current) => ({ ...current, need }))} />
      <div className="result-box">
        <strong>{result.title}</strong>
        <p>{result.body}</p>
        <small>{result.action}</small>
      </div>
    </section>
  );
}

function SignsCheckUi() {
  const [history, setHistory] = useState<SignCheck[]>(readStorage<SignCheck[]>(SIGNS_STORAGE_KEY, []));
  const [checked, setChecked] = useState<SignId[]>([]);
  const [note, setNote] = useState("");
  useEffect(() => window.localStorage.setItem(SIGNS_STORAGE_KEY, JSON.stringify(history)), [history]);
  const guides = signOptions.filter((item) => checked.includes(item.id)).map((item) => item.guide);
  const level = checked.length >= 5 ? "守りを固める" : checked.length >= 3 ? "早めに軽くする" : "様子を見る";

  return (
    <section className="panel two-column">
      <div className="stack">
        <div className="result-box">
          <strong>{level}</strong>
          <p>{checked.length}個チェック中。多い日は予定、通知、刺激を減らす合図にできます。</p>
        </div>
        <div className="check-grid">
          {signOptions.map((item) => (
            <label className="check-card" key={item.id}>
              <input type="checkbox" checked={checked.includes(item.id)} onChange={(event) => setChecked((current) => (event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)))} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        <TextArea label="メモ" value={note} onChange={setNote} />
        <button
          className="primary-button full"
          type="button"
          onClick={() => {
            setHistory((current) => [{ id: createId("sign"), date: today, checked, note, createdAt: new Date().toISOString() }, ...current]);
            setChecked([]);
            setNote("");
          }}
        >
          <Plus size={18} />
          保存
        </button>
      </div>
      <div className="stack">
        {guides.length > 0 ? (
          <div className="guide-card">
            <strong>今日の守り方</strong>
            {guides.map((guide) => (
              <p key={guide}>{guide}</p>
            ))}
          </div>
        ) : (
          <Empty text="当てはまるサインを選ぶと守り方が出ます。" />
        )}
        {history.slice(0, 6).map((item) => (
          <article className="history-card" key={item.id}>
            <strong>
              {formatDate(item.date)} / {item.checked.length}個
            </strong>
            {item.note ? <p>{item.note}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ComfortLibrary() {
  const [customEntries, setCustomEntries] = useState<LibraryEntry[]>(readStorage<LibraryEntry[]>(LIBRARY_STORAGE_KEY, []));
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("自分用");
  const [filter, setFilter] = useState("すべて");
  useEffect(() => window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(customEntries)), [customEntries]);
  const entries = [...customEntries, ...defaultLibrary];
  const tags = ["すべて", ...Array.from(new Set(entries.map((entry) => entry.tag)))];
  const visible = filter === "すべて" ? entries : entries.filter((entry) => entry.tag === filter);

  function addEntry(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setCustomEntries((current) => [{ id: createId("book"), title: title.trim(), body: body.trim(), tag: tag.trim() || "自分用", custom: true }, ...current]);
    setTitle("");
    setBody("");
  }

  return (
    <section className="panel">
      <form className="library-form" onSubmit={addEntry}>
        <label className="field">
          <span>タイトル</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="field">
          <span>タグ</span>
          <input value={tag} onChange={(event) => setTag(event.target.value)} />
        </label>
        <TextArea label="本文" value={body} onChange={setBody} />
        <button className="primary-button full" type="submit">
          <Plus size={18} />
          追加
        </button>
      </form>
      <div className="segmented wrap">
        {tags.map((item) => (
          <button key={item} className={filter === item ? "active" : ""} type="button" onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="library-grid">
        {visible.map((entry) => (
          <article className="library-card" key={entry.id}>
            <span>{entry.tag}</span>
            <strong>{entry.title}</strong>
            <p>{entry.body}</p>
            {entry.custom ? (
              <button className="text-button" type="button" onClick={() => setCustomEntries((current) => current.filter((item) => item.id !== entry.id))}>
                削除
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function RouletteApp() {
  const [actions, setActions] = useState<RouletteAction[]>(readStorage<RouletteAction[]>(ROULETTE_ACTIONS_STORAGE_KEY, defaultRouletteActions));
  const [history, setHistory] = useState<RouletteHistory[]>(readStorage<RouletteHistory[]>(ROULETTE_HISTORY_STORAGE_KEY, []));
  const [current, setCurrent] = useState<RouletteAction | null>(null);
  const [newAction, setNewAction] = useState("");
  const [category, setCategory] = useState("回復");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  useEffect(() => window.localStorage.setItem(ROULETTE_ACTIONS_STORAGE_KEY, JSON.stringify(actions)), [actions]);
  useEffect(() => window.localStorage.setItem(ROULETTE_HISTORY_STORAGE_KEY, JSON.stringify(history)), [history]);
  const pool = favoritesOnly ? actions.filter((item) => item.favorite) : actions;

  function draw() {
    if (pool.length === 0) return;
    const action = pool[Math.floor(Math.random() * pool.length)];
    setCurrent(action);
    setHistory((items) => [{ id: createId("roulette-history"), text: action.text, status: "drawn" as const, createdAt: new Date().toISOString() }, ...items].slice(0, 20));
  }

  return (
    <section className="panel two-column">
      <div className="stack">
        <div className="roulette-box">
          <Shuffle size={34} />
          <strong>{current ? current.text : "ボタンを押すと1つ選びます"}</strong>
          <small>{current?.category || "迷った時の小さな一手"}</small>
          <button className="primary-button full" type="button" onClick={draw}>
            <Shuffle size={18} />
            まわす
          </button>
        </div>
        <label className="check-card">
          <input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} />
          <span>お気に入りだけでまわす</span>
        </label>
        <form
          className="task-form compact"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newAction.trim()) return;
            setActions((items) => [{ id: createId("roulette"), text: newAction.trim(), category, custom: true }, ...items]);
            setNewAction("");
          }}
        >
          <label className="field wide">
            <span>行動</span>
            <input value={newAction} onChange={(event) => setNewAction(event.target.value)} placeholder="例: 洗濯物を1つたたむ" />
          </label>
          <label className="field">
            <span>分類</span>
            <input value={category} onChange={(event) => setCategory(event.target.value)} />
          </label>
          <button className="primary-button" type="submit">
            <Plus size={18} />
            追加
          </button>
        </form>
      </div>
      <div className="stack">
        {actions.map((action) => (
          <article className="row" key={action.id}>
            <button className={action.favorite ? "tiny active" : "tiny"} type="button" onClick={() => setActions((items) => items.map((item) => (item.id === action.id ? { ...item, favorite: !item.favorite } : item)))}>
              ★
            </button>
            <p>
              {action.text}
              <small>{action.category}</small>
            </p>
            {action.custom ? (
              <button className="icon-button danger" type="button" onClick={() => setActions((items) => items.filter((item) => item.id !== action.id))}>
                <Trash2 size={16} />
              </button>
            ) : null}
          </article>
        ))}
        {history.length > 0 ? <div className="history-line">最新: {history[0].text} ({formatTime(history[0].createdAt)})</div> : null}
      </div>
    </section>
  );
}

function ShoppingListApp() {
  const [items, setItems] = useState<ShoppingItem[]>(loadShoppingItems);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryId>("side");
  const [showTodayOnly, setShowTodayOnly] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => window.localStorage.setItem(SHOPPING_STORAGE_KEY, JSON.stringify(items)), [items]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .filter((item) => (showTodayOnly ? item.today : true))
      .filter((item) => item.name.toLowerCase().includes(needle) || shoppingCategoryById[item.category].label.includes(needle))
      .sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        if (a.checked && b.checked) return (b.checkedAt || 0) - (a.checkedAt || 0);
        return a.createdAt - b.createdAt;
      });
  }, [items, query, showTodayOnly]);

  const activeItems = visibleItems.filter((item) => !item.checked);
  const checkedItems = visibleItems.filter((item) => item.checked);
  const activeCount = activeItems.length;
  const checkedCount = checkedItems.length;

  function addItem(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setItems((current) => [createShoppingItem(trimmed, category), ...current]);
    setName("");
  }

  function updateItem(id: string, patch: Partial<ShoppingItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function toggleItem(id: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, checked: !item.checked, checkedAt: item.checked ? undefined : Date.now() } : item)));
  }

  function renderShoppingItem(item: ShoppingItem) {
    return (
      <article className={item.checked ? "shopping-item checked" : "shopping-item"} key={item.id}>
        <button className="check-circle" type="button" onClick={() => toggleItem(item.id)} aria-label={`${item.name}を切り替え`}>
          {item.checked ? <Check size={18} /> : null}
        </button>
        <div className="item-name-cell">
          <input value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} aria-label="品名" />
          {item.checked ? <small>{shoppingCategoryById[item.category].label}</small> : null}
        </div>
        <button type="button" className={item.today ? "today-toggle active" : "today-toggle"} onClick={() => updateItem(item.id, { today: !item.today })}>
          今日
        </button>
        <button className="delete-button" type="button" onClick={() => setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))} aria-label={`${item.name}を削除`}>
          <Trash2 size={17} />
        </button>
      </article>
    );
  }

  return (
    <section className="shopping-panel">
      <section className="status-row" aria-label="買い物の進み具合">
        <div>
          <span>残り</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>済み</span>
          <strong>{checkedCount}</strong>
        </div>
        <button type="button" onClick={() => setShowTodayOnly((current) => !current)} className={showTodayOnly ? "pill active" : "pill"}>
          今日だけ
        </button>
      </section>

      <form className="add-form" onSubmit={addItem}>
        <label className="input-wrap">
          <PackagePlus size={18} />
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="買うものを追加" />
        </label>
        <button className="add-button" type="submit" aria-label="追加">
          <Plus size={22} />
        </button>
      </form>

      <section className="category-picker" aria-label="カテゴリ選択">
        {shoppingCategories.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" className={category === item.id ? "category-chip selected" : "category-chip"} style={{ "--chip-color": item.color } as CSSProperties} onClick={() => setCategory(item.id)}>
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </section>

      <section className="quick-add" aria-label="よく買うもの">
        <div className="section-title">
          <Sparkles size={16} />
          <h2>よく買うもの</h2>
        </div>
        <div className="quick-grid">
          {frequentItems.map((item) => (
            <button key={`${item.category}-${item.name}`} type="button" onClick={() => setItems((current) => [createShoppingItem(item.name, item.category), ...current])}>
              <span>{item.name}</span>
              <small>{shoppingCategoryById[item.category].label}</small>
            </button>
          ))}
        </div>
      </section>

      <div className="search-row">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="リスト内を検索" />
      </div>

      <section className="shopping-list" aria-label="買うもの一覧">
        {visibleItems.length === 0 ? (
          <div className="empty">
            <Coffee size={28} />
            <p>今の条件では表示するものがありません。</p>
          </div>
        ) : (
          <>
            {shoppingCategories.map((group) => {
              const groupItems = activeItems.filter((item) => item.category === group.id);
              if (groupItems.length === 0) return null;
              const Icon = group.icon;
              return (
                <div className="category-section" key={group.id}>
                  <div className="category-heading" style={{ "--heading-color": group.color } as CSSProperties}>
                    <Icon size={17} />
                    <h2>{group.label}</h2>
                  </div>
                  <div className="item-stack">{groupItems.map(renderShoppingItem)}</div>
                </div>
              );
            })}
            {checkedItems.length > 0 ? (
              <div className="category-section checked-section">
                <div className="category-heading" style={{ "--heading-color": "#6b776f" } as CSSProperties}>
                  <Check size={17} />
                  <h2>チェック済み</h2>
                </div>
                <div className="item-stack">{checkedItems.map(renderShoppingItem)}</div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {items.some((item) => item.checked) ? (
        <button className="clear-button" type="button" onClick={() => setItems((current) => current.filter((item) => !item.checked))}>
          チェック済みを片付ける
        </button>
      ) : null}
    </section>
  );
}

function VisitMemoApp() {
  const [memo, setMemo] = useState<VisitMemo>(loadVisitMemo);
  const [showOutput, setShowOutput] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [copiedSnapshot, setCopiedSnapshot] = useState("");

  useEffect(() => window.localStorage.setItem(VISIT_MEMO_STORAGE_KEY, JSON.stringify(memo)), [memo]);

  const output = useMemo(() => buildVisitMemoText(memo), [memo]);

  function addDay() {
    const lastDate = memo.days[memo.days.length - 1]?.date;
    const nextDate = lastDate ? addDays(lastDate, 1) : today;
    setMemo((current) => ({ ...current, days: [...current.days, createVisitMemoDay(nextDate)] }));
  }

  function updateDay(id: string, patch: Partial<VisitMemoDay>) {
    setMemo((current) => ({
      ...current,
      days: current.days.map((day) => (day.id === id ? { ...day, ...patch } : day)),
    }));
  }

  function removeDay(id: string) {
    if (!window.confirm("この日付の記録を削除しますか？")) return;
    setMemo((current) => {
      const days = current.days.filter((day) => day.id !== id);
      return { ...current, days: days.length > 0 ? days : [createVisitMemoDay()] };
    });
  }

  function clearSummaryField(key: VisitMemoSummaryKey) {
    setMemo((current) => ({ ...current, [key]: "" }));
  }

  function clearAllMemo() {
    if (!window.confirm("すべて削除しますか？")) return;
    setMemo(createEmptyVisitMemo());
    setCopiedSnapshot("");
    setCopyStatus("");
  }

  function deleteCopiedMemo() {
    if (!window.confirm("コピー済みの記録を削除しますか？")) return;
    setMemo(createEmptyVisitMemo());
    setCopiedSnapshot("");
    setCopyStatus("コピー済みの記録を削除しました");
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(output);
      setCopyStatus("コピーしました！");
      setCopiedSnapshot(output);
    } catch {
      setCopyStatus("コピーできませんでした");
    }
    window.setTimeout(() => setCopyStatus(""), 1800);
  }

  return (
    <section className="visit-memo">
      <div className="memo-actions">
        <button className="primary-button" type="button" onClick={addDay}>
          <Plus size={18} />
          日付を追加
        </button>
        <button className="text-button neutral" type="button" onClick={() => setShowOutput((current) => !current)}>
          <ClipboardCheck size={17} />
          コピー用テキストを見る
        </button>
        <button className="primary-button" type="button" onClick={copyOutput}>
          <Clipboard size={17} />
          コピーする
        </button>
        <button className="text-button danger-soft" type="button" onClick={clearAllMemo}>
          <Trash2 size={17} />
          すべて削除
        </button>
      </div>

      <section className="memo-days" aria-label="日付ごとの記録">
        {memo.days.map((day, index) => (
          <article className="memo-day-card" key={day.id}>
            <div className="memo-day-head">
              <h2>{index + 1}日目</h2>
              <button className="text-button danger-soft compact" type="button" onClick={() => removeDay(day.id)}>
                <Trash2 size={16} />
                削除
              </button>
            </div>
            <div className="memo-grid">
              <label className="field">
                <span>日付</span>
                <input type="date" value={day.date} onChange={(event) => updateDay(day.id, { date: event.target.value })} />
              </label>
              <label className="field">
                <span>睡眠時間</span>
                <input value={day.sleepHours} onChange={(event) => updateDay(day.id, { sleepHours: event.target.value })} placeholder="5時間" />
              </label>
              <label className="field">
                <span>お通じ</span>
                <select value={day.bowel} onChange={(event) => updateDay(day.id, { bowel: event.target.value as VisitMemoDay["bowel"] })}>
                  <option value="">未入力</option>
                  <option value="yes">◯</option>
                  <option value="no">×</option>
                </select>
              </label>
              <label className="field">
                <span>朝食</span>
                <input value={day.breakfast} onChange={(event) => updateDay(day.id, { breakfast: event.target.value })} placeholder="フルグラ" />
              </label>
              <label className="field">
                <span>昼食</span>
                <input value={day.lunch} onChange={(event) => updateDay(day.id, { lunch: event.target.value })} placeholder="焼きそば" />
              </label>
              <label className="field">
                <span>夕食</span>
                <input value={day.dinner} onChange={(event) => updateDay(day.id, { dinner: event.target.value })} placeholder="海鮮丼" />
              </label>
              <label className="field">
                <span>間食</span>
                <input value={day.snack} onChange={(event) => updateDay(day.id, { snack: event.target.value })} placeholder="フルグラ少し" />
              </label>
              <label className="field">
                <span>頓服回数</span>
                <input inputMode="numeric" value={day.medicineCount} onChange={(event) => updateDay(day.id, { medicineCount: event.target.value })} placeholder="0" />
              </label>
            </div>
          </article>
        ))}
      </section>

      <section className="memo-summary panel">
        <SummaryTextArea label="その他" value={memo.other} onChange={(other) => setMemo((current) => ({ ...current, other }))} onClear={() => clearSummaryField("other")} />
        <SummaryTextArea label="できたこと、やれたこと、頑張れたこと" value={memo.achieved} onChange={(achieved) => setMemo((current) => ({ ...current, achieved }))} onClear={() => clearSummaryField("achieved")} />
        <SummaryTextArea label="嬉しかったこと、嬉しい" value={memo.happy} onChange={(happy) => setMemo((current) => ({ ...current, happy }))} onClear={() => clearSummaryField("happy")} />
        <SummaryTextArea label="これだけは忘れずに話したいこと" value={memo.mustTalk} onChange={(mustTalk) => setMemo((current) => ({ ...current, mustTalk }))} onClear={() => clearSummaryField("mustTalk")} />
        <SummaryTextArea label="雑談メモ" value={memo.chat} onChange={(chat) => setMemo((current) => ({ ...current, chat }))} onClear={() => clearSummaryField("chat")} />
      </section>

      {showOutput ? (
        <section className="copy-panel">
          <div className="copy-head">
            <h2>コピー用テキスト</h2>
            <button className="primary-button" type="button" onClick={copyOutput}>
              <Clipboard size={17} />
              コピーする
            </button>
          </div>
          <pre>{output}</pre>
          <button className="primary-button copy-main-button" type="button" onClick={copyOutput}>
            <Clipboard size={18} />
            コピーする
          </button>
          {copiedSnapshot === output && output ? (
            <button className="text-button danger-soft copy-main-button" type="button" onClick={deleteCopiedMemo}>
              <Trash2 size={18} />
              コピー済みとして削除する
            </button>
          ) : null}
          {copyStatus ? <p className="copy-status">{copyStatus}</p> : null}
        </section>
      ) : null}
    </section>
  );
}

function statusRank(status: TaskStatus) {
  return { doing: 0, todo: 1, done: 2 }[status];
}

function getStateResult(state: BranchState) {
  if (state.energy === "low" || state.need === "rest") return { title: "回復を先にする", body: "今日は増やさない日。水分、横になる、通知を減らす、どれか1つで十分です。", action: "おすすめ: 回復ログを書くか、予定を1つ減らす" };
  if (state.mind === "overloaded") return { title: "刺激を下げる", body: "画面、音、会話量を少し減らして、次の予定を1つだけ残すのがよさそうです。", action: "おすすめ: 10分だけ通知を切る" };
  if (state.need === "connect") return { title: "短くつながる", body: "長文ではなく、スタンプや一言だけで外との接点を作るのが合っています。", action: "おすすめ: 送る相手を1人だけ選ぶ" };
  return { title: "小さく進める", body: "今は軽い行動が合いそうです。5分で終わるものを1つだけ選びましょう。", action: "おすすめ: タスク管理から1つ進行中にする" };
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return toDateInputValue(value);
}

function formatMemoDate(date: string) {
  if (!date) return "";
  const value = new Date(`${date}T00:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return `${value.getMonth() + 1}/${value.getDate()}`;
}

function bulletLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `* ${line}`);
}

function appendBulletSection(lines: string[], title: string, value: string) {
  const bullets = bulletLines(value);
  if (bullets.length === 0) return;
  lines.push("", title, "", ...bullets);
}

function buildVisitMemoText(memo: VisitMemo) {
  const lines: string[] = [];

  memo.days.forEach((day, index) => {
    if (index > 0) lines.push("");
    const bowelMark = day.bowel === "yes" ? "◯" : day.bowel === "no" ? "×" : "";
    lines.push(`${formatMemoDate(day.date)}睡眠時間${day.sleepHours}${bowelMark}`);
    if (day.breakfast.trim()) lines.push(`朝、${day.breakfast.trim()}`);
    if (day.lunch.trim()) lines.push(`昼、${day.lunch.trim()}`);
    if (day.dinner.trim()) lines.push(`夜、${day.dinner.trim()}`);
    if (day.snack.trim()) lines.push(`間食、${day.snack.trim()}`);
    lines.push(`頓服${day.medicineCount.trim()}回`);
  });

  appendBulletSection(lines, "その他", memo.other);
  appendBulletSection(lines, "できたこと、やれたこと、頑張れたこと", memo.achieved);
  appendBulletSection(lines, "嬉しかったこと、嬉しい", memo.happy);
  appendBulletSection(lines, "これだけは忘れずに話したいこと", memo.mustTalk);
  appendBulletSection(lines, "※雑談", memo.chat);

  return lines.join("\n").trim();
}

function SummaryTextArea({ label, value, onChange, onClear }: { label: string; value: string; onChange: (value: string) => void; onClear: () => void }) {
  return (
    <div className="summary-field">
      <div className="summary-field-head">
        <span>{label}</span>
        <button className="text-button danger-soft compact" type="button" onClick={onClear} disabled={!value.trim()}>
          <Trash2 size={15} />
          空にする
        </button>
      </div>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function BranchGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (value: T) => void }) {
  return (
    <fieldset className="branch-group">
      <legend>{label}</legend>
      <div className="choice-grid">
        {options.map(([optionValue, labelText]) => (
          <button className={value === optionValue ? "selected" : ""} key={optionValue} type="button" onClick={() => onChange(optionValue)}>
            {labelText}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LogCard({ log, onDelete }: { log: RecoveryLog; onDelete: () => void }) {
  return (
    <article className="log-card">
      <div className="log-head">
        <strong>
          {formatDate(log.date)} / {moodLabel[log.status]}
        </strong>
        <button className="icon-button danger" type="button" onClick={onDelete}>
          <Trash2 size={16} />
        </button>
      </div>
      {[log.bodyNote, log.feelingNote, log.doneOneThing, log.recoveryTrigger, log.todayWord].filter(Boolean).map((text, index) => (
        <p key={index}>{text}</p>
      ))}
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>;
}
