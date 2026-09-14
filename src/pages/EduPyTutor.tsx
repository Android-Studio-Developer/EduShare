import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Code2, Lightbulb, Play, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import BotMessagePanel from "../components/BotMessagePanel";
import { compileEduScript, renderDeveloperBotCommand, renderDeveloperBotPanel } from "../lib/eduScript";

const LESSONS = [
  {
    title: "Your first command",
    goal: "Make a /hello command that sends a friendly reply.",
    explain: ["command hello: creates the command.", "Indented say lines are what the bot sends.", "Indentation matters, just like Python."],
    starter: `command hello:\n    say "Hey! Welcome to my server."`,
    check: (source: string) => compileEduScript(source).commands.some((command) => command.name === "hello" && !!command.response),
  },
  {
    title: "Use member input",
    goal: "Respond differently when someone asks for the rules.",
    explain: ["{user} becomes the member's display name.", "{args} is everything typed after the command.", "if and else let the bot make a choice."],
    starter: `command help:\n    if args == "rules":\n        say "Hey {user}, read #rules."\n    else:\n        say "You asked about: {args}"`,
    check: (source: string) => compileEduScript(source).commands.some((command) => command.name === "help" && (command.conditions?.length ?? 0) > 0),
  },
  {
    title: "Ping the right people",
    goal: "Create a support command that pings the admin role.",
    explain: ["Write @admins inside a reply to ping that server role.", "Members can also be mentioned normally, such as @alex.", "The chat autocomplete appears as soon as someone types @."],
    starter: `command support:\n    say "@admins — {user} needs help with {args}"`,
    check: (source: string) => compileEduScript(source).commands.some((command) => command.name === "support" && command.response.includes("@admins")),
  },
  {
    title: "Build a verification panel",
    goal: "Create a real app panel with fields and a working Verify button.",
    explain: ["panel creates the card title and color sets its accent.", "field adds structured information instead of plain text.", "button ... verify waits for the member to click before verifying."],
    starter: `@verify\ncommand join:\n    authenticate user\n    panel "Server verification"\n    description "Welcome {user}. Confirm your Minecraft name."\n    color "#60a5fa"\n    field "Minecraft name" "{args}"\n    field "Status" "Ready"\n    button "Verify me" verify`,
    check: (source: string) => compileEduScript(source).commands.some((command) => command.action === "verify" && command.panel?.button?.action === "verify"),
  },
] as const;

export default function EduPyTutor() {
  const [lessonIndex, setLessonIndex] = useState(0);
  const [source, setSource] = useState<string>(LESSONS[0].starter);
  const [checked, setChecked] = useState(false);
  const lesson = LESSONS[lessonIndex];
  const compiled = useMemo(() => compileEduScript(source), [source]);
  const passed = !compiled.errors.length && lesson.check(source);
  const command = compiled.commands[0];
  const previewText = command ? renderDeveloperBotCommand(command, "Alex", "Steve123") : "";
  const previewPanel = command ? renderDeveloperBotPanel(command, "Alex", "Steve123") : undefined;

  function chooseLesson(index: number) {
    setLessonIndex(index);
    setSource(LESSONS[index].starter);
    setChecked(false);
  }

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
    <Link to="/develop" className="inline-flex items-center gap-2 text-sm font-semibold text-white/45 hover:text-white"><ArrowLeft size={15}/>Developer Portal</Link>
    <header className="mt-5 overflow-hidden rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-[#171a2e] via-[#11131d] to-[#0d1117] p-7 sm:p-10"><span className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-indigo-300"><Sparkles size={14}/>Interactive course</span><h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">Learn EduPy by building a bot</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/50">No coding experience needed. Edit a tiny working example, run the check, and watch the command become a real chat response.</p></header>
    <div className="mt-6 grid gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="h-fit rounded-2xl border border-white/10 bg-[#111318] p-3 lg:sticky lg:top-24"><p className="px-3 py-2 text-[10px] font-black uppercase tracking-[.18em] text-white/30">4 short lessons</p>{LESSONS.map((item, index) => <button key={item.title} type="button" onClick={() => chooseLesson(index)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${index === lessonIndex ? "bg-[#5865f2] text-white" : "text-white/50 hover:bg-white/5 hover:text-white"}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/20 text-xs font-black">{index + 1}</span><span className="text-sm font-bold">{item.title}</span></button>)}</aside>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#17191f]">
        <div className="border-b border-white/8 p-5 sm:p-6"><p className="text-xs font-bold text-indigo-300">Lesson {lessonIndex + 1}</p><h2 className="mt-1 text-2xl font-black text-white">{lesson.title}</h2><p className="mt-2 text-sm text-white/55">{lesson.goal}</p><div className="mt-4 grid gap-2 sm:grid-cols-3">{lesson.explain.map((item) => <p key={item} className="rounded-xl bg-black/20 p-3 text-xs leading-5 text-white/45"><Lightbulb size={13} className="mb-2 text-amber-300"/>{item}</p>)}</div></div>
        <div className="grid lg:grid-cols-2">
          <div className="border-b border-white/8 p-5 lg:border-b-0 lg:border-r"><div className="flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-bold text-white"><Code2 size={14} className="text-indigo-300"/>Try it</p><button type="button" onClick={() => setSource(lesson.starter)} className="text-[11px] text-white/35 hover:text-white">Reset example</button></div><textarea value={source} onChange={(event) => { setSource(event.target.value); setChecked(false); }} spellCheck={false} className="mt-3 min-h-[360px] w-full resize-y rounded-xl border border-white/10 bg-[#090b0f] p-4 font-mono text-xs leading-6 text-[#dbdee1] outline-none focus:border-indigo-400"/><button type="button" onClick={() => setChecked(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#5865f2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#4752c4]"><Play size={14}/>Run lesson check</button>{checked && <div className={`mt-3 rounded-xl p-3 text-sm ${passed ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"}`}>{passed ? <span className="flex items-center gap-2"><CheckCircle2 size={16}/>Nice — this command works.</span> : compiled.errors[0] ?? "Almost. Follow the goal above, then run the check again."}</div>}</div>
          <div className="p-5"><p className="text-xs font-bold text-white">Live preview</p><div className="mt-3 min-h-[220px] rounded-xl bg-[#313338] p-4"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-500/20 text-indigo-200"><ShieldCheck size={16}/></span><div><p className="text-sm font-bold text-indigo-200">Your Bot <span className="rounded bg-[#5865f2] px-1 py-0.5 text-[9px] text-white">APP</span></p><p className="text-[10px] text-white/30">just now</p></div></div>{previewPanel ? <BotMessagePanel panel={previewPanel}/> : <p className="mt-2 whitespace-pre-wrap text-sm text-[#dbdee1]">{previewText || "Fix the code to see a preview."}</p>}</div>{passed && lessonIndex < LESSONS.length - 1 && <button type="button" onClick={() => chooseLesson(lessonIndex + 1)} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-300 hover:text-indigo-200">Next lesson <ArrowRight size={15}/></button>}{passed && lessonIndex === LESSONS.length - 1 && <Link to="/develop" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-300">Course complete — build your bot <ArrowRight size={15}/></Link>}</div>
        </div>
      </section>
    </div>
  </main>;
}
