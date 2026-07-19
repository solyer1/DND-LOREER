"use client";

import React, { useState, useRef, useEffect } from "react";
import Breadcrumbs from "./Breadcrumbs";
import { CategoryBadge } from "./CategoryIcon";

/* ═══════════════════════════════════════════════════
   ACCORDION COMPONENT
   ═══════════════════════════════════════════════════ */

function Accordion({
  title,
  icon,
  color,
  id,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: string;
  color: string;
  id: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<string>(defaultOpen ? "auto" : "0px");

  useEffect(() => {
    if (open && contentRef.current) {
      setHeight(`${contentRef.current.scrollHeight}px`);
      const timer = setTimeout(() => setHeight("auto"), 400);
      return () => clearTimeout(timer);
    } else {
      if (contentRef.current) {
        setHeight(`${contentRef.current.scrollHeight}px`);
        requestAnimationFrame(() => setHeight("0px"));
      }
    }
  }, [open]);

  return (
    <section id={id} className="scroll-mt-20">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 sm:p-6 rounded-2xl text-left transition-all group"
        style={{
          background: open ? `${color}08` : "var(--bg-secondary)",
          border: `1px solid ${open ? `${color}33` : "var(--border-subtle)"}`,
        }}
      >
        <span className="text-2xl sm:text-3xl">{icon}</span>
        <span
          className="text-lg sm:text-xl font-serif font-bold flex-1"
          style={{ color: open ? color : "var(--text-primary)" }}
        >
          {title}
        </span>
        <svg
          className="w-5 h-5 accordion-chevron flex-shrink-0"
          data-open={open ? "true" : "false"}
          style={{ color: "var(--text-tertiary)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-400"
        style={{
          maxHeight: height,
          opacity: open ? 1 : 0,
          transition: "max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease",
        }}
      >
        <div className="p-5 sm:p-6 pt-3">{children}</div>
      </div>
    </section>
  );
}

function MecTable({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl my-4" style={{ border: "1px solid var(--border-subtle)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "var(--bg-tertiary)" }}>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)", borderBottom: "2px solid var(--border-strong)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConditionCard({ icon, name, desc, list }: { icon: string; name: string; desc?: string; list?: string[] }) {
  return (
    <div className="p-4 rounded-xl flex flex-col h-full" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <h4 className="font-serif font-bold text-sm" style={{ color: "var(--text-primary)" }}>{name}</h4>
      </div>
      {desc && <p className="text-xs leading-relaxed mb-2 flex-1" style={{ color: "var(--text-secondary)" }}>{desc}</p>}
      {list && (
        <ul className="space-y-1">
          {list.map((e, i) => (
            <li key={i} className="text-xs flex items-start gap-2" style={{ color: "var(--text-secondary)" }}>
              <span className="text-[8px] mt-1.5" style={{ color: "var(--text-tertiary)" }}>●</span>{e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClassCard({ name, passive, scaling, perk, color }: { name: string; passive: string; scaling: string; perk: string; color: string }) {
  return (
    <div className="p-5 rounded-xl border-l-4" style={{ background: "var(--bg-tertiary)", borderLeftColor: color, borderTop: "1px solid var(--border-subtle)", borderRight: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
      <h4 className="font-serif font-bold text-lg mb-3" style={{ color: color }}>{name}</h4>
      <div className="space-y-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-tertiary)" }}>Buff</span>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{passive}</p>
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-tertiary)" }}>Scaling (ต่อ 1 Class Level)</span>
          <p className="text-sm italic" style={{ color: "var(--text-secondary)" }}>{scaling}</p>
        </div>
        <div className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
          <span className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: color }}>Perk ประจำตัว</span>
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>{perk}</p>
        </div>
      </div>
    </div>
  );
}

function SubclassCard({ name, passive, skill, scaling }: { name: string; passive: React.ReactNode; skill: React.ReactNode; scaling?: string }) {
  return (
    <div className="p-4 rounded-xl" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)" }}>
      <h4 className="font-serif font-bold text-md mb-2" style={{ color: "var(--text-primary)" }}>{name}</h4>
      <div className="space-y-2">
        <div>
          <span className="text-xs font-bold" style={{ color: "var(--text-tertiary)" }}>Passive:</span>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{passive}</div>
        </div>
        <div>
          <span className="text-xs font-bold" style={{ color: "var(--text-accent)" }}>Battle Skill:</span>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{skill}</div>
        </div>
        {scaling && (
          <div>
            <span className="text-xs font-bold" style={{ color: "var(--text-tertiary)" }}>Scaling:</span>
            <div className="text-xs italic" style={{ color: "var(--text-secondary)" }}>{scaling}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN MECHANICS PAGE (CUSTOM SYSTEM)
   ═══════════════════════════════════════════════════ */

const TOC_ITEMS = [
  { id: "calculation", icon: "🎲", label: "การคำนวณและลูกเต๋า" },
  { id: "resistances", icon: "🛡️", label: "ความต้านทาน" },
  { id: "conditions", icon: "💀", label: "สถานะผิดปกติ" },
  { id: "classes", icon: "⚔️", label: "คลาส & ซับคลาส" },
  { id: "homebrew", icon: "📝", label: "กฎเพิ่มเติม (Homebrew)" },
];

export default function MechanicsPage({ homebrewEntries = [] }: { homebrewEntries?: any[] }) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    TOC_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex gap-8 p-4 sm:p-6 lg:p-8">
      {/* Main Content */}
      <div className="flex-1 max-w-4xl space-y-4">
        <Breadcrumbs items={[{ label: "🏠 หน้าหลัก" }, { label: "⚔️ ระบบการต่อสู้พิเศษ" }]} />

        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-serif font-bold" style={{ color: "var(--text-accent)" }}>
            ระบบการต่อสู้ (Campaign Rules)
          </h1>
          <p className="text-sm mt-2 max-w-2xl" style={{ color: "var(--text-tertiary)" }}>
            กฎกติกา กลไกลูกเต๋า สถานะผิดปกติ และคลาสต่างๆ ที่ถูกปรับปรุงใหม่ทั้งหมดเพื่อใช้สำหรับแคมเปญนี้โดยเฉพาะ
          </p>
        </div>

        {/* ═══ SECTION 1: การคำนวณและลูกเต๋า ═══ */}
        <Accordion title="การคำนวณและลูกเต๋า (Dice & Rules)" icon="🎲" color="#f59e0b" id="calculation" defaultOpen>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <h3 className="font-serif font-bold mb-2" style={{ color: "#f59e0b" }}>อัตราคริติคอล (Crit Rate)</h3>
                <MecTable
                  headers={["ทอยได้ (d20)", "ผลคูณดาเมจ"]}
                  rows={[
                    ["1 - 13", "ไม่มี (ปกติ)"],
                    ["14 - 17", "x1.5"],
                    ["18 - 19", "x2"],
                    ["20 (Nat 20)", "x2.5"],
                  ]}
                />
              </div>
              <div>
                <h3 className="font-serif font-bold mb-2" style={{ color: "#f59e0b" }}>Advantage & Disadvantage</h3>
                <MecTable
                  headers={["สถานการณ์", "การทอยเต๋า"]}
                  rows={[
                    ["1 Adv + 0 Disadv", "ทอย 2d20 เอาค่าสูงสุด"],
                    ["5 Adv + 0 Disadv", "ทอย 2d20 เอาค่าสูงสุด"],
                    ["1 Adv + 1 Disadv", "ทอย 1d20 ปกติ (หักล้างกัน)"],
                    ["5 Adv + 1 Disadv", "ทอย 1d20 ปกติ (แค่ 1 ก็ล้างได้หมด)"],
                    ["Elven Accuracy", "ทอย 3d20 เอาค่าสูงสุด"],
                  ]}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl" style={{ background: "var(--bg-tertiary)", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
              <h3 className="font-serif font-bold mb-2" style={{ color: "#f59e0b" }}>สมการคำนวณดาเมจ</h3>
              <p className="text-lg font-mono text-center my-3" style={{ color: "var(--text-primary)" }}>
                (D20 × Damage) × Vulnurbility/Resistance ± Special Conditions
              </p>
              <p className="text-xs text-center" style={{ color: "var(--text-tertiary)" }}>
                Special Conditions = Bleed, Status, Effect ฯลฯ
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <h3 className="font-serif font-bold mb-2" style={{ color: "#f59e0b" }}>กฎ เสมอ 20 (Attack vs Save)</h3>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  หากฝ่ายโจมตีทอยได้ 20 และฝ่ายป้องกัน (Roll Save) ก็ได้ 20 เพื่อความแฟร์ให้นำ <strong>Modifier ของตนเองมาบวกเพิ่ม</strong>
                  ถ้าบวกแล้ว Save มากกว่า = รอด แต่ถ้ายังเสมอกัน = การโจมตีสำเร็จ
                </p>
              </div>
              <div>
                <h3 className="font-serif font-bold mb-2" style={{ color: "#f59e0b" }}>Parry และ Block ฉุกเฉิน</h3>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  อนุญาตให้กดใช้สกิล Parry/Block สวนเป็น Reaction ทันทีเมื่อถูกโจมตีได้ แม้ไม่ได้กดไว้ก่อน แต่มีข้อเสีย:
                </p>
                <ul className="text-xs mt-2 space-y-1" style={{ color: "var(--text-secondary)" }}>
                  <li>• หากสกิลไม่มี Cooldown จะติด Cooldown 2 เทิร์น</li>
                  <li>• หากสกิลมี Cooldown อยู่แล้ว จะบวก Cooldown เพิ่มอีก 2</li>
                  <li>• <strong className="text-red-400">ถ้าพลาดหรือแพ้</strong>: รับดาเมจเพิ่ม 15%</li>
                </ul>
              </div>
            </div>
          </div>
        </Accordion>

        {/* ═══ SECTION 2: ความต้านทาน ═══ */}
        <Accordion title="ความต้านทาน (Resistances)" icon="🛡️" color="#34d399" id="resistances">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-tertiary)", border: "1px solid rgba(52, 211, 153, 0.3)" }}>
              <h4 className="font-serif font-bold text-lg mb-2" style={{ color: "#34d399" }}>Immunity (ต้านทานสมบูรณ์)</h4>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                ไม่รับดาเมจจาก Damage Type หรือ Effect ประเภทนั้นๆ เลย (ดาเมจ = 0)
              </p>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-tertiary)", border: "1px solid rgba(251, 191, 36, 0.3)" }}>
              <h4 className="font-serif font-bold text-lg mb-2" style={{ color: "#fbbf24" }}>Resistance (ทนทาน)</h4>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                รับดาเมจ และ ผลกระทบลงครึ่งหนึ่ง <strong>(÷2)</strong>
              </p>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-tertiary)", border: "1px solid rgba(248, 113, 113, 0.3)" }}>
              <h4 className="font-serif font-bold text-lg mb-2" style={{ color: "#f87171" }}>Vulnerability (อ่อนแอ)</h4>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                รับดาเมจและผลเป็นเท่าตัว <strong>(x2)</strong> และ <strong>สามารถ Stack ได้</strong> ถ้าการโจมตีมีสถานะที่แพ้ทาง
              </p>
            </div>
          </div>
        </Accordion>

        {/* ═══ SECTION 3: สถานะผิดปกติ ═══ */}
        <Accordion title="สถานะผิดปกติ (Status Conditions)" icon="💀" color="#fb7185" id="conditions">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
              *ทุกๆ Status สามารถอยู่ได้มากสุด 3 turns (เว้นแต่จะระบุเป็นอย่างอื่น)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <ConditionCard icon="😵" name="Stunt" desc="ชะงักไปหนึ่งเทิร์น ไม่สามารถตอบโต้ได้ขณะมีสถานะนี้อยู่" />
              <ConditionCard icon="🧊" name="Freeze" desc="ทำ Action ไม่ได้ ต้อง Roll save (10+) ถึงจะหลุด ลดเลือด 3% Max HP ต่อเทิร์น (ถ้า Wet โดน 25%)" />
              <ConditionCard icon="🩸" name="Bleed" desc="ลด 5% HP ปัจจุบันทุกเทิร์น เพิ่มดาเมจ 1% ต่อ Stack (ซ้อนได้สูงสุด 20 Stack) บวกเป็นดาเมจ Roll ได้" />
              <ConditionCard icon="🔥" name="Burn" desc="ทำดาเมจ 10% ของ HP ปัจจุบัน ซ้อนได้สูงสุด 20 Stack (เพิ่มดาเมจ 2.5% ต่อ 1 Stack)" />
              <ConditionCard icon="🙈" name="Blind" desc="ทอย Action ต่างๆ โดน -5 Roll (ยกเว้นคนที่มี Mind's eye / สัมผัสพิเศษ)" />
              <ConditionCard icon="🐌" name="Slow" desc="ลด Dexterity ลง 2.5 DEX (ซ้อนได้สูงสุด 8 Stack)" />
              <ConditionCard icon="🕊️" name="Flight" desc="การโจมตีระยะใกล้ไร้ผล แต่ถ้าโดนตีโดน 1 ครั้ง สถานะนี้จะหายทันทีและต้องบินใหม่" />
              <ConditionCard icon="🔒" name="Lock (พื้นฐาน)" desc="ทำ Action ไม่ได้ และ AC = 1 (สกิลที่ทำให้ติด Lock ต้องจ่าย Cost และซ้อนไม่ได้)" />
              <ConditionCard icon="⚡" name="Paralyzed" desc="ติด Stunt + พลาด STR/DEX เช็คทันที คนตีใส่ได้ Advantage คริ 18 (ไม่ซ้อน, อยู่ 1 เทิร์น)" />
              <ConditionCard icon="💔" name="Near Death" desc="HP ลดเหลือ 0 จะกลายเป็น 1 แต่ทำ Action ไม่ได้จนกว่าจะถูกฮีล ถ้าอยู่เกิน 5 เทิร์น = ตาย" />
              <ConditionCard icon="💕" name="Charmed" desc="โจมตีผู้สะกดไม่ได้ ผู้สะกดได้ Advantage ตอนสังคม/ต่อสู้ และตีคนติดสถานะแรงขึ้น 40%" />
              <ConditionCard icon="😰" name="Frightened" desc="Disadvantage ใน Attack/Ability check นอกสู้เข้าใกล้ไม่ได้ (ซ้อน Fear ไม่ได้)" />
              <ConditionCard icon="🧪" name="Poison" desc="ลด Max HP ลง 10% ทุกเทิร์นใหญ่ (ไม่ซ้อน, อยู่ 3 เทิร์น) + Disadvantage ทอยโจมตี" />
              <ConditionCard icon="🦴" name="Shattered Bone" desc="ทุก 1 Stack = ลด 1 AC (ซ้อนได้มากสุด 5 Stack)" />
              <ConditionCard icon="💥" name="Broken Bone" desc="ทุก 2 Stack = Disadvantage, -2 Speed ขยับทีเสียเลือด 10% HP ปัจจุบัน (ซ้อนมากสุด 4)" />
              <ConditionCard icon="🤔" name="Doubt" desc="Re-roll d20 ตามจำนวน Stack ที่มี (สุด 5) ล้าง Advantage/Disadvantage แต่อย่างอื่นบวกเหมือนเดิม" />
              <ConditionCard icon="🌑" name="Despair" desc="Disadvantage, -5 Universal roll รับดาเมจแรง 50% ต้องทอย WIS 15 ให้หลุด (เกิดจาก Fear 5 turns หรือทอยพลาด 5 รอบติด)" />
              <ConditionCard icon="✨" name="Inspired" desc="+4 Universal roll ไม่มีทางทอยต่ำกว่า 10 (ถ้า Synergy ให้ Advantage) ติดเองไม่ได้ต้องเพื่อนให้" />
              <ConditionCard icon="🔇" name="Deafened" desc="พลาดเช็คเสียงโดยสมบูรณ์ + Immune เสียง (ยกเว้นมีแรงกระแทก)" />
              <ConditionCard icon="🤼" name="Grappled" desc="DEX เป็น 0 หยุดเมื่อคนติดสถานะได้รับดาเมจ" />
              <ConditionCard icon="👻" name="Invisible" desc="มองไม่เห็น การโจมตีใส่จะได้ Disadvantage และตีคนอื่นได้ Advantage" />
              <ConditionCard icon="💧" name="Wet" desc="ดาเมจ Fire/Heat ลดครึ่ง ล้าง Burn แต่โดน Freeze แรง 25% (จาก 3) และโดน Lightning เป็นวงกว้าง" />
              <ConditionCard icon="🏜️" name="Dry" desc="Burn เพิ่มทีละ 1 Stack และรับดาเมจ Fire เพิ่ม 50%" />
              <ConditionCard icon="🔥" name="Guts (ลูกฮึด)" desc="เมื่อ HP=0 จะกลับมาสู้ต่อได้ เลือดเด้งตาม Custom (ไม่เกิน 40%)" />
              <ConditionCard icon="🎯" name="Sure Hit" desc="โจมตีผ่าน Evasion" />
              <ConditionCard icon="👁️" name="Ignore-Invisible" desc="โจมตีทะลุ Invisible" />
            </div>

            <div className="mt-6 p-4 rounded-xl" style={{ background: "var(--bg-tertiary)", border: "1px solid rgba(167, 139, 250, 0.3)" }}>
              <h3 className="font-serif font-bold mb-2 flex items-center gap-2" style={{ color: "#a78bfa" }}>🛡️ Courage (ความกล้า) — ขั้วตรงข้าม Frightened</h3>
              <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                เอาชนะ Fear ได้ด้วยการ Resist (d20 = 16+) จะได้ความกล้าแทนที่
              </p>
              <ul className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <li><strong style={{ color: "#c084fc" }}>Courage I (16-17):</strong> ไม่รับสถานะผิดปกติทางจิตใจใดๆ</li>
                <li><strong style={{ color: "#d8b4fe" }}>Courage II (18-19):</strong> เหมือนขั้น I แต่บวกเพิ่ม 2 d20</li>
                <li><strong style={{ color: "#e9d5ff" }}>Courage III (Nat 20):</strong> Maximum roll อัตโนมัติทุกอย่างขณะที่สถานะนี้ยังอยู่!</li>
              </ul>
            </div>
          </div>
        </Accordion>

        {/* ═══ SECTION 4: CLASSES & SUBCLASSES ═══ */}
        <Accordion title="อัปเดตคลาสและซับคลาส" icon="⚔️" color="#818cf8" id="classes">
          <div className="space-y-8">
            <div>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                <strong>ระบบเลเวล:</strong> 1 Class Level = 2 Level ตัวละคร (1 Class ตันที่ 10 Level) <br/>
                <strong>Subclass:</strong> เริ่มเลือกได้เมื่อมี Class Level 5 ขึ้นไป (เป็น Optional) <br/>
                <em>*หมายเหตุ: ตัวละครสายปืน (Gunslinger) บังคับต้องมี Class นี้เท่านั้น</em>
              </p>
            </div>

            {/* MARTIAL */}
            <div className="space-y-4">
              <h3 className="font-serif font-bold text-xl" style={{ color: "#f87171" }}>สายต่อสู้ระยะประชิด (Martial Classes)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ClassCard
                  name="Barbarian" color="#f87171"
                  passive="ทำดาเมจกายภาพเพิ่ม 5% แต่รับดาเมจแรงขึ้น 2%"
                  scaling="เพิ่มดาเมจ 1% และรับดาเมจเพิ่ม 1%"
                  perk="Adrenaline Rush – เลือดต่ำกว่า 50% ดาเมจแรงขึ้น 10%"
                />
                <ClassCard
                  name="Fighter" color="#fb923c"
                  passive="AC +1 และ Max HP +3"
                  scaling="Max HP +3 และดาเมจกายภาพ +1%"
                  perk="Tactical Recovery – ฟื้นฟูเลือดตอนพัก (Short/Long) แรงขึ้น 10%"
                />
                <ClassCard
                  name="Monk" color="#facc15"
                  passive="Advantage DEX check, ไม่ใส่เกราะ = Evasion +2"
                  scaling="ดาเมจมือเปล่า/อาวุธ Monk +1%"
                  perk="Ki Flow – เมื่อติดคริหรือฆ่าศัตรู ได้ Ki Point คืน 1 แต้ม"
                />
              </div>

              {/* Martial Subclasses */}
              <div className="mt-4 p-4 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
                <h4 className="font-bold text-sm mb-3 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Subclasses (Lv 5+)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SubclassCard name="Barbarian: Berserker"
                    passive="Rage เพิ่มดาเมจอีก 10% / ต้าน Fear"
                    skill="Blood Frenzy (3 turns): ตีเพิ่ม 1 ครั้ง, Crit +10%"
                    scaling="ดาเมจ Rage +2%"
                  />
                  <SubclassCard name="Barbarian: Beast"
                    passive="เลือกร่าง: Bear (HP+15%), Wolf (Move+2), Tiger (Crit Dmg+15%)"
                    skill="Primal Shift (3 turns): โบนัสสัตว์ x2"
                    scaling="โบนัสร่างสัตว์ +1%"
                  />
                  <SubclassCard name="Fighter: Champion"
                    passive="Crit ออกที่ 19-20 / Crit Damage +20%"
                    skill="Heroic Strike (1/battle): Hit 100%, Crit 100%"
                    scaling="Crit Damage +3%"
                  />
                  <SubclassCard name="Fighter: Rune Knight"
                    passive="เลือกรูน 2 แบบ (Fire=Burn, Stone=Stun, Frost=Freeze, Storm=Paralyze)"
                    skill="Mana Flowing (3 turns): HP+25%, Reach+1, Damage+15%"
                    scaling="Damage +2%"
                  />
                  <SubclassCard name="Monk: Kensei"
                    passive="เลือก 1 อาวุธ (Damage+10%, Attack Roll+1)"
                    skill="Perfect Form (3 turns): Crit+15%, Dodge+2"
                    scaling="Damage +2%"
                  />
                  <SubclassCard name="Monk: Elements"
                    passive="เลือกธาตุ (Fire/Water/Air/Earth) ตีมือเปล่าติดธาตุ"
                    skill="Elemental Avatar (3 turns): ดาเมจธาตุ+30%, กันธาตุ"
                    scaling="Element Damage +2%"
                  />
                </div>
              </div>
            </div>

            {/* SKILLED */}
            <div className="space-y-4">
              <h3 className="font-serif font-bold text-xl mt-8" style={{ color: "#34d399" }}>สายพริ้วไหวและผู้เชี่ยวชาญ (Skilled Classes)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ClassCard
                  name="Rogue" color="#34d399"
                  passive="เพิ่มโอกาส Critical Hit +2 d20 ระยะประชิด/ไกล"
                  scaling="หลบหนีได้ Advantage, Crit Dmg +2%"
                  perk="Sticky Fingers – โอกาส 15% ได้เงิน/ไอเทมเพิ่มตอนขโมยหรือเปิดหีบ"
                />
                <ClassCard
                  name="Ranger" color="#10b981"
                  passive="ความแม่นยำโจมตีไกล +2 d20"
                  scaling="ดาเมจระยะไกล +1%, ลดโอกาสหลบศัตรู -0.5 roll"
                  perk="Survivalist – หาอาหาร/สมุนไพร 2 เท่า, เดินทัพเร็วขึ้น"
                />
                <ClassCard
                  name="Gunslinger (บังคับ)" color="#64748b"
                  passive="ทุกการโจมตีปืน = AC เป้าหมาย (ตีโดนเสมอ ไม่สนบวกลบ)"
                  scaling="—"
                  perk="Roleplay: ทอยอะไรก็ไม่มีทางต่ำกว่า 10"
                />
              </div>

              {/* Skilled Subclasses */}
              <div className="mt-4 p-4 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SubclassCard name="Rogue: Assassin"
                    passive="โจมตีเป้าหมายที่ยังไม่เคลื่อนที่ = Crit 100%"
                    skill="Death Mark (3 turns): Damage+30%, Crit Damage+50%"
                    scaling="Crit Damage +3%"
                  />
                  <SubclassCard name="Rogue: Soulknife"
                    passive="Psychic Blade ตีทะลุเกราะ"
                    skill="Mind Break (CD 3): Psychic Dmg (Spell Slot+d6) + Stun 1 turn"
                    scaling="Psychic Damage +3%"
                  />
                  <SubclassCard name="Ranger: Hunter"
                    passive="เลือก 1 Trait ตีมอนกลุ่มนั้นแรงขึ้น 30%"
                    skill="Hunter's Focus (3 turns, CD 5): +3 d20, Damage+20%"
                  />
                  <SubclassCard name="Ranger: Monster Slayer"
                    passive="Mark ศัตรู (ตีศัตรูนั้น +15%, Save DC ตัวเอง +1)"
                    skill="Slayer's Verdict (3 turns): บอสรับดาเมจหมู่แรงขึ้น 25%"
                  />
                </div>
              </div>
            </div>

            {/* SPELLCASTERS */}
            <div className="space-y-4">
              <h3 className="font-serif font-bold text-xl mt-8" style={{ color: "#a78bfa" }}>สายเวทมนตร์และพลังจิต (Spellcasters)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ClassCard
                  name="Wizard" color="#a78bfa"
                  passive="ดาเมจเวทย์ +5%, Max HP ลด 2%"
                  scaling="ดาเมจเวทย์ +1.5%"
                  perk="Scholar's Mind – Advantage เวลาเช็คไอเทมเวทย์โบราณ"
                />
                <ClassCard
                  name="Sorcerer" color="#c084fc"
                  passive="โอกาส 10% ร่าย Echo Cast ฟรี (ดาเมจลดครึ่ง)"
                  scaling="โอกาส Echo Cast +1%, ดาเมจเวทย์ +0.5%"
                  perk="Mana Surge – จบต่อสู้ 20% ได้ Spell Slot ขั้นต่ำคืน 1 ช่อง"
                />
                <ClassCard
                  name="Warlock" color="#9333ea"
                  passive="โจมตีเป้าหมายเดี่ยวแรง 8% โดนตีสวนแรงขึ้น 3%"
                  scaling="ดาเมจเป้าเดี่ยว +1%, ความแรง Debuff +0.5"
                  perk="Patron's Eye – Darkvision + จับสัมผัสวิญญาณ/ปีศาจซ่อนตัวได้ง่าย"
                />
              </div>

              {/* Caster Subclasses */}
              <div className="mt-4 p-4 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SubclassCard name="Wizard: Necromancy"
                    passive="ฆ่าศัตรู = เสก Skeleton 1 ตัว (HP 25 เป็นโล่มนุษย์)"
                    skill="Army of the Dead (1/battle): เสก Undead 3 ตัว"
                    scaling="Summon HP +5%"
                  />
                  <SubclassCard name="Wizard: Divination"
                    passive="วันละ 2 ครั้ง: Reroll Dice"
                    skill="Fate Twist (1/battle): เปลี่ยนผลเต๋าเป็นเลขอะไรก็ได้"
                  />
                  <SubclassCard name="Sorcerer: Shadow Magic"
                    passive="Darkvision, Necrotic Resist"
                    skill="Dark One (3 turns): Evasion+3, Spell Damage+20%"
                  />
                  <SubclassCard name="Warlock: The Hexblade"
                    passive="Curse: ตีแรง 15%, ตีโดนฮีลตัวเอง 10% ของดาเมจ"
                    skill="Soul Reaper (3 turns, CD 5): Crit+20%, ฮีล 30%"
                  />
                </div>
              </div>
            </div>

            {/* DIVINE & UTILITY */}
            <div className="space-y-4">
              <h3 className="font-serif font-bold text-xl mt-8" style={{ color: "#60a5fa" }}>สายสนับสนุนและผู้พิทักษ์ (Divine & Utility)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ClassCard
                  name="Paladin" color="#60a5fa"
                  passive="ศัตรูตีเพื่อนในระยะถูกลดดาเมจ 5%, Paladin กันธาตุแสง/มืด 5%"
                  scaling="ระยะออร่า +1, Holy Damage +0.5%"
                  perk="Unshakable Faith – กัน Fear 100%, เพื่อนรอบตัวแก้สถานะจิตใจได้ Advantage"
                />
                <ClassCard
                  name="Cleric" color="#38bdf8"
                  passive="ฮีลและโล่ป้องกัน แรงขึ้น 5%"
                  scaling="Heal +1%, Shield +1%"
                  perk="Divine Grace – ดึงเพื่อนจาก Near Death เพื่อนได้ HP โบนัส 20%"
                />
                <ClassCard
                  name="Druid" color="#10b981"
                  passive="Wild Shape Max HP+10%, ร่างคนเวทย์แรง 5%"
                  scaling="Wild Shape HP +1.5%, กัน ดิน/น้ำ/ลม/ไฟ +0.5%"
                  perk="Beast Whisperer – คุยสัตว์ป่าได้ สัตว์ป่าไม่โจมตีก่อน"
                />
                <ClassCard
                  name="Bard" color="#f472b6"
                  passive="เพื่อนที่ได้ยินเสียง ได้ Skill Check +2 ทุกสกิล"
                  scaling="โบนัสเช็คสกิล +0.5, เวทย์ป่วน +1%"
                  perk="Jack of All Trades – ทอยสกิลที่ไม่มี Proficiency ได้ Re-roll ฟรี"
                />
              </div>

              {/* Divine Subclasses */}
              <div className="mt-4 p-4 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SubclassCard name="Paladin: Oath of Devotion"
                    passive="Holy Damage+10%, Fear Immune"
                    skill="Sacred Weapon (3 turns): +3 d20, Holy Damage+25%"
                  />
                  <SubclassCard name="Cleric: Life Domain"
                    passive="Heal +15%"
                    skill="Miracle (1/battle): Heal เพื่อน 50% Current HP, ล้าง Debuff"
                  />
                  <SubclassCard name="Druid: Circle of the Moon"
                    passive="Wild Shape HP +20%"
                    skill="Alpha Beast (3 turns): Damage+25%, Crit+15%"
                  />
                  <SubclassCard name="Bard: College of Lore"
                    passive="Skill Check+2, Advantage INT"
                    skill="Legendary Knowledge (3 turns): ทีมได้ Adv ทุก Check และ Save"
                  />
                </div>
              </div>
            </div>

          </div>
        </Accordion>

        {/* ═══ SECTION 5: HOMEBREW RULES (จากบอท) ═══ */}
        <Accordion title="กฎเพิ่มเติม (Bot Scanned)" icon="📝" color="#22d3ee" id="homebrew">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              เนื้อหานี้ถูกเพิ่มอัตโนมัติเมื่อบอทพบข้อความใน Discord ที่จัดหมวดเป็น <strong>"Rule"</strong>
            </p>

            {homebrewEntries.length === 0 ? (
              <div className="text-center py-12 rounded-xl" style={{ background: "var(--bg-tertiary)", border: "1px dashed var(--border-default)" }}>
                <p className="text-3xl mb-3">📭</p>
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>ยังไม่มีกฎ Homebrew ที่ดึงจาก Bot</p>
              </div>
            ) : (
              <div className="space-y-3">
                {homebrewEntries.map((entry: any) => (
                  <div
                    key={entry.id}
                    className="p-4 rounded-xl"
                    style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📝</span>
                        <h4 className="font-serif font-bold text-sm" style={{ color: "var(--text-primary)" }}>{entry.title}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <CategoryBadge tags={entry.tags} size="sm" />
                        <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                          โดย {entry.author}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                      {entry.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Accordion>
      </div>

      {/* ═══ STICKY TOC ═══ */}
      <aside className="hidden xl:block w-52 flex-shrink-0 no-print">
        <div className="sticky top-20 space-y-1">
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>
            สารบัญ
          </h3>
          {TOC_ITEMS.map(({ id, icon, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
              style={{
                color: activeSection === id ? "var(--text-accent)" : "var(--text-tertiary)",
                background: activeSection === id ? "var(--sidebar-active)" : "transparent",
                borderLeft: activeSection === id ? "2px solid var(--accent-500)" : "2px solid transparent",
              }}
            >
              <span className="text-xs">{icon}</span>
              <span className="text-xs">{label}</span>
            </a>
          ))}
        </div>
      </aside>
    </div>
  );
}
